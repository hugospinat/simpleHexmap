import { describe, expect, it } from "vitest";
import {
  addFaction,
  addRoadConnection,
  addTile,
  createEmptyWorld,
  getLevelMap,
  getRoadLevelMap
} from "@/core/map/world";
import { serializeWorld } from "@/app/document/worldMapCodec";
import { applyMapOperationToWorld } from "@/core/map/worldOperationApplier";
import {
  commandAddRoadConnection,
  commandAssignFaction,
  commandEraseTerrain,
  executeMapEditCommand,
  commandPaintTerrain,
  commandRemoveRoadConnectionsAt
} from "./mapEditCommands";

function applyCommandOperations(world: ReturnType<typeof createEmptyWorld>, operations: ReturnType<typeof commandPaintTerrain>["operations"]) {
  return operations.reduce(applyMapOperationToWorld, world);
}

describe("map edit commands", () => {
  it("paints terrain by emitting source-level set_tile operations", () => {
    const world = createEmptyWorld();
    const result = commandPaintTerrain(world, 2, { q: 0, r: 0 }, "forest");

    expect(result.operations).toHaveLength(7);
    expect(result.operations[0]).toMatchObject({
      type: "set_tile",
      tile: { terrain: "forest", hidden: true }
    });
    expect(serializeWorld(applyCommandOperations(world, result.operations))).toEqual(serializeWorld(result.mapState));
  });

  it("executes business-shaped map commands through one entrypoint", () => {
    const result = executeMapEditCommand(createEmptyWorld(), {
      type: "paintTerrain",
      level: 3,
      axial: { q: 0, r: 0 },
      terrainType: "plain"
    });

    expect(result.operations).toEqual([
      {
        type: "set_tile",
        tile: { q: 0, r: 0, terrain: "plain", hidden: true }
      }
    ]);
    expect(getLevelMap(result.mapState, 3).get("0,0")?.type).toBe("plain");
  });

  it("erases terrain with explicit delete operations", () => {
    const painted = commandPaintTerrain(createEmptyWorld(), 2, { q: 0, r: 0 }, "forest").mapState;
    const result = commandEraseTerrain(painted, 2, { q: 0, r: 0 });

    expect(result.operations).toHaveLength(7);
    expect(result.operations.every((operation) => operation.type === "set_tile" && operation.tile.terrain === null)).toBe(true);
    expect(getLevelMap(result.mapState, 3).size).toBe(0);
  });

  it("emits domain-shaped road operations instead of record diffs", () => {
    const added = commandAddRoadConnection(createEmptyWorld(), 3, { q: 0, r: 0 }, { q: 1, r: 0 });

    expect(added.operations).toEqual([
      {
        type: "add_road_connection",
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 }
      }
    ]);

    const removed = commandRemoveRoadConnectionsAt(added.mapState, 3, { q: 0, r: 0 });

    expect(removed.operations).toEqual([
      {
        type: "remove_road_connections_at",
        cell: { q: 0, r: 0 }
      }
    ]);
    expect(getRoadLevelMap(removed.mapState, 3).size).toBe(0);
  });

  it("assigns factions only to existing source cells", () => {
    const withTile = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const withFaction = addFaction(withTile, { id: "f-1", name: "North", color: "#112233" });
    const result = commandAssignFaction(withFaction, 2, { q: 0, r: 0 }, "f-1");

    expect(result.operations).toEqual([
      {
        type: "set_faction_territory",
        territory: { q: 0, r: 0, factionId: "f-1" }
      }
    ]);
  });

  it("applies new road operations through the world reducer", () => {
    const withRoad = applyMapOperationToWorld(createEmptyWorld(), {
      type: "add_road_connection",
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 }
    });
    const withoutRoad = applyMapOperationToWorld(withRoad, {
      type: "remove_road_connections_at",
      cell: { q: 0, r: 0 }
    });

    expect(getRoadLevelMap(withRoad, 3).size).toBe(2);
    expect(getRoadLevelMap(withoutRoad, 3).size).toBe(0);
  });
});
