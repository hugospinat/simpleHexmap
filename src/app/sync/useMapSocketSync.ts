import { useCallback, useEffect, useRef, useState } from "react";
import { applyMapOperationToWorld, type MapOperation } from "@/app/document/mapOperations";
import { deserializeWorld } from "@/app/document/worldMapCodec";
import type {
  MapOperationBatchAppliedMessage,
  MapOperationBatchRequest,
  MapOperationMessage,
  MapOperationRequest,
  MapSyncSnapshotMessage
} from "@/app/api/mapApi";
import { buildWebSocketUrl } from "@/app/api/apiBase";
import {
  acknowledgeSessionOperation,
  clearMapSyncSession,
  createMapSyncSession,
  enqueueSessionOperation,
  getSessionUnsentOperationBatches,
  isSessionReadyForSend,
  markSessionError,
  markSessionOperationsSent,
  markSessionSocketClosed,
  markSessionSocketOpened,
  queueSessionLocalOperations,
  resetSessionFromSnapshot,
  takeReadySessionOperations
} from "@/app/sync/mapSyncSession";
import type { MapState } from "@/core/map/world";

export type MapSyncStatus = "connecting" | "saving" | "saved" | "error";

type UseMapSyncOptions = {
  clearPreviewWorld: () => void;
  mapId: string;
  resetWorldFromCurrent: (deriveNextState: (currentState: MapState) => MapState) => void;
};

const maxOperationsPerBatch = 500;

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
  if (!isMapSyncDebugEnabled()) {
    return;
  }

  console.info(`[MapSync] ${event}`, payload);
}

function toRoundedMs(durationMs: number): number {
  return Number(durationMs.toFixed(2));
}

export function useMapSocketSync({ clearPreviewWorld, mapId, resetWorldFromCurrent }: UseMapSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<MapSyncStatus>("connecting");
  const websocketRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? `client-${crypto.randomUUID()}`
      : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const sessionRef = useRef(createMapSyncSession(clientIdRef.current));

  const flushOperations = useCallback(() => {
    const socket = websocketRef.current;
    const session = sessionRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
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

      socket.send(JSON.stringify(payload));
      markSessionOperationsSent(session, [envelope]);

      logMapSync("operation_sent", {
        mapId,
        operationId: envelope.operationId,
        operationType: envelope.operation.type,
        queued: session.pendingOperations.length
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

        socket.send(JSON.stringify(payload));
        markSessionOperationsSent(session, batchItems);

        logMapSync("operation_batch_sent", {
          mapId,
          batchIndex: batchIndex + 1,
          totalBatches: unsentBatches.length,
          operations: batchItems.length,
          queued: session.pendingOperations.length
        });
      }
    }

    setSyncStatus("saving");
  }, [mapId]);

  const sendOperations = useCallback((operations: MapOperation[]) => {
    const envelopes = queueSessionLocalOperations(sessionRef.current, operations, Date.now());

    for (const envelope of envelopes) {
      logMapSync("operation_created", {
        mapId,
        operationId: envelope.operationId,
        operationType: envelope.operation.type
      });
    }

    if (envelopes.length > 0) {
      setSyncStatus("saving");
    }

    flushOperations();
  }, [flushOperations, mapId]);

  const acknowledgeOperation = useCallback((operationId: string) => {
    acknowledgeSessionOperation(sessionRef.current, operationId);
  }, []);

  const applyQueuedReceivedOperations = useCallback(() => {
    const debugEnabled = isMapSyncDebugEnabled();
    const applyDispatchTimerLabel = `[MapSync] apply_queue_dispatch:${mapId}`;
    const applyQueueStartedAt = performance.now();
    let appliedCount = 0;
    let firstAppliedSequence: number | null = null;
    let lastAppliedSequence: number | null = null;

    if (debugEnabled) {
      console.time(applyDispatchTimerLabel);
    }

    const session = sessionRef.current;
    const operationsToApply = takeReadySessionOperations(session);
    for (const { sequence, message } of operationsToApply) {
      if (message.sourceClientId === clientIdRef.current) {
        acknowledgeOperation(message.operationId);
      }
      appliedCount += 1;
      firstAppliedSequence ??= sequence;
      lastAppliedSequence = sequence;
    }

    if (operationsToApply.length > 0) {
      clearPreviewWorld();
      resetWorldFromCurrent((currentWorld) => {
        let world = currentWorld;
        for (const { sequence, message } of operationsToApply) {
          const operationTimerBase = `[MapSync] apply_operation:${mapId}:${sequence}:${message.operationId}`;
          if (debugEnabled) {
            console.time(`${operationTimerBase}:applyMapOperationToWorld`);
          }
          const operationStart = performance.now();
          world = applyMapOperationToWorld(world, message.operation);
          const applyDurationMs = performance.now() - operationStart;
          if (debugEnabled) {
            console.timeEnd(`${operationTimerBase}:applyMapOperationToWorld`);
            if (applyDurationMs >= 8) {
              console.info("[MapSync] apply_operation_slow", {
                mapId,
                sequence,
                operationId: message.operationId,
                operationType: message.operation.type,
                durationMs: toRoundedMs(applyDurationMs)
              });
            }
          }
          logMapSync("operation_applied_sequence", {
            mapId,
            sequence,
            operationId: message.operationId,
            operationType: message.operation.type,
            sourceClientId: message.sourceClientId
          });
        }
        return world;
      });
    }

    if (debugEnabled) {
      console.timeEnd(applyDispatchTimerLabel);
      const applyQueueDispatchMs = performance.now() - applyQueueStartedAt;
      const bufferedSequences = Array.from(session.receiveQueue.bufferedOperations.keys());
      const nextBufferedSequence = bufferedSequences.length > 0 ? Math.min(...bufferedSequences) : null;
      console.info("[MapSync] apply_queue_summary", {
        mapId,
        appliedCount,
        firstAppliedSequence,
        lastAppliedSequence,
        expectedNextSequence: session.receiveQueue.expectedSequence,
        bufferedWaiting: session.receiveQueue.bufferedOperations.size,
        nextBufferedSequence,
        queuedLocal: session.pendingOperations.length,
        dispatchLoopMs: toRoundedMs(applyQueueDispatchMs)
      });
      if (appliedCount > 0) {
        const queueToPaintStartedAt = performance.now();
        window.requestAnimationFrame(() => {
          console.info("[MapSync] apply_queue_to_paint_summary", {
            mapId,
            appliedCount,
            durationMs: toRoundedMs(performance.now() - applyQueueStartedAt),
            toNextPaintMs: toRoundedMs(performance.now() - queueToPaintStartedAt)
          });
        });
      }
    }

    setSyncStatus(session.pendingOperations.length > 0 ? "saving" : "saved");
    flushOperations();
  }, [acknowledgeOperation, clearPreviewWorld, flushOperations, mapId, resetWorldFromCurrent]);

  useEffect(() => {
    const socketUrl = buildWebSocketUrl(`/api/maps/${encodeURIComponent(mapId)}/ws`);
    let disposed = false;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let activeSocket: WebSocket | null = null;

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

      logMapSync("reconnect_scheduled", { mapId, socketUrl, delayMs, reconnectAttempt });

      reconnectTimer = window.setTimeout(() => {
        connect();
      }, delayMs);
    };

    const connect = () => {
      if (disposed) {
        return;
      }

      if (activeSocket && (activeSocket.readyState === WebSocket.CONNECTING || activeSocket.readyState === WebSocket.OPEN)) {
        return;
      }

      logMapSync("connecting", { mapId, socketUrl });

      const socket = new WebSocket(socketUrl);
      activeSocket = socket;
      websocketRef.current = socket;
      setSyncStatus("connecting");

      socket.onopen = () => {
        if (disposed || websocketRef.current !== socket) {
          return;
        }

        reconnectAttempt = 0;
        markSessionSocketOpened(sessionRef.current);

        logMapSync("open", { mapId, socketUrl });
      };

      socket.onmessage = (event) => {
        if (disposed || websocketRef.current !== socket) {
          return;
        }

        let message: unknown;

        try {
          message = JSON.parse(String(event.data)) as unknown;
        } catch {
          return;
        }

        if (typeof message !== "object" || message === null || !("type" in message)) {
          return;
        }

        if ((message as { type?: string }).type === "sync_error") {
          console.error("[MapSync] sync_error", message);
          markSessionError(sessionRef.current);
          setSyncStatus("error");
          return;
        }

        if ((message as { type?: string }).type === "sync_snapshot") {
          const payload = message as MapSyncSnapshotMessage;

          if (!Number.isInteger(payload.lastSequence) || payload.lastSequence < 0) {
            console.error("[MapSync] invalid_snapshot_sequence", payload);
            markSessionError(sessionRef.current);
            setSyncStatus("error");
            return;
          }

          try {
            const snapshotWorld = deserializeWorld(payload.content);
            clearPreviewWorld();
            resetWorldFromCurrent(() => snapshotWorld);
            resetSessionFromSnapshot(sessionRef.current, payload.lastSequence);
            setSyncStatus(sessionRef.current.status);

            logMapSync("snapshot_loaded", {
              mapId,
              lastSequence: payload.lastSequence,
              nextExpectedSequence: sessionRef.current.receiveQueue.expectedSequence,
              queuedLocal: sessionRef.current.pendingOperations.length
            });

            flushOperations();
          } catch (error) {
            console.error("[MapSync] invalid_snapshot", error);
            markSessionError(sessionRef.current);
            setSyncStatus("error");
          }

          return;
        }

        const enqueueAppliedOperation = (payload: MapOperationMessage) => {
          const operationId = payload.operationId;
          const result = enqueueSessionOperation(sessionRef.current, payload);

          if (result.status === "invalid") {
            console.error("[MapSync] invalid_operation_id", payload);
            return;
          }

          if (result.status === "waiting_for_snapshot") {
            logMapSync("operation_waiting_snapshot", {
              mapId,
              operationId,
              sequence: payload.sequence,
              operationType: payload.operation.type
            });
            return;
          }

          if (result.status === "past_sequence") {
            if (payload.sourceClientId === clientIdRef.current) {
              acknowledgeOperation(operationId);
            }

            logMapSync("operation_ignored_past_sequence", {
              mapId,
              operationId,
              sequence: payload.sequence,
              expectedSequence: result.expectedSequence,
              operationType: payload.operation.type
            });

            return;
          }

          logMapSync("operation_received", {
            mapId,
            sequence: payload.sequence,
            operationId,
            operationType: payload.operation.type,
            sourceClientId: payload.sourceClientId
          });

          if (result.status === "gap") {
            logMapSync("operation_gap_detected", {
              mapId,
              expectedSequence: result.expectedSequence,
              receivedSequence: result.receivedSequence,
              bufferedWaiting: result.bufferedWaiting
            });
          }
        };

        const messageType = (message as { type?: string }).type;

        if (messageType === "map_operation_applied") {
          enqueueAppliedOperation(message as MapOperationMessage);
          applyQueuedReceivedOperations();
          return;
        }

        if (messageType === "map_operation_batch_applied") {
          const batch = message as MapOperationBatchAppliedMessage;

          if (!Array.isArray(batch.operations)) {
            console.error("[MapSync] invalid_operation_batch", batch);
            return;
          }

          logMapSync("operation_batch_received", {
            mapId,
            operations: batch.operations.length
          });

          for (const operation of batch.operations) {
            enqueueAppliedOperation({ type: "map_operation_applied", ...operation });
          }

          applyQueuedReceivedOperations();
        }
      };

      socket.onerror = (event) => {
        if (disposed || websocketRef.current !== socket) {
          return;
        }

        console.error("[MapSync] error", { mapId, socketUrl, event });
      };

      socket.onclose = (event) => {
        const isCurrentSocket = websocketRef.current === socket;

        if (isCurrentSocket) {
          websocketRef.current = null;
        }

        if (activeSocket === socket) {
          activeSocket = null;
        }

        if (disposed || !isCurrentSocket) {
          logMapSync("close_intentional", {
            mapId,
            socketUrl,
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          return;
        }

        console.warn("[MapSync] close", {
          mapId,
          socketUrl,
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });

        markSessionSocketClosed(sessionRef.current);
        setSyncStatus("connecting");
        scheduleReconnect();
      };
    };

    reconnectTimer = window.setTimeout(() => {
      connect();
    }, 0);

    return () => {
      disposed = true;
      clearReconnectTimer();
      clearMapSyncSession(sessionRef.current);

      if (activeSocket && (activeSocket.readyState === WebSocket.CONNECTING || activeSocket.readyState === WebSocket.OPEN)) {
        activeSocket.close(1000, "client_cleanup");
      }

      websocketRef.current = null;
    };
  }, [acknowledgeOperation, applyQueuedReceivedOperations, clearPreviewWorld, flushOperations, mapId, resetWorldFromCurrent]);

  return {
    sendOperations,
    syncStatus
  };
}
