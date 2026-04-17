import type { MapOperation } from "@/shared/mapProtocol";
import type { MapOperationMessage } from "@/app/io/mapApi";
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

export type ClientMapSessionStatus = "connecting" | "saving" | "saved" | "error";

export type ClientMapSession = {
  clientId: string;
  operationCounter: number;
  pendingOperations: PendingOperationEnvelope[];
  receiveQueue: SyncReceiveQueue;
  status: ClientMapSessionStatus;
};

export function createClientMapSession(clientId: string): ClientMapSession {
  return {
    clientId,
    operationCounter: 0,
    pendingOperations: [],
    receiveQueue: createSyncReceiveQueue(),
    status: "connecting"
  };
}

export function markSessionSocketOpened(session: ClientMapSession): void {
  clearSyncReceiveQueue(session.receiveQueue);
  session.pendingOperations = markAllPendingOperationsUnsent(session.pendingOperations);
  session.status = "connecting";
}

export function markSessionSocketClosed(session: ClientMapSession): void {
  session.status = "connecting";
}

export function markSessionError(session: ClientMapSession): void {
  session.status = "error";
}

export function resetSessionFromSnapshot(session: ClientMapSession, lastSequence: number): void {
  resetSyncReceiveQueueFromSnapshot(session.receiveQueue, lastSequence);
  session.status = session.pendingOperations.length > 0 ? "saving" : "saved";
}

export function queueSessionLocalOperations(
  session: ClientMapSession,
  operations: MapOperation[],
  nowMs: number
): PendingOperationEnvelope[] {
  const envelopes: PendingOperationEnvelope[] = [];

  for (const operation of operations) {
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
  session: ClientMapSession,
  maxOperationsPerBatch: number
): PendingOperationEnvelope[][] {
  return getUnsentOperationBatches(session.pendingOperations, maxOperationsPerBatch);
}

export function markSessionOperationsSent(session: ClientMapSession, envelopes: PendingOperationEnvelope[]): void {
  markPendingOperationsSent(envelopes);
  session.status = session.pendingOperations.length > 0 ? "saving" : "saved";
}

export function acknowledgeSessionOperation(session: ClientMapSession, operationId: string): boolean {
  const acknowledged = acknowledgePendingOperation(session.pendingOperations, operationId);
  session.status = session.pendingOperations.length > 0 ? "saving" : "saved";
  return acknowledged;
}

export function enqueueSessionOperation(
  session: ClientMapSession,
  payload: MapOperationMessage
): EnqueueReceivedOperationResult {
  return enqueueReceivedOperation(session.receiveQueue, payload);
}

export function takeReadySessionOperations(session: ClientMapSession): Array<{ sequence: number; message: MapOperationMessage }> {
  return takeReadyReceivedOperations(session.receiveQueue);
}

export function clearClientMapSession(session: ClientMapSession): void {
  clearSyncReceiveQueue(session.receiveQueue);
  session.status = "connecting";
}

export function isSessionReadyForSend(session: ClientMapSession): boolean {
  return session.receiveQueue.expectedSequence !== null;
}
