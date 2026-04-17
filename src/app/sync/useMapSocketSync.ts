import { useCallback, useEffect, useRef, useState } from "react";
import { deserializeWorld } from "@/app/document/worldMapCodec";
import type {
  MapOperationBatchRequest,
  MapOperationMessage,
  MapOperationRequest
} from "@/app/api/mapApi";
import { buildWebSocketUrl } from "@/app/api/apiBase";
import type { MapOperation } from "@/core/protocol";
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
  resetSessionFromSnapshot,
  type MapSyncSessionStatus
} from "@/app/sync/mapSyncSession";
import { parseMapSyncSocketMessage } from "@/app/sync/mapSyncMessages";
import { createMapSocketTransport, type MapSocketTransport } from "@/app/sync/mapSocketTransport";

export type MapSyncStatus = MapSyncSessionStatus;

type UseMapSyncOptions = {
  clearPreviewWorld: () => void;
  initialWorld: MapState;
  mapId: string;
};

export type UseMapSocketSyncResult = {
  commitLocalOperations: (operations: MapOperation[]) => void;
  confirmedWorld: MapState;
  syncStatus: MapSyncStatus;
  visibleWorld: MapState;
};

const maxOperationsPerBatch = 500;

function createClientId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `client-${crypto.randomUUID()}`
    : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isMapSyncDebugEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  try {
    return window.localStorage.getItem("hexmap:sync-debug") === "1";
  } catch {
    return false;
  }
}

function logMapSync(event: string, payload: Record<string, unknown>): void {
  if (isMapSyncDebugEnabled()) {
    console.info(`[MapSync] ${event}`, payload);
  }
}

export function useMapSocketSync({ clearPreviewWorld, initialWorld, mapId }: UseMapSyncOptions): UseMapSocketSyncResult {
  const clientIdRef = useRef(createClientId());
  const sessionRef = useRef(createMapSyncSession(clientIdRef.current, initialWorld));
  const transportRef = useRef<MapSocketTransport | null>(null);
  const [confirmedWorld, setConfirmedWorld] = useState(initialWorld);
  const [visibleWorld, setVisibleWorld] = useState(initialWorld);
  const [syncStatus, setSyncStatus] = useState<MapSyncStatus>("connecting");

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

    const unsentBatches = getSessionUnsentOperationBatches(session, maxOperationsPerBatch);
    const unsentCount = unsentBatches.reduce((total, batch) => total + batch.length, 0);

    if (unsentCount === 0) {
      setSyncStatus("saving");
      return;
    }

    if (unsentCount === 1) {
      const envelope = unsentBatches[0][0];
      const payload: MapOperationRequest = {
        type: "map_operation",
        operationId: envelope.operationId,
        operation: envelope.operation,
        clientId: clientIdRef.current
      };
      transport.sendJson(payload);
      markSessionOperationsSent(session, [envelope]);
      logMapSync("operation_sent", {
        mapId,
        operationId: envelope.operationId,
        operationType: envelope.operation.type
      });
    } else {
      for (let batchIndex = 0; batchIndex < unsentBatches.length; batchIndex += 1) {
        const batchItems = unsentBatches[batchIndex];
        const payload: MapOperationBatchRequest = {
          type: "map_operation_batch",
          clientId: clientIdRef.current,
          operations: batchItems.map((envelope) => ({
            operationId: envelope.operationId,
            operation: envelope.operation
          }))
        };
        transport.sendJson(payload);
        markSessionOperationsSent(session, batchItems);
        logMapSync("operation_batch_sent", {
          mapId,
          batchIndex: batchIndex + 1,
          operations: batchItems.length,
          totalBatches: unsentBatches.length
        });
      }
    }

    publishSessionState();
  }, [mapId, publishSessionState]);

  const commitLocalOperations = useCallback((operations: MapOperation[]) => {
    const envelopes = commitSessionLocalOperations(sessionRef.current, operations, Date.now());

    for (const envelope of envelopes) {
      logMapSync("operation_created", {
        mapId,
        operationId: envelope.operationId,
        operationType: envelope.operation.type
      });
    }

    if (envelopes.length > 0) {
      clearPreviewWorld();
      publishSessionState();
    }

    flushOperations();
  }, [clearPreviewWorld, flushOperations, mapId, publishSessionState]);

  const applyQueuedReceivedOperations = useCallback(() => {
    const appliedOperations = applyReadySessionOperations(sessionRef.current);

    if (appliedOperations.length > 0) {
      clearPreviewWorld();
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
        sourceClientId: message.sourceClientId
      });
    }

    flushOperations();
  }, [clearPreviewWorld, flushOperations, mapId, publishSessionState]);

  const enqueueAppliedOperation = useCallback((payload: MapOperationMessage) => {
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
        sequence: payload.sequence
      });
      return;
    }

    if (result.status === "gap") {
      logMapSync("operation_gap_detected", {
        bufferedWaiting: result.bufferedWaiting,
        expectedSequence: result.expectedSequence,
        mapId,
        receivedSequence: result.receivedSequence
      });
    }
  }, [mapId, publishSessionState]);

  useEffect(() => {
    const socketUrl = buildWebSocketUrl(`/api/maps/${encodeURIComponent(mapId)}/ws`);
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

      const delayMs = Math.min(5000, 250 * (2 ** Math.min(reconnectAttempt, 4)));
      reconnectAttempt += 1;
      clearReconnectTimer();
      setSyncStatus("connecting");
      logMapSync("reconnect_scheduled", { delayMs, mapId, reconnectAttempt, socketUrl });
      reconnectTimer = window.setTimeout(connect, delayMs);
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      if (activeTransport && (
        activeTransport.socket.readyState === WebSocket.CONNECTING
        || activeTransport.socket.readyState === WebSocket.OPEN
      )) {
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
          markSessionError(sessionRef.current);
          publishSessionState();
          return;
        }

        if (parsed.type === "sync_snapshot") {
          const payload = parsed.payload;

          if (!Number.isInteger(payload.lastSequence) || payload.lastSequence < 0) {
            console.error("[MapSync] invalid_snapshot_sequence", payload);
            markSessionError(sessionRef.current);
            publishSessionState();
            return;
          }

          try {
            const snapshotWorld = deserializeWorld(payload.content);
            resetSessionFromSnapshot(sessionRef.current, snapshotWorld, payload.lastSequence);
            clearPreviewWorld();
            publishSessionState();
            logMapSync("snapshot_loaded", {
              lastSequence: payload.lastSequence,
              mapId,
              pendingLocal: sessionRef.current.pendingOperations.length
            });
            flushOperations();
          } catch (error) {
            console.error("[MapSync] invalid_snapshot", error);
            markSessionError(sessionRef.current);
            publishSessionState();
          }
          return;
        }

        if (parsed.type === "map_operation_applied") {
          enqueueAppliedOperation(parsed.payload);
          applyQueuedReceivedOperations();
          return;
        }

        if (parsed.type === "map_operation_batch_applied") {
          const batch = parsed.payload;

          if (!Array.isArray(batch.operations)) {
            console.error("[MapSync] invalid_operation_batch", batch);
            return;
          }

          for (const operation of batch.operations) {
            enqueueAppliedOperation({ type: "map_operation_applied", ...operation });
          }

          applyQueuedReceivedOperations();
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
          wasClean: event.wasClean
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
    clearPreviewWorld,
    enqueueAppliedOperation,
    flushOperations,
    mapId,
    publishSessionState
  ]);

  return {
    commitLocalOperations,
    confirmedWorld,
    syncStatus,
    visibleWorld
  };
}
