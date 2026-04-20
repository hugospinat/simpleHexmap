import { coalesceMapOperations, type MapOperation } from "@/core/protocol";
import type { MapOperationMessage } from "@/app/api/mapApi";
import { applyOperationsToWorld } from "@/core/map/worldOperationApplier";
import type { MapState } from "@/core/map/world";
import {
  acknowledgePendingOperation,
  getUnsentOperationBatches,
  markAllPendingOperationsUnsent,
  markPendingOperationsSent,
  type PendingOperationEnvelope
} from "@/app/sync/syncPendingOperations";
import {
  clearSyncReceiveQueue,
  createSyncReceiveQueue,
  enqueueReceivedOperation,
  resetSyncReceiveQueueFromSnapshot,
  takeReadyReceivedOperations,
  type EnqueueReceivedOperationResult,
  type SyncReceiveQueue
} from "@/app/sync/syncReceiveQueue";

export type MapSyncSessionStatus = "connecting" | "saving" | "saved" | "error";

export type MapSyncSession = {
  clientId: string;
  confirmedWorld: MapState;
  operationCounter: number;
  pendingOperations: PendingOperationEnvelope[];
  receiveQueue: SyncReceiveQueue;
  status: MapSyncSessionStatus;
  visibleWorld: MapState;
};

export type MapSyncAction =
  | { type: "snapshot_received"; world: MapState; lastSequence: number }
  | { type: "local_operations_committed"; operations: MapOperation[]; nowMs: number }
  | { type: "operation_ack_received"; operationId: string }
  | { type: "remote_operation_received"; message: MapOperationMessage }
  | { type: "ready_remote_operations_applied" }
  | { type: "socket_opened" }
  | { type: "socket_closed" }
  | { type: "sync_error" };

export type MapSyncReadyOperation = {
  acknowledgedLocal: boolean;
  message: MapOperationMessage;
  sequence: number;
};

function replayPendingOperations(confirmedWorld: MapState, pendingOperations: PendingOperationEnvelope[]): MapState {
  return applyOperationsToWorld(
    confirmedWorld,
    pendingOperations.map((envelope) => envelope.operation)
  );
}

function refreshVisibleWorld(session: MapSyncSession): void {
  session.visibleWorld = replayPendingOperations(session.confirmedWorld, session.pendingOperations);
}

function updateSessionSavedStatus(session: MapSyncSession): void {
  session.status = session.pendingOperations.length > 0 ? "saving" : "saved";
}

export function createMapSyncSession(clientId: string, initialWorld: MapState): MapSyncSession {
  return {
    clientId,
    confirmedWorld: initialWorld,
    operationCounter: 0,
    pendingOperations: [],
    receiveQueue: createSyncReceiveQueue(),
    status: "connecting",
    visibleWorld: initialWorld
  };
}

export function markSessionSocketOpened(session: MapSyncSession): void {
  clearSyncReceiveQueue(session.receiveQueue);
  session.pendingOperations = markAllPendingOperationsUnsent(session.pendingOperations);
  refreshVisibleWorld(session);
  session.status = "connecting";
}

export function markSessionSocketClosed(session: MapSyncSession): void {
  session.status = "connecting";
}

export function markSessionError(session: MapSyncSession): void {
  session.status = "error";
}

export function resetSessionAfterSyncError(session: MapSyncSession): void {
  clearSyncReceiveQueue(session.receiveQueue);
  session.pendingOperations = [];
  session.visibleWorld = session.confirmedWorld;
  session.status = "error";
}

export function resetSessionFromSnapshot(session: MapSyncSession, world: MapState, lastSequence: number): void {
  session.confirmedWorld = world;
  resetSyncReceiveQueueFromSnapshot(session.receiveQueue, lastSequence);
  refreshVisibleWorld(session);
  updateSessionSavedStatus(session);
}

export function commitSessionLocalOperations(
  session: MapSyncSession,
  operations: MapOperation[],
  nowMs: number
): PendingOperationEnvelope[] {
  const envelopes: PendingOperationEnvelope[] = [];
  const operationsToQueue = coalesceMapOperations(operations);

  for (const operation of operationsToQueue) {
    session.operationCounter += 1;
    const envelope = {
      operationId: `${session.clientId}-${nowMs}-${session.operationCounter}`,
      operation,
      sent: false
    };
    session.pendingOperations.push(envelope);
    envelopes.push(envelope);
  }

  if (envelopes.length > 0) {
    session.visibleWorld = applyOperationsToWorld(session.visibleWorld, envelopes.map((envelope) => envelope.operation));
    session.status = "saving";
  }

  return envelopes;
}

export function getSessionUnsentOperationBatches(
  session: MapSyncSession,
  maxOperationsPerBatch: number
): PendingOperationEnvelope[][] {
  return getUnsentOperationBatches(session.pendingOperations, maxOperationsPerBatch);
}

export function markSessionOperationsSent(session: MapSyncSession, envelopes: PendingOperationEnvelope[]): void {
  markPendingOperationsSent(envelopes);
  updateSessionSavedStatus(session);
}

export function acknowledgeSessionOperation(session: MapSyncSession, operationId: string): boolean {
  const acknowledged = acknowledgePendingOperation(session.pendingOperations, operationId);
  refreshVisibleWorld(session);
  updateSessionSavedStatus(session);
  return acknowledged;
}

export function enqueueSessionOperation(
  session: MapSyncSession,
  payload: MapOperationMessage
): EnqueueReceivedOperationResult {
  return enqueueReceivedOperation(session.receiveQueue, payload);
}

export function takeReadySessionOperations(session: MapSyncSession): Array<{ sequence: number; message: MapOperationMessage }> {
  return takeReadyReceivedOperations(session.receiveQueue);
}

export function applyReadySessionOperations(session: MapSyncSession): MapSyncReadyOperation[] {
  const readyOperations = takeReadySessionOperations(session);
  const applied: MapSyncReadyOperation[] = [];
  const operationsToApply: MapOperation[] = [];

  for (const { sequence, message } of readyOperations) {
    operationsToApply.push(message.operation);
    const acknowledgedLocal = message.sourceClientId === session.clientId
      ? acknowledgePendingOperation(session.pendingOperations, message.operationId)
      : false;
    applied.push({ acknowledgedLocal, message, sequence });
  }

  if (applied.length > 0) {
    session.confirmedWorld = applyOperationsToWorld(session.confirmedWorld, operationsToApply);
    refreshVisibleWorld(session);
  }

  updateSessionSavedStatus(session);
  return applied;
}

export function clearMapSyncSession(session: MapSyncSession): void {
  clearSyncReceiveQueue(session.receiveQueue);
  session.status = "connecting";
}

export function isSessionReadyForSend(session: MapSyncSession): boolean {
  return session.receiveQueue.expectedSequence !== null;
}
