import { describe, expect, test } from "vitest";
import {
  addFaction,
  addFeature,
  addRoadConnection,
  addRiverEdge,
  addTile,
  assignFactionAt,
  createEmptyWorld,
  type MapState,
} from "@/core/map/world";
import {
  applyMapOperation,
  applyMapOperations,
  type MapOperation,
} from "@/core/protocol";
import { applyMapOperationToWorld } from "@/core/map/worldOperationApplier";
import { deserializeWorld, serializeWorld } from "@/app/document/worldMapCodec";

function createSampleWorld(): MapState {
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
    playerLabel: "City",
  });
  world = addFeature(world, 3, {
    id: "feature-2",
    kind: "village",
    hexId: "1,0",
    hidden: false,
    overrideTerrainTile: false,
    labelRevealed: false,
  });
  world = addRiverEdge(world, 3, {
    axial: { q: 0, r: 0 },
    edge: 1,
  });
  world = addRoadConnection(world, 3, { q: 0, r: 0 }, { q: 1, r: 0 });

  return world;
}

function applySavedMapContentRoundTrip(
  world: MapState,
  operation: MapOperation,
): MapState {
  return deserializeWorld(applyMapOperation(serializeWorld(world), operation));
}

function expectDirectParity(world: MapState, operation: MapOperation) {
  const direct = applyMapOperationToWorld(world, operation);
  const roundTrip = applySavedMapContentRoundTrip(world, operation);

  expect(serializeWorld(direct)).toEqual(serializeWorld(roundTrip));
}

describe("operation applier parity", () => {
  test("set_tiles updates snapshots incrementally", () => {
    const empty = serializeWorld(createEmptyWorld());
    const updated = applyMapOperation(empty, {
      type: "set_tiles",
      tiles: [{ q: 2, r: 1, terrain: "forest", hidden: false }],
    });

    expect(updated.tiles).toEqual([
      { q: 2, r: 1, terrain: "forest", hidden: false },
    ]);
  });

  test("applyMapOperationToWorld matches saved-map round-trip for semantic tile and hidden operations", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "set_tiles",
      tiles: [{ q: 2, r: -1, terrain: "mountain", hidden: true }],
    });
    expectDirectParity(world, {
      type: "set_tiles",
      tiles: [{ q: 0, r: 0, terrain: null, hidden: false }],
    });
    expectDirectParity(world, {
      type: "set_cells_hidden",
      cells: [{ q: 1, r: 0 }],
      hidden: true,
    });
  });

  test("applyMapOperationToWorld matches saved-map round-trip for feature operations", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "add_feature",
      feature: {
        id: "feature-new",
        kind: "tower",
        q: 2,
        r: 0,
        visibility: "visible",
        overrideTerrainTile: true,
        gmLabel: "Watch",
        playerLabel: null,
        labelRevealed: false,
      },
    });
    expectDirectParity(world, {
      type: "set_feature_hidden",
      featureId: "feature-1",
      hidden: true,
    });
    expectDirectParity(world, {
      type: "update_feature",
      featureId: "feature-1",
      patch: {
        kind: "capital",
        visibility: "hidden",
        gmLabel: null,
        playerLabel: "Capital",
        labelRevealed: false,
        overrideTerrainTile: false,
      },
    });
    expectDirectParity(world, {
      type: "remove_feature",
      featureId: "feature-2",
    });
  });

  test("applyMapOperationToWorld matches saved-map round-trip for rivers and roads", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "add_river_data",
      river: { q: 1, r: 0, edge: 0 },
    });
    expectDirectParity(world, {
      type: "remove_river_data",
      river: { q: 0, r: 0, edge: 1 },
    });
    expectDirectParity(world, {
      type: "set_road_edges",
      cell: { q: 0, r: 0 },
      edges: [0, 2],
    });
    expectDirectParity(world, {
      type: "set_road_edges",
      cell: { q: 0, r: 0 },
      edges: [1, 4],
    });
    expectDirectParity(world, {
      type: "set_road_edges",
      cell: { q: 0, r: 0 },
      edges: [],
    });
  });

  test("applyMapOperationToWorld matches saved-map round-trip for faction operations and rename no-op", () => {
    const world = createSampleWorld();

    expectDirectParity(world, {
      type: "add_faction",
      faction: { id: "f-3", name: "East", color: "#abcdef" },
    });
    expectDirectParity(world, {
      type: "update_faction",
      factionId: "f-1",
      patch: { name: "North Prime", color: "#112233" },
    });
    expectDirectParity(world, {
      type: "set_faction_territories",
      territories: [{ q: 1, r: 0, factionId: "f-2" }],
    });
    expectDirectParity(world, {
      type: "set_faction_territories",
      territories: [{ q: 0, r: 0, factionId: null }],
    });
    expectDirectParity(world, {
      type: "remove_faction",
      factionId: "f-1",
    });
    expectDirectParity(world, {
      type: "rename_map",
      name: "New name",
    });
  });

  test("applyMapOperationToWorld preserves ordered mixed operation semantics", () => {
    const operations: MapOperation[] = [
      {
        type: "set_tiles",
        tiles: [{ q: 2, r: -1, terrain: "desert", hidden: false }],
      },
      {
        type: "add_feature",
        feature: {
          id: "feature-seq",
          kind: "marker",
          q: 2,
          r: -1,
          visibility: "visible",
          overrideTerrainTile: false,
          gmLabel: "A",
          playerLabel: null,
          labelRevealed: false,
        },
      },
      {
        type: "set_faction_territories",
        territories: [{ q: 2, r: -1, factionId: "f-2" }],
      },
      { type: "set_cells_hidden", cells: [{ q: 2, r: -1 }], hidden: true },
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: null, hidden: false }],
      },
      { type: "set_road_edges", cell: { q: 0, r: 0 }, edges: [] },
      {
        type: "update_faction",
        factionId: "f-2",
        patch: { name: "South Prime" },
      },
    ];

    const direct = operations.reduce(
      (current, operation) => applyMapOperationToWorld(current, operation),
      createSampleWorld(),
    );
    const roundTrip = operations.reduce(
      (current, operation) => applySavedMapContentRoundTrip(current, operation),
      createSampleWorld(),
    );

    expect(serializeWorld(direct)).toEqual(serializeWorld(roundTrip));
  });

  test("applyMapOperations preserves ordered saved-map batch semantics", () => {
    const snapshot = serializeWorld(createSampleWorld());
    const operations: MapOperation[] = [
      {
        type: "set_tiles",
        tiles: [{ q: 2, r: -1, terrain: "desert", hidden: false }],
      },
      {
        type: "set_tiles",
        tiles: [{ q: 2, r: -1, terrain: "forest", hidden: true }],
      },
      { type: "set_cells_hidden", cells: [{ q: 2, r: -1 }], hidden: false },
      {
        type: "add_feature",
        feature: {
          id: "feature-seq",
          kind: "marker",
          q: 2,
          r: -1,
          visibility: "visible",
          overrideTerrainTile: false,
          gmLabel: "A",
          playerLabel: null,
          labelRevealed: false,
        },
      },
      {
        type: "update_feature",
        featureId: "feature-seq",
        patch: { gmLabel: "B" },
      },
      {
        type: "set_faction_territories",
        territories: [{ q: 2, r: -1, factionId: "f-2" }],
      },
      {
        type: "set_faction_territories",
        territories: [{ q: 2, r: -1, factionId: null }],
      },
      { type: "remove_feature", featureId: "feature-2" },
    ];

    const reduced = operations.reduce(
      (current, operation) => applyMapOperation(current, operation),
      snapshot,
    );

    expect(applyMapOperations(snapshot, operations)).toEqual(reduced);
  });
});
