import { describe, expect, it } from "vitest";
import type { MapOperationMessage } from "@/app/api/mapApi";
import {
  acknowledgeSessionOperation,
  createMapSyncSession,
  enqueueSessionOperation,
  getSessionUnsentOperationBatches,
  markSessionSocketOpened,
  markSessionOperationsSent,
  queueSessionLocalOperations,
  resetSessionFromSnapshot,
  takeReadySessionOperations
} from "@/app/sync/mapSyncSession";

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

describe("mapSyncSession", () => {
  it("queues local operations with stable client-scoped ids and batch boundaries", () => {
    const session = createMapSyncSession("client-a");
    const operations = Array.from({ length: 501 }, (_, index) => ({ type: "rename_map" as const, name: `Map ${index}` }));

    const envelopes = queueSessionLocalOperations(session, operations, 100);
    const batches = getSessionUnsentOperationBatches(session, 500);

    expect(envelopes[0].operationId).toBe("client-a-100-1");
    expect(batches.map((batch) => batch.length)).toEqual([500, 1]);
    expect(session.status).toBe("saving");
  });

  it("coalesces redundant adjacent local operations before assigning operation ids", () => {
    const session = createMapSyncSession("client-a");

    const envelopes = queueSessionLocalOperations(session, [
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "plain", hidden: false } },
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    ], 100);

    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]).toMatchObject({
      operationId: "client-a-100-1",
      operation: { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    });
  });

  it("marks sent operations unsent again when the socket reconnects", () => {
    const session = createMapSyncSession("client-a");
    const [envelope] = queueSessionLocalOperations(session, [{ type: "rename_map", name: "A" }], 1);
    markSessionOperationsSent(session, [envelope]);

    expect(session.pendingOperations[0].sent).toBe(true);

    markSessionSocketOpened(session);

    expect(session.pendingOperations[0].sent).toBe(false);
    expect(session.receiveQueue.expectedSequence).toBeNull();
  });

  it("orders remote operations after a snapshot and acknowledges local echoes", () => {
    const session = createMapSyncSession("client-a");
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
