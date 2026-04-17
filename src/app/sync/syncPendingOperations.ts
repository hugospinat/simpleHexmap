import type { MapOperationEnvelope } from "@/core/protocol";

export type PendingOperationEnvelope = MapOperationEnvelope & {
  sent: boolean;
};

export function acknowledgePendingOperation(queue: PendingOperationEnvelope[], operationId: string): boolean {
  const index = queue.findIndex((envelope) => envelope.operationId === operationId);

  if (index < 0) {
    return false;
  }

  queue.splice(index, 1);
  return true;
}

export function markAllPendingOperationsUnsent(queue: PendingOperationEnvelope[]): PendingOperationEnvelope[] {
  return queue.map((envelope) => ({
    ...envelope,
    sent: false
  }));
}

export function markPendingOperationsSent(queue: PendingOperationEnvelope[]): void {
  for (const envelope of queue) {
    envelope.sent = true;
  }
}

export function getUnsentOperationBatches(
  queue: PendingOperationEnvelope[],
  maxOperationsPerBatch: number
): PendingOperationEnvelope[][] {
  const unsent = queue.filter((envelope) => !envelope.sent);
  const batches: PendingOperationEnvelope[][] = [];

  for (let index = 0; index < unsent.length; index += maxOperationsPerBatch) {
    batches.push(unsent.slice(index, index + maxOperationsPerBatch));
  }

  return batches;
}
