import { useCallback, useEffect, useRef, useState } from "react";
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
  markSessionOperationsSent,
  markSessionSocketClosed,
  markSessionSocketOpened,
  type MapSyncSessionStatus,
} from "@/app/sync/mapSyncSession";
import { startMapSocketLifecycle } from "@/app/sync/mapSocketLifecycle";
import { handleParsedMapSocketMessage } from "@/app/sync/mapSocketMessageHandler";
import {
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
    const stopSocketLifecycle = startMapSocketLifecycle({
      mapId,
      onClose: () => {
        markSessionSocketClosed(sessionRef.current);
        publishSessionState();
      },
      onMessage: (parsed, transport) => {
        handleParsedMapSocketMessage(parsed, {
          applyQueuedReceivedOperations,
          clearPreview,
          confirmedTokenPlacementsRef,
          confirmedWorkspaceMembersRef,
          enqueueAppliedOperation,
          flushOperations,
          mapId,
          onAuthoritativeResync,
          publishRenderWorldPatch,
          publishSessionState,
          sessionRef,
          setTokenPlacements,
          setWorkspaceMembers,
          transport,
        });
      },
      onOpen: () => {
        setSyncStatus("connecting");
        markSessionSocketOpened(sessionRef.current);
        publishSessionState();
      },
      socketUrl,
      transportRef,
    });

    return () => {
      clearMapSyncSession(sessionRef.current);
      stopSocketLifecycle();
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
