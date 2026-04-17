import { describe, expect, it } from "vitest";
import type { MapOperationMessage } from "@/app/io/mapApi";
import {
  clearSyncReceiveQueue,
  createSyncReceiveQueue,
  enqueueReceivedOperation,
  resetSyncReceiveQueueFromSnapshot,
  takeReadyReceivedOperations
} from "@/app/sync/syncReceiveQueue";

function message(sequence: number, operationId = `op-${sequence}`): MapOperationMessage {
  return {
    type: "map_operation_applied",
    sequence,
    operationId,
    operation: { type: "rename_map", name: "Ignored by world reducer" },
    sourceClientId: "client-a",
    updatedAt: "2026-04-17T00:00:00.000Z"
  };
}

describe("syncReceiveQueue", () => {
  it("waits for a snapshot before accepting operations", () => {
    const queue = createSyncReceiveQueue();

    expect(enqueueReceivedOperation(queue, message(1))).toEqual({ status: "waiting_for_snapshot" });
    expect(takeReadyReceivedOperations(queue)).toEqual([]);
  });

  it("applies contiguous operations in sequence order after a snapshot", () => {
    const queue = createSyncReceiveQueue();
    resetSyncReceiveQueueFromSnapshot(queue, 2);

    expect(enqueueReceivedOperation(queue, message(4))).toMatchObject({
      status: "gap",
      expectedSequence: 3,
      receivedSequence: 4
    });
    expect(takeReadyReceivedOperations(queue)).toEqual([]);

    expect(enqueueReceivedOperation(queue, message(3))).toEqual({ status: "queued", expectedSequence: 3 });

    const ready = takeReadyReceivedOperations(queue);
    expect(ready.map((entry) => entry.sequence)).toEqual([3, 4]);
    expect(queue.expectedSequence).toBe(5);
    expect(queue.bufferedOperations.size).toBe(0);
  });

  it("identifies duplicate buffered operations and stale past sequences", () => {
    const queue = createSyncReceiveQueue();
    resetSyncReceiveQueueFromSnapshot(queue, 0);

    expect(enqueueReceivedOperation(queue, message(2))).toMatchObject({ status: "gap" });
    expect(enqueueReceivedOperation(queue, message(2, "op-2-duplicate"))).toEqual({
      status: "duplicate",
      expectedSequence: 1
    });

    expect(enqueueReceivedOperation(queue, message(1))).toEqual({ status: "queued", expectedSequence: 1 });
    expect(takeReadyReceivedOperations(queue).map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(enqueueReceivedOperation(queue, message(1, "op-1-replayed"))).toEqual({
      status: "past_sequence",
      expectedSequence: 3
    });
  });

  it("clears pending state when the socket lifecycle resets", () => {
    const queue = createSyncReceiveQueue();
    resetSyncReceiveQueueFromSnapshot(queue, 5);
    enqueueReceivedOperation(queue, message(7));

    clearSyncReceiveQueue(queue);

    expect(queue.expectedSequence).toBeNull();
    expect(queue.bufferedOperations.size).toBe(0);
  });
});
