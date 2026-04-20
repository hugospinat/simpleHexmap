import { describe, expect, it } from "vitest";
import { serializeWorld } from "@/app/document/worldMapCodec";
import { applyOperationsToWorld } from "@/core/map/worldOperationApplier";
import {
  addFaction,
  addFeature,
  addRoadConnection,
  addTile,
  assignFactionAt,
  createEmptyWorld,
  removeFaction,
  removeFeatureAt,
  removeRoadConnectionsAt,
  type MapState,
} from "@/core/map/world";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { invertOperationBatch } from "@/core/map/history/mapOperationHistory";
import type { MapOperation } from "@/core/protocol";

function expectUndoRestoresWorld(
  worldBefore: MapState,
  operations: MapOperation[],
) {
  const worldAfter = applyOperationsToWorld(worldBefore, operations);
  const undoOperations = invertOperationBatch(worldBefore, operations);

  expect(undoOperations.length).toBeGreaterThan(0);
  expect(
    serializeWorld(applyOperationsToWorld(worldAfter, undoOperations)),
  ).toEqual(serializeWorld(worldBefore));
}

describe("map operation history", () => {
  it("inverts semantic paint_cells operations", () => {
    const worldBefore = addTile(
      createEmptyWorld(),
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      "plain",
    );

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "paint_cells",
        cells: [
          { q: 0, r: 0 },
          { q: 1, r: 0 },
        ],
        terrain: "forest",
        hidden: false,
      },
    ]);
  });

  it("inverts semantic assign_faction_cells operations", () => {
    const withTiles = addTile(
      addTile(createEmptyWorld(), SOURCE_LEVEL, { q: 0, r: 0 }, "plain"),
      SOURCE_LEVEL,
      { q: 1, r: 0 },
      "plain",
    );
    const withFaction = addFaction(withTiles, {
      id: "f-1",
      name: "North",
      color: "#112233",
    });
    const worldBefore = assignFactionAt(
      withFaction,
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      "f-1",
    );

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "assign_faction_cells",
        cells: [
          { q: 0, r: 0 },
          { q: 1, r: 0 },
        ],
        factionId: null,
      },
    ]);
  });

  it("inverts terrain removal and restores faction ownership on the tile", () => {
    const withTile = addTile(
      createEmptyWorld(),
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      "plain",
    );
    const withFaction = addFaction(withTile, {
      id: "f-1",
      name: "North",
      color: "#112233",
    });
    const worldBefore = assignFactionAt(
      withFaction,
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      "f-1",
    );

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: null, hidden: false }],
      },
    ]);
  });

  it("inverts feature removal by re-adding the previous feature record", () => {
    const worldBefore = addFeature(createEmptyWorld(), SOURCE_LEVEL, {
      id: "feature-1",
      kind: "city",
      hexId: "0,0",
      hidden: true,
      overrideTerrainTile: true,
      gmLabel: "GM",
      playerLabel: "Player",
      labelRevealed: true,
    });

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "remove_feature",
        featureId: "feature-1",
      },
    ]);
  });

  it("inverts road edge removals by restoring the previous road records", () => {
    const withFirstRoad = addRoadConnection(
      createEmptyWorld(),
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    );
    const worldBefore = addRoadConnection(
      withFirstRoad,
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      { q: 0, r: 1 },
    );

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "set_road_edges",
        cell: { q: 0, r: 0 },
        edges: [],
      },
    ]);
  });

  it("inverts faction deletion by restoring the faction and its territories", () => {
    const withTile = addTile(
      createEmptyWorld(),
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      "plain",
    );
    const withFaction = addFaction(withTile, {
      id: "f-1",
      name: "North",
      color: "#112233",
    });
    const worldBefore = assignFactionAt(
      withFaction,
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      "f-1",
    );
    const operation: MapOperation = {
      type: "remove_faction",
      factionId: "f-1",
    };

    expect(
      serializeWorld(applyOperationsToWorld(worldBefore, [operation])),
    ).toEqual(serializeWorld(removeFaction(worldBefore, "f-1")));
    expectUndoRestoresWorld(worldBefore, [operation]);
  });

  it("inverts mixed batches in reverse order", () => {
    const withTile = addTile(
      createEmptyWorld(),
      SOURCE_LEVEL,
      { q: 0, r: 0 },
      "plain",
    );
    const worldBefore = addFeature(withTile, SOURCE_LEVEL, {
      id: "feature-1",
      kind: "city",
      hexId: "0,0",
      hidden: false,
      overrideTerrainTile: true,
    });
    const operations: MapOperation[] = [
      {
        type: "update_feature",
        featureId: "feature-1",
        patch: {
          gmLabel: "New label",
          visibility: "hidden",
        },
      },
      {
        type: "remove_feature",
        featureId: "feature-1",
      },
      {
        type: "set_cells_hidden",
        cells: [{ q: 0, r: 0 }],
        hidden: true,
      },
    ];

    expect(
      serializeWorld(
        removeFeatureAt(worldBefore, SOURCE_LEVEL, { q: 0, r: 0 }),
      ),
    ).not.toEqual(serializeWorld(worldBefore));
    expectUndoRestoresWorld(worldBefore, operations);
  });
});
