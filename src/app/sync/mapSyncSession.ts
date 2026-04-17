import { coalesceMapOperations, type MapOperation } from "@/core/protocol";
import type { MapOperationMessage } from "@/app/api/mapApi";
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
  operationCounter: number;
  pendingOperations: PendingOperationEnvelope[];
  receiveQueue: SyncReceiveQueue;
  status: MapSyncSessionStatus;
};

export function createMapSyncSession(clientId: string): MapSyncSession {
  return {
    clientId,
    operationCounter: 0,
    pendingOperations: [],
    receiveQueue: createSyncReceiveQueue(),
    status: "connecting"
  };
}

export function markSessionSocketOpened(session: MapSyncSession): void {
  clearSyncReceiveQueue(session.receiveQueue);
  session.pendingOperations = markAllPendingOperationsUnsent(session.pendingOperations);
  session.status = "connecting";
}

export function markSessionSocketClosed(session: MapSyncSession): void {
  session.status = "connecting";
}

export function markSessionError(session: MapSyncSession): void {
  session.status = "error";
}

export function resetSessionFromSnapshot(session: MapSyncSession, lastSequence: number): void {
  resetSyncReceiveQueueFromSnapshot(session.receiveQueue, lastSequence);
  session.status = session.pendingOperations.length > 0 ? "saving" : "saved";
}

export function queueSessionLocalOperations(
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
  session.status = session.pendingOperations.length > 0 ? "saving" : "saved";
}

export function acknowledgeSessionOperation(session: MapSyncSession, operationId: string): boolean {
  const acknowledged = acknowledgePendingOperation(session.pendingOperations, operationId);
  session.status = session.pendingOperations.length > 0 ? "saving" : "saved";
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

export function clearMapSyncSession(session: MapSyncSession): void {
  clearSyncReceiveQueue(session.receiveQueue);
  session.status = "connecting";
}

export function isSessionReadyForSend(session: MapSyncSession): boolean {
  return session.receiveQueue.expectedSequence !== null;
}
