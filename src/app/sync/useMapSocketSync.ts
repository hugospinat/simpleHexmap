import { useCallback, useEffect, useRef, useState } from "react";
import { deserializeWorld } from "@/app/document/worldMapCodec";
import type {
  MapTokenUpdateRequest,
  MapOperationMessage,
  MapOperationRequest,
} from "@/app/api/mapApi";
import { buildWebSocketUrl } from "@/app/api/apiBase";
import {
  applyMapTokenOperation,
  type MapOperation,
  type MapTokenOperation,
  type MapTokenPlacement,
} from "@/core/protocol";
import type { MapState } from "@/core/map/world";
import {
  applyReadySessionOperations,
  acknowledgeSessionOperation,
  clearMapSyncSession,
  commitSessionLocalOperations,
  createMapSyncSession,
  enqueueSessionOperation,
  getSessionUnsentOperationBatches,
  isSessionReadyForSend,
  markSessionError,
  markSessionOperationsSent,
  markSessionSocketClosed,
  markSessionSocketOpened,
  resetSessionAfterSyncError,
  resetSessionFromSnapshot,
  type MapSyncSessionStatus,
} from "@/app/sync/mapSyncSession";
import { parseMapSyncSocketMessage } from "@/app/sync/mapSyncMessages";
import {
  createMapSocketTransport,
  type MapSocketTransport,
} from "@/app/sync/mapSocketTransport";
import {
  mergeRenderWorldPatch,
  type RenderWorldPatchInput,
} from "@/app/sync/renderWorldPatchState";
import {
  applyTokenOperationToWorkspaceMembers,
  createClientId,
  logMapSync,
} from "@/app/sync/mapSyncSupport";
import type { RenderWorldPatch } from "@/render/renderWorldPatch";
import type { WorkspaceMember } from "@/core/auth/authTypes";

export type MapSyncStatus = MapSyncSessionStatus;

type UseMapSyncOptions = {
  clearPreview: () => void;
  initialWorld: MapState;
  initialWorkspaceMembers: WorkspaceMember[];
  mapId: string;
  onAuthoritativeResync?: () => void;
  onRemoteOperationsApplied?: (count: number) => void;
  userId: string;
};

export type UseMapSocketSyncResult = {
  acknowledgeRenderWorldPatch: (revision: number) => void;
  commitLocalOperations: (operations: MapOperation[]) => void;
  confirmedWorld: MapState;
  tokenPlacements: MapTokenPlacement[];
  renderWorldPatch: RenderWorldPatch;
  sendTokenOperation: (operation: MapTokenOperation) => void;
  syncStatus: MapSyncStatus;
  workspaceMembers: WorkspaceMember[];
  visibleWorld: MapState;
};

const maxOperationsPerBatch = 500;

export function useMapSocketSync({
  clearPreview,
  initialWorld,
  initialWorkspaceMembers,
  mapId,
  onAuthoritativeResync,
  onRemoteOperationsApplied,
  userId,
}: UseMapSyncOptions): UseMapSocketSyncResult {
  const clientIdRef = useRef(createClientId());
  const sessionRef = useRef(
    createMapSyncSession(clientIdRef.current, initialWorld),
  );
  const transportRef = useRef<MapSocketTransport | null>(null);
  const [confirmedWorld, setConfirmedWorld] = useState(initialWorld);
  const renderWorldPatchRevisionRef = useRef(0);
  const acknowledgedRenderWorldPatchRevisionRef = useRef(0);
  const [renderWorldPatch, setRenderWorldPatch] = useState<RenderWorldPatch>({
    revision: 0,
    type: "snapshot",
  });
  const [visibleWorld, setVisibleWorld] = useState(initialWorld);
  const [tokenPlacements, setTokenPlacements] = useState<MapTokenPlacement[]>(
    [],
  );
  const confirmedTokenPlacementsRef = useRef<MapTokenPlacement[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>(
    initialWorkspaceMembers,
  );
  const confirmedWorkspaceMembersRef = useRef<WorkspaceMember[]>(
    initialWorkspaceMembers,
  );
  const [syncStatus, setSyncStatus] = useState<MapSyncStatus>("connecting");

  const publishRenderWorldPatch = useCallback(
    (patch: RenderWorldPatchInput) => {
      renderWorldPatchRevisionRef.current += 1;
      const revision = renderWorldPatchRevisionRef.current;
      setRenderWorldPatch((previous) =>
        mergeRenderWorldPatch(
          previous,
          acknowledgedRenderWorldPatchRevisionRef.current,
          patch,
          revision,
        ),
      );
    },
    [],
  );

  const acknowledgeRenderWorldPatch = useCallback((revision: number) => {
    acknowledgedRenderWorldPatchRevisionRef.current = Math.max(
      acknowledgedRenderWorldPatchRevisionRef.current,
      revision,
    );
  }, []);

  const publishSessionState = useCallback(() => {
    const session = sessionRef.current;
    setConfirmedWorld(session.confirmedWorld);
    setVisibleWorld(session.visibleWorld);
    setSyncStatus(session.status);
  }, []);

  const flushOperations = useCallback(() => {
    const transport = transportRef.current;
    const session = sessionRef.current;

    if (!transport || transport.socket.readyState !== WebSocket.OPEN) {
      setSyncStatus("connecting");
      return;
    }

    if (!isSessionReadyForSend(session)) {
      setSyncStatus("connecting");
      return;
    }

    if (session.pendingOperations.length === 0) {
      setSyncStatus("saved");
      return;
    }

    const unsentBatches = getSessionUnsentOperationBatches(
      session,
      maxOperationsPerBatch,
    );
    const unsentCount = unsentBatches.reduce(
      (total, batch) => total + batch.length,
      0,
    );

    if (unsentCount === 0) {
      setSyncStatus("saving");
      return;
    }

    for (const batchItems of unsentBatches) {
      for (const envelope of batchItems) {
        const payload: MapOperationRequest = {
          type: "map_operation",
          operationId: envelope.operationId,
          operation: envelope.operation,
          clientId: clientIdRef.current,
        };
        transport.sendJson(payload);
        logMapSync("operation_sent", {
          mapId,
          operationId: envelope.operationId,
          operationType: envelope.operation.type,
        });
      }

      markSessionOperationsSent(session, batchItems);
    }

    publishSessionState();
  }, [mapId, publishSessionState]);

  const commitLocalOperations = useCallback(
    (operations: MapOperation[]) => {
      const envelopes = commitSessionLocalOperations(
        sessionRef.current,
        operations,
        Date.now(),
      );

      for (const envelope of envelopes) {
        logMapSync("operation_created", {
          mapId,
          operationId: envelope.operationId,
          operationType: envelope.operation.type,
        });
      }

      if (envelopes.length > 0) {
        publishRenderWorldPatch({
          operations: envelopes.map((envelope) => envelope.operation),
          type: "operations",
        });
        clearPreview();
        publishSessionState();
      }

      flushOperations();
    },
    [
      clearPreview,
      flushOperations,
      mapId,
      publishRenderWorldPatch,
      publishSessionState,
    ],
  );

  const sendTokenOperation = useCallback((operation: MapTokenOperation) => {
    setTokenPlacements((current) => applyMapTokenOperation(current, operation));
    setWorkspaceMembers((current) =>
      applyTokenOperationToWorkspaceMembers(current, operation),
    );

    const transport = transportRef.current;

    if (!transport || transport.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const payload: MapTokenUpdateRequest = {
      type: "map_token_update",
      operation,
    };
    transport.sendJson(payload);
  }, []);

  const applyQueuedReceivedOperations = useCallback(() => {
    const appliedOperations = applyReadySessionOperations(sessionRef.current);

    if (appliedOperations.length > 0) {
      const remoteOperations = appliedOperations
        .filter(({ acknowledgedLocal }) => !acknowledgedLocal)
        .map(({ message }) => message.operation);

      if (remoteOperations.length > 0) {
        publishRenderWorldPatch({
          operations: remoteOperations,
          type: "operations",
        });
        onRemoteOperationsApplied?.(remoteOperations.length);
      }

      clearPreview();
      publishSessionState();
    } else {
      setSyncStatus(sessionRef.current.status);
    }

    for (const { acknowledgedLocal, message, sequence } of appliedOperations) {
      logMapSync("operation_applied_sequence", {
        acknowledgedLocal,
        mapId,
        operationId: message.operationId,
        operationType: message.operation.type,
        sequence,
        sourceClientId: message.sourceClientId,
      });
    }

    flushOperations();
  }, [
    clearPreview,
    flushOperations,
    mapId,
    onRemoteOperationsApplied,
    publishRenderWorldPatch,
    publishSessionState,
  ]);

  const enqueueAppliedOperation = useCallback(
    (payload: MapOperationMessage) => {
      const result = enqueueSessionOperation(sessionRef.current, payload);

      if (result.status === "invalid") {
        console.error("[MapSync] invalid_operation_id", payload);
        return;
      }

      if (result.status === "past_sequence") {
        if (payload.sourceClientId === sessionRef.current.clientId) {
          acknowledgeSessionOperation(sessionRef.current, payload.operationId);
          publishSessionState();
        }

        logMapSync("operation_ignored_past_sequence", {
          expectedSequence: result.expectedSequence,
          mapId,
          operationId: payload.operationId,
          sequence: payload.sequence,
        });
        return;
      }

      if (result.status === "gap") {
        logMapSync("operation_gap_detected", {
          bufferedWaiting: result.bufferedWaiting,
          expectedSequence: result.expectedSequence,
          mapId,
          receivedSequence: result.receivedSequence,
        });
      }
    },
    [mapId, publishSessionState],
  );

  useEffect(() => {
    const socketUrl = buildWebSocketUrl(
      `/api/maps/${encodeURIComponent(mapId)}/ws`,
    );
    let disposed = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let activeTransport: MapSocketTransport | null = null;

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (disposed) {
        return;
      }

      const delayMs = Math.min(5000, 250 * 2 ** Math.min(reconnectAttempt, 4));
      reconnectAttempt += 1;
      clearReconnectTimer();
      setSyncStatus("connecting");
      logMapSync("reconnect_scheduled", {
        delayMs,
        mapId,
        reconnectAttempt,
        socketUrl,
      });
      reconnectTimer = window.setTimeout(connect, delayMs);
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      if (
        activeTransport &&
        (activeTransport.socket.readyState === WebSocket.CONNECTING ||
          activeTransport.socket.readyState === WebSocket.OPEN)
      ) {
        return;
      }

      const transport = createMapSocketTransport(socketUrl);
      const socket = transport.socket;
      activeTransport = transport;
      transportRef.current = transport;
      setSyncStatus("connecting");

      socket.onopen = () => {
        if (disposed || transportRef.current !== transport) {
          return;
        }

        reconnectAttempt = 0;
        markSessionSocketOpened(sessionRef.current);
        publishSessionState();
        logMapSync("open", { mapId, socketUrl });
      };

      socket.onmessage = (event) => {
        if (disposed || transportRef.current !== transport) {
          return;
        }

        const parsed = parseMapSyncSocketMessage(event.data);

        if (parsed.type === "sync_error") {
          console.error("[MapSync] sync_error", parsed.payload);
          resetSessionAfterSyncError(sessionRef.current);
          publishRenderWorldPatch({ type: "snapshot" });
          clearPreview();
          onAuthoritativeResync?.();
          publishSessionState();
          // Browsers only allow client close codes 1000 or 3000-4999.
          transport.close(4001, "sync_error_resync");
          return;
        }

        if (parsed.type === "sync_snapshot") {
          const payload = parsed.payload;

          if (
            !Number.isInteger(payload.lastSequence) ||
            payload.lastSequence < 0
          ) {
            console.error("[MapSync] invalid_snapshot_sequence", payload);
            markSessionError(sessionRef.current);
            publishSessionState();
            return;
          }

          try {
            const snapshotWorld = deserializeWorld(payload.document);
            resetSessionFromSnapshot(
              sessionRef.current,
              snapshotWorld,
              payload.lastSequence,
            );
            confirmedTokenPlacementsRef.current = payload.tokenPlacements;
            confirmedWorkspaceMembersRef.current = payload.workspaceMembers;
            setTokenPlacements(payload.tokenPlacements);
            setWorkspaceMembers(payload.workspaceMembers);
            publishRenderWorldPatch({ type: "snapshot" });
            clearPreview();
            onAuthoritativeResync?.();
            publishSessionState();
            logMapSync("snapshot_loaded", {
              lastSequence: payload.lastSequence,
              mapId,
              pendingLocal: sessionRef.current.pendingOperations.length,
            });
            flushOperations();
          } catch (error) {
            console.error("[MapSync] invalid_snapshot", error);
            markSessionError(sessionRef.current);
            publishSessionState();
          }
          return;
        }

        if (parsed.type === "map_token_updated") {
          const nextPlacements = applyMapTokenOperation(
            confirmedTokenPlacementsRef.current,
            parsed.payload.operation,
          );
          confirmedTokenPlacementsRef.current = nextPlacements;
          const nextMembers = applyTokenOperationToWorkspaceMembers(
            confirmedWorkspaceMembersRef.current,
            parsed.payload.operation,
          );
          confirmedWorkspaceMembersRef.current = nextMembers;
          setTokenPlacements(nextPlacements);
          setWorkspaceMembers(nextMembers);
          return;
        }

        if (parsed.type === "map_token_error") {
          console.warn("[MapSync] token_error", parsed.payload);
          setTokenPlacements(confirmedTokenPlacementsRef.current);
          setWorkspaceMembers(confirmedWorkspaceMembersRef.current);
          return;
        }

        if (parsed.type === "map_operation_applied") {
          enqueueAppliedOperation(parsed.payload);
          applyQueuedReceivedOperations();
          return;
        }

        if (parsed.type === "unknown") {
          logMapSync("unknown_message_ignored", { mapId });
        }

        if (parsed.type === "invalid_message") {
          console.error("[MapSync] invalid_message", {
            error: parsed.error,
            mapId,
          });
          markSessionError(sessionRef.current);
          publishSessionState();
        }

        if (parsed.type === "invalid_json") {
          console.error("[MapSync] invalid_json", { mapId });
          markSessionError(sessionRef.current);
          publishSessionState();
        }
      };

      socket.onerror = (event) => {
        if (!disposed && transportRef.current === transport) {
          console.error("[MapSync] error", { event, mapId, socketUrl });
        }
      };

      socket.onclose = (event) => {
        const isCurrentSocket = transportRef.current === transport;

        if (isCurrentSocket) {
          transportRef.current = null;
        }

        if (activeTransport === transport) {
          activeTransport = null;
        }

        if (disposed || !isCurrentSocket) {
          return;
        }

        console.warn("[MapSync] close", {
          code: event.code,
          mapId,
          reason: event.reason,
          socketUrl,
          wasClean: event.wasClean,
        });
        markSessionSocketClosed(sessionRef.current);
        publishSessionState();
        scheduleReconnect();
      };
    };

    reconnectTimer = window.setTimeout(connect, 0);

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearMapSyncSession(sessionRef.current);
      activeTransport?.close();
      transportRef.current = null;
    };
  }, [
    applyQueuedReceivedOperations,
    clearPreview,
    enqueueAppliedOperation,
    flushOperations,
    mapId,
    onAuthoritativeResync,
    publishRenderWorldPatch,
    publishSessionState,
    userId,
  ]);

  return {
    acknowledgeRenderWorldPatch,
    commitLocalOperations,
    confirmedWorld,
    tokenPlacements,
    renderWorldPatch,
    sendTokenOperation,
    syncStatus,
    workspaceMembers,
    visibleWorld,
  };
}
