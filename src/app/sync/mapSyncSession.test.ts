import { describe, expect, it } from "vitest";
import type { MapOperationMessage } from "@/app/api/mapApi";
import {
  applyReadySessionOperations,
  commitSessionLocalOperations,
  createMapSyncSession,
  enqueueSessionOperation,
  getSessionUnsentOperationBatches,
  markSessionOperationsSent,
  markSessionSocketOpened,
  resetSessionFromSnapshot
} from "@/app/sync/mapSyncSession";
import {
  addTile,
  createEmptyWorld,
  getLevelMap,
  type MapState
} from "@/core/map/world";

function tileMessage(
  sequence: number,
  operationId: string,
  q: number,
  terrain: string,
  sourceClientId = "client-other"
): MapOperationMessage {
  return {
    type: "map_operation_applied",
    sequence,
    operationId,
    operation: {
      type: "set_tile",
      tile: { q, r: 0, terrain, hidden: false }
    },
    sourceClientId,
    updatedAt: "2026-04-17T00:00:00.000Z"
  };
}

function terrainAt(world: MapState, q: number): string | null {
  return getLevelMap(world, 3).get(`${q},0`)?.type ?? null;
}

describe("mapSyncSession", () => {
  it("queues local operations with stable client-scoped ids and batch boundaries", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());
    const operations = Array.from({ length: 501 }, (_, index) => ({ type: "rename_map" as const, name: `Map ${index}` }));

    const envelopes = commitSessionLocalOperations(session, operations, 100);
    const batches = getSessionUnsentOperationBatches(session, 500);

    expect(envelopes[0].operationId).toBe("client-a-100-1");
    expect(batches.map((batch) => batch.length)).toEqual([500, 1]);
    expect(session.status).toBe("saving");
  });

  it("applies local operations immediately to the visible world", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());

    commitSessionLocalOperations(session, [
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    ], 100);

    expect(terrainAt(session.confirmedWorld, 0)).toBeNull();
    expect(terrainAt(session.visibleWorld, 0)).toBe("forest");
  });

  it("coalesces redundant adjacent local operations before assigning operation ids", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());

    const envelopes = commitSessionLocalOperations(session, [
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "plain", hidden: false } },
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    ], 100);

    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]).toMatchObject({
      operationId: "client-a-100-1",
      operation: { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    });
    expect(terrainAt(session.visibleWorld, 0)).toBe("forest");
  });

  it("marks sent operations unsent again when the socket reconnects", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());
    const [envelope] = commitSessionLocalOperations(session, [{ type: "rename_map", name: "A" }], 1);
    markSessionOperationsSent(session, [envelope]);

    expect(session.pendingOperations[0].sent).toBe(true);

    markSessionSocketOpened(session);

    expect(session.pendingOperations[0].sent).toBe(false);
    expect(session.receiveQueue.expectedSequence).toBeNull();
  });

  it("applies local echo to confirmed world without double-applying visible world", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());
    resetSessionFromSnapshot(session, createEmptyWorld(), 0);
    const [envelope] = commitSessionLocalOperations(session, [
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    ], 100);

    enqueueSessionOperation(session, tileMessage(1, envelope.operationId, 0, "forest", "client-a"));
    const applied = applyReadySessionOperations(session);

    expect(applied).toMatchObject([{ acknowledgedLocal: true, sequence: 1 }]);
    expect(session.pendingOperations).toEqual([]);
    expect(terrainAt(session.confirmedWorld, 0)).toBe("forest");
    expect(terrainAt(session.visibleWorld, 0)).toBe("forest");
    expect(session.status).toBe("saved");
  });

  it("rebases pending local operations over remote operations", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());
    resetSessionFromSnapshot(session, createEmptyWorld(), 0);
    commitSessionLocalOperations(session, [
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    ], 100);

    enqueueSessionOperation(session, tileMessage(1, "remote-1", 1, "hill"));
    applyReadySessionOperations(session);

    expect(terrainAt(session.confirmedWorld, 0)).toBeNull();
    expect(terrainAt(session.confirmedWorld, 1)).toBe("hill");
    expect(terrainAt(session.visibleWorld, 0)).toBe("forest");
    expect(terrainAt(session.visibleWorld, 1)).toBe("hill");
    expect(session.pendingOperations).toHaveLength(1);
  });

  it("replays pending local operations after a reconnect snapshot", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());
    commitSessionLocalOperations(session, [
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } }
    ], 100);
    const snapshotWorld = addTile(createEmptyWorld(), 3, { q: 1, r: 0 }, "hill");

    resetSessionFromSnapshot(session, snapshotWorld, 12);

    expect(session.receiveQueue.expectedSequence).toBe(13);
    expect(terrainAt(session.confirmedWorld, 0)).toBeNull();
    expect(terrainAt(session.confirmedWorld, 1)).toBe("hill");
    expect(terrainAt(session.visibleWorld, 0)).toBe("forest");
    expect(terrainAt(session.visibleWorld, 1)).toBe("hill");
  });

  it("buffers out-of-order remote operations until contiguous", () => {
    const session = createMapSyncSession("client-a", createEmptyWorld());
    resetSessionFromSnapshot(session, createEmptyWorld(), 2);

    expect(enqueueSessionOperation(session, tileMessage(4, "op-4", 4, "hill"))).toMatchObject({ status: "gap" });
    expect(applyReadySessionOperations(session)).toEqual([]);
    expect(enqueueSessionOperation(session, tileMessage(3, "op-3", 3, "plain"))).toMatchObject({ status: "queued" });
    expect(applyReadySessionOperations(session).map((entry) => entry.sequence)).toEqual([3, 4]);
  });
});
