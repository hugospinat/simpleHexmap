import { describe, expect, it } from "vitest";
import { coalesceMapOperations, type MapOperation } from "./index.js";

describe("coalesceMapOperations", () => {
  it("merges adjacent set_tiles operations with last-write-wins by cell", () => {
    const operations: MapOperation[] = [
      {
        type: "set_tiles",
        tiles: [{ q: 1, r: 2, terrain: "plain", hidden: false }],
      },
      {
        type: "set_tiles",
        tiles: [{ q: 1, r: 2, terrain: "forest", hidden: true }],
      },
      {
        type: "set_tiles",
        tiles: [{ q: 2, r: 2, terrain: "hill", hidden: false }],
      },
    ];

    expect(coalesceMapOperations(operations)).toEqual([
      {
        type: "set_tiles",
        tiles: [
          { q: 1, r: 2, terrain: "forest", hidden: true },
          { q: 2, r: 2, terrain: "hill", hidden: false },
        ],
      },
    ]);
  });

  it("merges adjacent patches for the same entity", () => {
    const operations: MapOperation[] = [
      {
        type: "update_feature",
        featureId: "feature-1",
        patch: { hidden: true },
      },
      {
        type: "update_feature",
        featureId: "feature-1",
        patch: { hidden: false },
      },
      {
        type: "update_faction",
        factionId: "faction-1",
        patch: { name: "North" },
      },
      {
        type: "update_faction",
        factionId: "faction-1",
        patch: { color: "#112233" },
      },
    ];

    expect(coalesceMapOperations(operations)).toEqual([
      {
        type: "update_feature",
        featureId: "feature-1",
        patch: { hidden: false },
      },
      {
        type: "update_faction",
        factionId: "faction-1",
        patch: { name: "North", color: "#112233" },
      },
    ]);
  });

  it("coalesces adjacent set_tiles writes with last-write-wins semantics", () => {
    const operations: MapOperation[] = [
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: "plain", hidden: true }],
      },
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: "plain", hidden: false }],
      },
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: "plain", hidden: true }],
      },
    ];

    expect(coalesceMapOperations(operations)).toEqual([
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: "plain", hidden: true }],
      },
    ]);
  });

  it("does not coalesce non-mergeable operations so sync acknowledgements stay one-to-one", () => {
    const operations: MapOperation[] = [
      {
        type: "add_faction",
        faction: { id: "f-1", name: "A", color: "#112233" },
      },
      {
        type: "add_faction",
        faction: { id: "f-2", name: "B", color: "#223344" },
      },
    ];

    expect(coalesceMapOperations(operations)).toEqual(operations);
  });

  it("coalesces adjacent note updates on the same cell", () => {
    expect(
      coalesceMapOperations([
        { type: "set_note", note: { q: 1, r: 2, markdown: "One" } },
        { type: "set_note", note: { q: 1, r: 2, markdown: "Two" } },
      ]),
    ).toEqual([{ type: "set_note", note: { q: 1, r: 2, markdown: "Two" } }]);
  });
});
