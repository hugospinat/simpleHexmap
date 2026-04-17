import type { MapOperationMessage } from "@/app/api/mapApi";

export type SyncReceiveQueue = {
  expectedSequence: number | null;
  bufferedOperations: Map<number, MapOperationMessage>;
};

export type EnqueueReceivedOperationResult =
  | { status: "invalid" }
  | { status: "waiting_for_snapshot" }
  | { status: "past_sequence"; expectedSequence: number }
  | { status: "queued"; expectedSequence: number }
  | { status: "duplicate"; expectedSequence: number }
  | { status: "gap"; expectedSequence: number; receivedSequence: number; bufferedWaiting: number };

export function createSyncReceiveQueue(): SyncReceiveQueue {
  return {
    expectedSequence: null,
    bufferedOperations: new Map()
  };
}

export function clearSyncReceiveQueue(queue: SyncReceiveQueue): void {
  queue.expectedSequence = null;
  queue.bufferedOperations.clear();
}

export function resetSyncReceiveQueueFromSnapshot(queue: SyncReceiveQueue, lastSequence: number): void {
  queue.expectedSequence = lastSequence + 1;
  queue.bufferedOperations.clear();
}

export function enqueueReceivedOperation(
  queue: SyncReceiveQueue,
  payload: MapOperationMessage
): EnqueueReceivedOperationResult {
  if (typeof payload.operationId !== "string" || !payload.operationId || !Number.isInteger(payload.sequence) || payload.sequence <= 0) {
    return { status: "invalid" };
  }

  if (queue.expectedSequence === null) {
    return { status: "waiting_for_snapshot" };
  }

  if (payload.sequence < queue.expectedSequence) {
    return { status: "past_sequence", expectedSequence: queue.expectedSequence };
  }

  if (queue.bufferedOperations.has(payload.sequence)) {
    return { status: "duplicate", expectedSequence: queue.expectedSequence };
  }

  queue.bufferedOperations.set(payload.sequence, payload);

  if (payload.sequence > queue.expectedSequence) {
    return {
      status: "gap",
      expectedSequence: queue.expectedSequence,
      receivedSequence: payload.sequence,
      bufferedWaiting: queue.bufferedOperations.size
    };
  }

  return { status: "queued", expectedSequence: queue.expectedSequence };
}

export function takeReadyReceivedOperations(queue: SyncReceiveQueue): Array<{ sequence: number; message: MapOperationMessage }> {
  const ready: Array<{ sequence: number; message: MapOperationMessage }> = [];

  while (queue.expectedSequence !== null) {
    const expectedSequence = queue.expectedSequence;
    const nextMessage = queue.bufferedOperations.get(expectedSequence);

    if (!nextMessage) {
      break;
    }

    queue.bufferedOperations.delete(expectedSequence);
    queue.expectedSequence = expectedSequence + 1;
    ready.push({ sequence: expectedSequence, message: nextMessage });
  }

  return ready;
}
