import { describe, expect, test } from "vitest";
import {
  addFaction,
  addFeature,
  addRoadConnection,
  addRiverEdge,
  addTile,
  assignFactionAt,
  createEmptyWorld,
  setCellHidden,
  updateFeature,
  type World
} from "@/domain/world/world";
import { applyMapOperation, applyMapOperationToWorld, diffWorldAsOperations, type MapOperation } from "@/app/io/mapOperations";
import { deserializeWorld, serializeWorld } from "@/app/io/mapFormat";

function createSampleWorld(): World {
  let world = createEmptyWorld();

  world = addTile(world, 3, { q: 0, r: 0 }, "plain");
  world = addTile(world, 3, { q: 1, r: 0 }, "forest");
  world = addTile(world, 3, { q: 0, r: 1 }, "hill");
  world = addFaction(world, { id: "f-1", name: "North", color: "#123456" });
  world = addFaction(world, { id: "f-2", name: "South", color: "#654321" });
  world = assignFactionAt(world, 3, { q: 0, r: 0 }, "f-1");
  world = addFeature(world, 3, {
    id: "feature-1",
    kind: "city",
    hexId: "0,0",
    hidden: false,
    overrideTerrainTile: true,
    labelRevealed: true,
    gmLabel: "GM",
    playerLabel: "City"
  });
  world = addFeature(world, 3, {
    id: "feature-2",
    kind: "village",
    hexId: "1,0",
    hidden: false,
    overrideTerrainTile: false,
    labelRevealed: false
  });
  world = addRiverEdge(world, 3, {
    axial: { q: 0, r: 0 },
    edge: 1
  });
  world = addRoadConnection(world, 3, { q: 0, r: 0 }, { q: 1, r: 0 });

  return world;
}

function applyLegacyRoundTrip(world: World, operation: MapOperation): World {
  return deserializeWorld(applyMapOperation(serializeWorld(world), operation));
}

function expectDirectParity(world: World, operation: MapOperation) {
  const direct = applyMapOperationToWorld(world, operation);
  const legacy = applyLegacyRoundTrip(world, operation);

  expect(serializeWorld(direct)).toEqual(serializeWorld(legacy));
}

describe("mapOperations", () => {
  test("set_tile updates snapshots incrementally", () => {
    const empty = serializeWorld(createEmptyWorld());
    const updated = applyMapOperation(empty, {
      type: "set_tile",
      tile: { q: 2, r: 1, tileId: "forest", hidden: false }
    });

    expect(updated.tiles).toEqual([{ q: 2, r: 1, tileId: "forest", hidden: false }]);
  });

  test("world diffs emit targeted operations", () => {
    const previous = createEmptyWorld();
    const nextWorld = addTile(previous, 3, { q: 0, r: 0 }, "plain");

    const operations = diffWorldAsOperations(previous, nextWorld);
    expect(operations).toEqual([
      {
        type: "set_tile",
        tile: { q: 0, r: 0, tileId: "plain", hidden: false }
      }
    ]);
  });

  test("world diffs emit set_cell_hidden for fog changes", () => {
    const previous = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const next = setCellHidden(previous, 3, { q: 0, r: 0 }, true);

    expect(diffWorldAsOperations(previous, next)).toEqual([
      {
        type: "set_cell_hidden",
        cell: { q: 0, r: 0, hidden: true }
      }
    ]);
  });

  test("world diffs emit set_feature_hidden for feature fog changes", () => {
    const previous = addFeature(createEmptyWorld(), 3, {
      id: "f-1",
      kind: "city",
      hexId: "0,0",
      hidden: false
    });
    const next = updateFeature(previous, 3, "f-1", { hidden: true });

    expect(diffWorldAsOperations(previous, next)).toEqual([
      {
        type: "set_feature_hidden",
        featureId: "f-1",
        hidden: true
      }
    ]);
  });

  test("applyMapOperationToWorld matches legacy round-trip for set_tile and hidden operations", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "set_tile",
      tile: { q: 2, r: -1, tileId: "mountain", hidden: true }
    });
    expectDirectParity(world, {
      type: "set_tile",
      tile: { q: 0, r: 0, tileId: null, hidden: false }
    });
    expectDirectParity(world, {
      type: "set_cell_hidden",
      cell: { q: 1, r: 0, hidden: true }
    });
  });

  test("applyMapOperationToWorld matches legacy round-trip for feature operations", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "add_feature",
      feature: {
        id: "feature-new",
        type: "tower",
        q: 2,
        r: 0,
        visibility: "visible",
        overrideTerrainTile: true,
        gmLabel: "Watch",
        playerLabel: null,
        labelRevealed: false
      }
    });
    expectDirectParity(world, {
      type: "set_feature_hidden",
      featureId: "feature-1",
      hidden: true
    });
    expectDirectParity(world, {
      type: "update_feature",
      featureId: "feature-1",
      patch: {
        type: "capital",
        visibility: "hidden",
        gmLabel: null,
        playerLabel: "Capital",
        labelRevealed: false,
        overrideTerrainTile: false
      }
    });
    expectDirectParity(world, {
      type: "remove_feature",
      featureId: "feature-2"
    });
  });

  test("applyMapOperationToWorld matches legacy round-trip for rivers and roads", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "add_river_data",
      river: { q: 1, r: 0, edge: 0 }
    });
    expectDirectParity(world, {
      type: "update_river_data",
      from: { q: 0, r: 0, edge: 1 },
      to: { q: 1, r: 0, edge: 2 }
    });
    expectDirectParity(world, {
      type: "remove_river_data",
      river: { q: 0, r: 0, edge: 1 }
    });
    expectDirectParity(world, {
      type: "add_road_data",
      road: { q: 0, r: 0, edges: [2, 0, 2] }
    });
    expectDirectParity(world, {
      type: "update_road_data",
      road: { q: 0, r: 0, edges: [1, 4] }
    });
    expectDirectParity(world, {
      type: "remove_road_data",
      road: { q: 0, r: 0 }
    });
  });

  test("applyMapOperationToWorld matches legacy round-trip for faction operations and rename no-op", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "add_faction",
      faction: { id: "f-3", name: "East", color: "#abcdef" }
    });
    expectDirectParity(world, {
      type: "update_faction",
      factionId: "f-1",
      patch: { name: "North Prime", color: "#112233" }
    });
    expectDirectParity(world, {
      type: "set_faction_territory",
      territory: { q: 1, r: 0, factionId: "f-2" }
    });
    expectDirectParity(world, {
      type: "set_faction_territory",
      territory: { q: 0, r: 0, factionId: null }
    });
    expectDirectParity(world, {
      type: "remove_faction",
      factionId: "f-1"
    });
    expectDirectParity(world, {
      type: "rename_map",
      name: "New name"
    });
  });

  test("applyMapOperationToWorld preserves ordered mixed operation semantics", () => {
    const operations: MapOperation[] = [
      { type: "set_tile", tile: { q: 2, r: -1, tileId: "desert", hidden: false } },
      {
        type: "add_feature",
        feature: {
          id: "feature-seq",
          type: "marker",
          q: 2,
          r: -1,
          visibility: "visible",
          overrideTerrainTile: false,
          gmLabel: "A",
          playerLabel: null,
          labelRevealed: false
        }
      },
      { type: "set_faction_territory", territory: { q: 2, r: -1, factionId: "f-2" } },
      { type: "set_cell_hidden", cell: { q: 2, r: -1, hidden: true } },
      { type: "set_tile", tile: { q: 0, r: 0, tileId: null, hidden: false } },
      { type: "remove_road_data", road: { q: 0, r: 0 } },
      { type: "update_faction", factionId: "f-2", patch: { name: "South Prime" } }
    ];

    const direct = operations.reduce((current, operation) => applyMapOperationToWorld(current, operation), createSampleWorld());
    const legacy = operations.reduce((current, operation) => applyLegacyRoundTrip(current, operation), createSampleWorld());

    expect(serializeWorld(direct)).toEqual(serializeWorld(legacy));
  });
});
