import { describe, expect, it } from "vitest";
import { hexKey } from "@/core/geometry/hex";
import { createEmptyWorld, getFactionLevelMap } from "@/core/map/world";
import { addFaction, addTile } from "@/core/map/world";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import type { MapOperation } from "@/core/protocol";
import { applyOperationsToWorld, applyOperationToWorld } from "./worldOperationApplier";

function applyOperationsSequentially(world: ReturnType<typeof createEmptyWorld>, operations: MapOperation[]) {
  return operations.reduce(applyOperationToWorld, world);
}

function expectSameMapData(
  left: ReturnType<typeof createEmptyWorld>,
  right: ReturnType<typeof createEmptyWorld>
) {
  expect({
    ...left,
    versions: right.versions
  }).toEqual(right);
}

describe("world operation applier", () => {
  it("applies terrain batches with the same result as sequential operation application", () => {
    const world = addTile(createEmptyWorld(), SOURCE_LEVEL, { q: 0, r: 0 }, "plain");
    const operations: MapOperation[] = [
      { type: "set_tile", tile: { q: 0, r: 0, terrain: "forest", hidden: false } },
      { type: "set_tile", tile: { q: 1, r: 0, terrain: "water", hidden: true } },
      { type: "set_tile", tile: { q: 2, r: 0, terrain: "hill", hidden: false } },
      { type: "set_tile", tile: { q: 1, r: 0, terrain: null, hidden: false } }
    ];

    expectSameMapData(applyOperationsToWorld(world, operations), applyOperationsSequentially(world, operations));
  });

  it("applies fog batches with the same result as sequential operation application", () => {
    let world = createEmptyWorld();
    world = addTile(world, SOURCE_LEVEL, { q: 0, r: 0 }, "plain");
    world = addTile(world, SOURCE_LEVEL, { q: 1, r: 0 }, "plain");
    const operations: MapOperation[] = [
      { type: "set_cell_hidden", cell: { q: 0, r: 0, hidden: true } },
      { type: "set_cell_hidden", cell: { q: 1, r: 0, hidden: true } },
      { type: "set_cell_hidden", cell: { q: 1, r: 0, hidden: false } }
    ];

    expectSameMapData(applyOperationsToWorld(world, operations), applyOperationsSequentially(world, operations));
  });

  it("applies faction territory batches with the same result as sequential operation application", () => {
    let world = createEmptyWorld();
    world = addFaction(world, { id: "red", name: "Red", color: "#ff0000" });
    world = addTile(world, SOURCE_LEVEL, { q: 0, r: 0 }, "plain");
    world = addTile(world, SOURCE_LEVEL, { q: 1, r: 0 }, "plain");
    const operations: MapOperation[] = [
      { type: "set_faction_territory", territory: { q: 0, r: 0, factionId: "red" } },
      { type: "set_faction_territory", territory: { q: 1, r: 0, factionId: "red" } },
      { type: "set_faction_territory", territory: { q: 1, r: 0, factionId: null } }
    ];
    const batched = applyOperationsToWorld(world, operations);
    const sequential = applyOperationsSequentially(world, operations);

    expectSameMapData(batched, sequential);
    expect(getFactionLevelMap(batched, SOURCE_LEVEL).get(hexKey({ q: 0, r: 0 }))).toBe("red");
    expect(getFactionLevelMap(batched, SOURCE_LEVEL).has(hexKey({ q: 1, r: 0 }))).toBe(false);
  });
});
