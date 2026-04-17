import { describe, expect, it } from "vitest";
import { coalesceMapOperations, type MapOperation } from "./index.js";

describe("coalesceMapOperations", () => {
  it("keeps only the final adjacent set_tile for the same cell", () => {
    const operations: MapOperation[] = [
      { type: "set_tile", tile: { q: 1, r: 2, terrain: "plain", hidden: false } },
      { type: "set_tile", tile: { q: 1, r: 2, terrain: "forest", hidden: true } },
      { type: "set_tile", tile: { q: 2, r: 2, terrain: "hill", hidden: false } }
    ];

    expect(coalesceMapOperations(operations)).toEqual([
      { type: "set_tile", tile: { q: 1, r: 2, terrain: "forest", hidden: true } },
      { type: "set_tile", tile: { q: 2, r: 2, terrain: "hill", hidden: false } }
    ]);
  });

  it("merges adjacent patches for the same entity", () => {
    const operations: MapOperation[] = [
      { type: "update_feature", featureId: "feature-1", patch: { gmLabel: "A" } },
      { type: "update_feature", featureId: "feature-1", patch: { gmLabel: "B", playerLabel: "C" } },
      { type: "update_faction", factionId: "faction-1", patch: { name: "North" } },
      { type: "update_faction", factionId: "faction-1", patch: { color: "#112233" } }
    ];

    expect(coalesceMapOperations(operations)).toEqual([
      { type: "update_feature", featureId: "feature-1", patch: { gmLabel: "B", playerLabel: "C" } },
      { type: "update_faction", factionId: "faction-1", patch: { name: "North", color: "#112233" } }
    ]);
  });

  it("does not cross intervening operations that could change semantics", () => {
    const operations: MapOperation[] = [
      { type: "set_cell_hidden", cell: { q: 0, r: 0, hidden: true } },
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "plain", hidden: false } },
      { type: "set_cell_hidden", cell: { q: 0, r: 0, hidden: true } }
    ];

    expect(coalesceMapOperations(operations)).toEqual(operations);
  });

  it("does not coalesce rename operations so sync acknowledgements stay one-to-one", () => {
    const operations: MapOperation[] = [
      { type: "rename_map", name: "A" },
      { type: "rename_map", name: "B" }
    ];

    expect(coalesceMapOperations(operations)).toEqual(operations);
  });
});
