import { describe, expect, it } from "vitest";
import {
  applyMapDocumentOperation as applyOperationToContent,
  validateMapOperation,
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
    notes: [],
  };
}

describe("protocol content operations", () => {
  it("validates and applies set_road_edges operations", () => {
    const operation = {
      type: "set_road_edges" as const,
      cell: { q: 0, r: 0 },
      edges: [5 as const],
    };

    expect(validateMapOperation(operation)).toBeNull();

    const content = applyOperationToContent(createContent(), operation);

    expect(content.roads).toEqual([{ q: 0, r: 0, edges: [5] }]);
  });

  it("removes road records when edges are empty", () => {
    const withRoad = applyOperationToContent(createContent(), {
      type: "set_road_edges",
      cell: { q: 0, r: 0 },
      edges: [5],
    });

    const withoutRoad = applyOperationToContent(withRoad, {
      type: "set_road_edges",
      cell: { q: 0, r: 0 },
      edges: [],
    });

    expect(withoutRoad.roads).toEqual([]);
  });

  it("rejects invalid set_road_edges operations", () => {
    expect(
      validateMapOperation({
        type: "set_road_edges",
        cell: { q: 0, r: 0 },
        edges: [7],
      }),
    ).toBe("Invalid set_road_edges operation.");
  });

  it("rejects removed low-level tile operations in the live protocol", () => {
    expect(
      validateMapOperation({
        type: "set_tile",
        tile: { q: 1, r: 0, tileId: "forest", hidden: false },
      }),
    ).toBe("Unknown operation type.");
  });

  it("validates and applies set_note operations", () => {
    const operation = {
      type: "set_note" as const,
      note: { q: 0, r: 0, markdown: "# Scout camp" },
    };

    expect(validateMapOperation(operation)).toBeNull();

    const content = applyOperationToContent(createContent(), operation);

    expect(content.notes).toEqual([{ q: 0, r: 0, markdown: "# Scout camp" }]);
  });

  it("removes notes when markdown is null or the tile is deleted", () => {
    const withNote = applyOperationToContent(createContent(), {
      type: "set_note",
      note: { q: 0, r: 0, markdown: "Hidden path" },
    });

    expect(
      applyOperationToContent(withNote, {
        type: "set_note",
        note: { q: 0, r: 0, markdown: null },
      }).notes,
    ).toEqual([]);

    expect(
      applyOperationToContent(withNote, {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: null, hidden: false }],
      }).notes,
    ).toEqual([]);
  });
});
