import { describe, expect, it } from "vitest";
import type { MapOperationMessage } from "@/app/io/mapApi";
import {
  acknowledgeSessionOperation,
  createClientMapSession,
  enqueueSessionOperation,
  getSessionUnsentOperationBatches,
  markSessionSocketOpened,
  markSessionOperationsSent,
  queueSessionLocalOperations,
  resetSessionFromSnapshot,
  takeReadySessionOperations
} from "@/app/sync/clientMapSession";

function message(sequence: number, operationId = `op-${sequence}`): MapOperationMessage {
  return {
    type: "map_operation_applied",
    sequence,
    operationId,
    operation: { type: "rename_map", name: operationId },
    sourceClientId: "client-other",
    updatedAt: "2026-04-17T00:00:00.000Z"
  };
}

describe("clientMapSession", () => {
  it("queues local operations with stable client-scoped ids and batch boundaries", () => {
    const session = createClientMapSession("client-a");
    const operations = Array.from({ length: 501 }, (_, index) => ({ type: "rename_map" as const, name: `Map ${index}` }));

    const envelopes = queueSessionLocalOperations(session, operations, 100);
    const batches = getSessionUnsentOperationBatches(session, 500);

    expect(envelopes[0].operationId).toBe("client-a-100-1");
    expect(batches.map((batch) => batch.length)).toEqual([500, 1]);
    expect(session.status).toBe("saving");
  });

  it("marks sent operations unsent again when the socket reconnects", () => {
    const session = createClientMapSession("client-a");
    const [envelope] = queueSessionLocalOperations(session, [{ type: "rename_map", name: "A" }], 1);
    markSessionOperationsSent(session, [envelope]);

    expect(session.pendingOperations[0].sent).toBe(true);

    markSessionSocketOpened(session);

    expect(session.pendingOperations[0].sent).toBe(false);
    expect(session.receiveQueue.expectedSequence).toBeNull();
  });

  it("orders remote operations after a snapshot and acknowledges local echoes", () => {
    const session = createClientMapSession("client-a");
    resetSessionFromSnapshot(session, 2);

    expect(enqueueSessionOperation(session, message(4))).toMatchObject({ status: "gap" });
    expect(takeReadySessionOperations(session)).toEqual([]);
    expect(enqueueSessionOperation(session, message(3))).toMatchObject({ status: "queued" });
    expect(takeReadySessionOperations(session).map((entry) => entry.sequence)).toEqual([3, 4]);

    queueSessionLocalOperations(session, [{ type: "rename_map", name: "Local" }], 2);
    const localId = session.pendingOperations[0].operationId;

    expect(acknowledgeSessionOperation(session, localId)).toBe(true);
    expect(session.pendingOperations).toEqual([]);
    expect(session.status).toBe("saved");
  });
});
