import { describe, expect, it } from "vitest";
import { serializeWorld } from "@/app/io/mapFormat";
import { applyOperationsToWorld } from "@/domain/world/worldOperationApplier";
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
  type World
} from "@/domain/world/world";
import { SOURCE_LEVEL } from "@/domain/world/mapRules";
import { invertOperationBatch } from "@/editor/history/mapOperationHistory";
import type { MapOperation } from "@/shared/mapProtocol";

function expectUndoRestoresWorld(worldBefore: World, operations: MapOperation[]) {
  const worldAfter = applyOperationsToWorld(worldBefore, operations);
  const undoOperations = invertOperationBatch(worldBefore, operations);

  expect(undoOperations.length).toBeGreaterThan(0);
  expect(serializeWorld(applyOperationsToWorld(worldAfter, undoOperations))).toEqual(serializeWorld(worldBefore));
}

describe("map operation history", () => {
  it("inverts terrain removal and restores faction ownership on the tile", () => {
    const withTile = addTile(createEmptyWorld(), SOURCE_LEVEL, { q: 0, r: 0 }, "plain");
    const withFaction = addFaction(withTile, { id: "f-1", name: "North", color: "#112233" });
    const worldBefore = assignFactionAt(withFaction, SOURCE_LEVEL, { q: 0, r: 0 }, "f-1");

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "set_tile",
        tile: {
          q: 0,
          r: 0,
          terrain: null,
          hidden: false
        }
      }
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
      labelRevealed: true
    });

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "remove_feature",
        featureId: "feature-1"
      }
    ]);
  });

  it("inverts road connection removals by restoring the previous road records", () => {
    const withFirstRoad = addRoadConnection(createEmptyWorld(), SOURCE_LEVEL, { q: 0, r: 0 }, { q: 1, r: 0 });
    const worldBefore = addRoadConnection(withFirstRoad, SOURCE_LEVEL, { q: 0, r: 0 }, { q: 0, r: 1 });

    expectUndoRestoresWorld(worldBefore, [
      {
        type: "remove_road_connections_at",
        cell: { q: 0, r: 0 }
      }
    ]);
  });

  it("inverts faction deletion by restoring the faction and its territories", () => {
    const withTile = addTile(createEmptyWorld(), SOURCE_LEVEL, { q: 0, r: 0 }, "plain");
    const withFaction = addFaction(withTile, { id: "f-1", name: "North", color: "#112233" });
    const worldBefore = assignFactionAt(withFaction, SOURCE_LEVEL, { q: 0, r: 0 }, "f-1");
    const operation: MapOperation = {
      type: "remove_faction",
      factionId: "f-1"
    };

    expect(serializeWorld(applyOperationsToWorld(worldBefore, [operation]))).toEqual(
      serializeWorld(removeFaction(worldBefore, "f-1"))
    );
    expectUndoRestoresWorld(worldBefore, [operation]);
  });

  it("inverts mixed batches in reverse order", () => {
    const withTile = addTile(createEmptyWorld(), SOURCE_LEVEL, { q: 0, r: 0 }, "plain");
    const worldBefore = addFeature(withTile, SOURCE_LEVEL, {
      id: "feature-1",
      kind: "city",
      hexId: "0,0",
      hidden: false,
      overrideTerrainTile: true
    });
    const operations: MapOperation[] = [
      {
        type: "update_feature",
        featureId: "feature-1",
        patch: {
          gmLabel: "New label",
          visibility: "hidden"
        }
      },
      {
        type: "remove_feature",
        featureId: "feature-1"
      },
      {
        type: "set_cell_hidden",
        cell: {
          q: 0,
          r: 0,
          hidden: true
        }
      }
    ];

    expect(serializeWorld(removeFeatureAt(worldBefore, SOURCE_LEVEL, { q: 0, r: 0 }))).not.toEqual(serializeWorld(worldBefore));
    expectUndoRestoresWorld(worldBefore, operations);
  });
});
