import { describe, expect, it } from "vitest";
import type { PendingOperationEnvelope } from "@/app/sync/syncPendingOperations";
import {
  acknowledgePendingOperation,
  getUnsentOperationBatches,
  markAllPendingOperationsUnsent,
  markPendingOperationsSent,
} from "@/app/sync/syncPendingOperations";

function envelope(operationId: string, sent = false): PendingOperationEnvelope {
  return {
    operationId,
    operation: {
      type: "add_faction",
      faction: { id: operationId, name: operationId, color: "#112233" },
    },
    sent,
  };
}

describe("syncPendingOperations", () => {
  it("acknowledges pending operations by id", () => {
    const queue = [envelope("op-a"), envelope("op-b")];

    expect(acknowledgePendingOperation(queue, "op-a")).toBe(true);
    expect(queue.map((item) => item.operationId)).toEqual(["op-b"]);
    expect(acknowledgePendingOperation(queue, "missing")).toBe(false);
  });

  it("marks all operations unsent after reconnect", () => {
    const queue = [envelope("op-a", true), envelope("op-b", false)];

    expect(markAllPendingOperationsUnsent(queue)).toEqual([
      envelope("op-a", false),
      envelope("op-b", false),
    ]);
  });

  it("returns only unsent operations split by batch size", () => {
    const queue = Array.from({ length: 1001 }, (_, index) =>
      envelope(`op-${index}`, index % 250 === 0),
    );
    const batches = getUnsentOperationBatches(queue, 500);

    expect(batches.map((batch) => batch.length)).toEqual([500, 496]);
    expect(batches.flat().every((item) => !item.sent)).toBe(true);
  });

  it("marks selected unsent operations as sent", () => {
    const queue = [envelope("op-a"), envelope("op-b")];

    markPendingOperationsSent(queue);

    expect(queue.every((item) => item.sent)).toBe(true);
  });
});
