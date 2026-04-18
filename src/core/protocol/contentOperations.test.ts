import { describe, expect, it } from "vitest";
import {
  applyMapOperation as applyOperationToContent,
  validateMapOperation
} from "./index.js";

function createContent() {
  return {
    version: 1,
    tiles: [{ q: 0, r: 0, terrain: "plain", hidden: false }],
    features: [],
    rivers: [],
    roads: [],
    factions: [],
    factionTerritories: [],
    tokens: []
  };
}

describe("protocol content operations", () => {
  it("validates and applies domain-shaped road connections", () => {
    const operation = {
      type: "add_road_connection",
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 }
    } as const;

    expect(validateMapOperation(operation)).toBeNull();

    const content = applyOperationToContent(createContent(), operation);

    expect(content.roads).toEqual([
      { q: 0, r: 0, edges: [5] },
      { q: 1, r: 0, edges: [2] }
    ]);
  });

  it("removes all road records touching a cell", () => {
    const withRoad = applyOperationToContent(createContent(), {
      type: "add_road_connection",
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 }
    });

    const withoutRoad = applyOperationToContent(withRoad, {
      type: "remove_road_connections_at",
      cell: { q: 0, r: 0 }
    });

    expect(withoutRoad.roads).toEqual([]);
  });

  it("rejects non-adjacent road connections", () => {
    expect(validateMapOperation({
      type: "add_road_connection",
      from: { q: 0, r: 0 },
      to: { q: 3, r: 0 }
    })).toBe("Invalid add_road_connection operation.");
  });

  it("rejects legacy tileId operations in the live protocol", () => {
    expect(validateMapOperation({
      type: "set_tile",
      tile: { q: 1, r: 0, tileId: "forest", hidden: false }
    })).toBe("Invalid set_tile operation.");
  });
});
