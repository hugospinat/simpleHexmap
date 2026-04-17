import { describe, expect, it } from "vitest";
import { getChildCluster, hexKey } from "@/domain/geometry/hex";
import {
  addMissingNeighborsWithPropagation,
  addRiverEdge,
  addTile,
  addTileWithPropagation,
  createEmptyWorld,
  deleteWithDescendants,
  getLevelMap,
  getRiverEdgePathBetween,
  getRiverFlowLevelMap,
  getRiverLevelMap,
  removeTile,
  setCellHidden,
  removeRiverEdge,
  tileTypes
} from "./world";

describe("world operations", () => {
  it("exposes the fixed terrain type set", () => {
    expect(tileTypes).toEqual([
      "empty",
      "water",
      "plain",
      "forest",
      "hill",
      "mountain",
      "desert",
      "swamp",
      "tundra",
      "wasteland"
    ]);
  });

  it("adds a tile and propagates matching child clusters to deeper levels", () => {
    const world = addTileWithPropagation(createEmptyWorld(), 1, { q: 1, r: 0 }, "forest", 3);
    const level2Children = getChildCluster({ q: 1, r: 0 });
    const level3Children = level2Children.flatMap(getChildCluster);

    expect(getLevelMap(world, 1).get("1,0")).toEqual({ hidden: false, type: "forest" });
    expect(getLevelMap(world, 2).size).toBe(7);
    expect(getLevelMap(world, 3).size).toBe(49);

    for (const child of level2Children) {
      expect(getLevelMap(world, 2).get(hexKey(child))).toEqual({ hidden: false, type: "forest" });
    }

    for (const child of level3Children) {
      expect(getLevelMap(world, 3).get(hexKey(child))).toEqual({ hidden: false, type: "forest" });
    }
  });

  it("updates existing propagated descendants when the tile type changes", () => {
    const forestWorld = addTileWithPropagation(createEmptyWorld(), 1, { q: 1, r: 0 }, "forest", 3);
    const mountainWorld = addTileWithPropagation(forestWorld, 1, { q: 1, r: 0 }, "mountain", 3);
    const level2Children = getChildCluster({ q: 1, r: 0 });
    const level3Children = level2Children.flatMap(getChildCluster);

    expect(getLevelMap(mountainWorld, 1).get("1,0")).toEqual({ hidden: false, type: "mountain" });
    for (const child of [...level2Children, ...level3Children]) {
      const level = level2Children.includes(child) ? 2 : 3;
      expect(getLevelMap(mountainWorld, level).get(hexKey(child))).toEqual({ hidden: false, type: "mountain" });
    }
  });

  it("derives parent terrain from level 3 source tiles", () => {
    const world = addTileWithPropagation(createEmptyWorld(), 1, { q: 99, r: -42 }, "water", 2);

    expect(getLevelMap(world, 1).get("99,-42")).toEqual({ hidden: false, type: "water" });
    expect(getLevelMap(world, 2).has("240,-27")).toBe(true);
    expect(getLevelMap(world, 2).size).toBe(7);
  });

  it("deletes a tile and all recursively propagated descendants", () => {
    const world = addTileWithPropagation(createEmptyWorld(), 1, { q: 1, r: 0 }, "forest", 3);
    const nextWorld = deleteWithDescendants(world, 1, { q: 1, r: 0 }, 3);

    expect(getLevelMap(nextWorld, 1).has("1,0")).toBe(false);
    expect(getLevelMap(nextWorld, 2).size).toBe(0);
    expect(getLevelMap(nextWorld, 3).size).toBe(0);
  });

  it("deletes descendants from the selected level downward only", () => {
    const world = addTileWithPropagation(createEmptyWorld(), 1, { q: 1, r: 0 }, "mountain", 3);
    const level2Child = getChildCluster({ q: 1, r: 0 })[0];
    const nextWorld = deleteWithDescendants(world, 2, level2Child, 3);

    expect(getLevelMap(nextWorld, 1).get("1,0")).toEqual({ hidden: false, type: "mountain" });
    expect(getLevelMap(nextWorld, 2).has(hexKey(level2Child))).toBe(false);
    expect(getLevelMap(nextWorld, 2).size).toBe(6);

    for (const descendant of getChildCluster(level2Child)) {
      expect(getLevelMap(nextWorld, 3).has(hexKey(descendant))).toBe(false);
    }
  });

  it("does not delete when no level 3 source descendants exist", () => {
    const childOnly = addTile(createEmptyWorld(), 2, { q: 0, r: 0 }, "water");
    const nextWorld = deleteWithDescendants(childOnly, 1, { q: 0, r: 0 }, 2);

    expect(nextWorld).toBe(childOnly);
    expect(getLevelMap(nextWorld, 2).get("0,0")).toBeUndefined();
  });

  it("adds only missing neighbors and propagates each created neighbor", () => {
    const seeded = addTileWithPropagation(createEmptyWorld(), 1, { q: 0, r: 0 }, "plain", 2);
    const world = addMissingNeighborsWithPropagation(seeded, 1, { q: 0, r: 0 }, "forest", 2);

    expect(getLevelMap(world, 1).size).toBe(7);
    expect(getLevelMap(world, 2).size).toBe(49);
    expect(getLevelMap(world, 1).get("0,0")).toEqual({ hidden: false, type: "plain" });
  });

  it("toggles cell hidden state and derives parent hidden state from source descendants", () => {
    const withTile = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const hidden = setCellHidden(withTile, 3, { q: 0, r: 0 }, true);
    const shown = setCellHidden(hidden, 3, { q: 0, r: 0 }, false);

    expect(getLevelMap(hidden, 3).get("0,0")).toEqual({ hidden: true, type: "plain" });
    expect(getLevelMap(shown, 3).get("0,0")).toEqual({ hidden: false, type: "plain" });
    expect(getLevelMap(hidden, 2).get("0,0")?.hidden).toBe(true);
  });

  it("adds river edges symmetrically for both adjacent cells", () => {
    const world = addRiverEdge(createEmptyWorld(), 3, { axial: { q: 3, r: -1 }, edge: 0 });

    expect(getRiverLevelMap(world, 3).get("3,-1")?.has(0)).toBe(true);
    expect(getRiverLevelMap(world, 3).get("3,0")?.has(3)).toBe(true);
  });

  it("does not derive parent river edges from level 3 flow", () => {
    const riverPath = [
      { axial: { q: -1, r: 0 }, edge: 2 },
      { axial: { q: -1, r: 0 }, edge: 3 },
      { axial: { q: -1, r: 0 }, edge: 4 },
      { axial: { q: 0, r: 0 }, edge: 3 },
      { axial: { q: 0, r: 0 }, edge: 4 },
      { axial: { q: 1, r: 0 }, edge: 3 },
      { axial: { q: 1, r: 0 }, edge: 4 },
      { axial: { q: 1, r: 0 }, edge: 5 }
    ] as const;
    const world = riverPath.reduce(
      (nextWorld, ref) => addRiverEdge(nextWorld, 3, ref),
      createEmptyWorld()
    );

    expect(getRiverLevelMap(world, 2).size).toBe(0);
    expect(getRiverFlowLevelMap(world, 2).size).toBe(0);
  });

  it("fills intermediate parent river edges between entry and exit", () => {
    expect(getRiverEdgePathBetween(1, 3)).toEqual([1, 2, 3]);
    expect(getRiverEdgePathBetween(3, 1)).toEqual([3, 2, 1]);
  });

  it("does not derive parent rivers even with attached branch at level 3", () => {
    const mainRiverPath = [
      { axial: { q: -1, r: 0 }, edge: 2 },
      { axial: { q: -1, r: 0 }, edge: 3 },
      { axial: { q: -1, r: 0 }, edge: 4 },
      { axial: { q: 0, r: 0 }, edge: 3 },
      { axial: { q: 0, r: 0 }, edge: 4 },
      { axial: { q: 1, r: 0 }, edge: 3 },
      { axial: { q: 1, r: 0 }, edge: 4 },
      { axial: { q: 1, r: 0 }, edge: 5 }
    ] as const;
    const attachedBranch = [
      { axial: { q: 0, r: 0 }, edge: 0 },
      { axial: { q: 0, r: 1 }, edge: 0 }
    ] as const;
    const world = [...mainRiverPath, ...attachedBranch].reduce(
      (nextWorld, ref) => addRiverEdge(nextWorld, 3, ref),
      createEmptyWorld()
    );

    expect(getRiverLevelMap(world, 2).size).toBe(0);
    expect(getRiverFlowLevelMap(world, 2).size).toBe(0);
  });

  it("keeps explicit parent edges without any child-level recomputation", () => {
    const riverPath = [
      { axial: { q: -1, r: 0 }, edge: 2 },
      { axial: { q: -1, r: 0 }, edge: 3 },
      { axial: { q: -1, r: 0 }, edge: 4 },
      { axial: { q: 0, r: 0 }, edge: 3 },
      { axial: { q: 0, r: 0 }, edge: 4 },
      { axial: { q: 1, r: 0 }, edge: 3 },
      { axial: { q: 1, r: 0 }, edge: 4 },
      { axial: { q: 1, r: 0 }, edge: 5 }
    ] as const;
    const childOnlyWorld = riverPath.reduce(
      (nextWorld, ref) => addRiverEdge(nextWorld, 3, ref),
      createEmptyWorld()
    );
    const withManualParentEdge = addRiverEdge(childOnlyWorld, 2, { axial: { q: 0, r: 0 }, edge: 0 });

    expect(getRiverLevelMap(childOnlyWorld, 2).size).toBe(0);
    expect(Array.from(getRiverLevelMap(withManualParentEdge, 2).get("0,0") ?? [])).toEqual([0]);
    expect(getRiverFlowLevelMap(withManualParentEdge, 2).size).toBe(0);
  });

  it("removes river edges symmetrically from both adjacent cells", () => {
    const withRiver = addRiverEdge(createEmptyWorld(), 3, { axial: { q: 0, r: 0 }, edge: 1 });
    const withoutRiver = removeRiverEdge(withRiver, 3, { axial: { q: -1, r: 1 }, edge: 4 });

    expect(getRiverLevelMap(withoutRiver, 3).get("0,0")?.has(1) ?? false).toBe(false);
    expect(getRiverLevelMap(withoutRiver, 3).get("-1,1")?.has(4) ?? false).toBe(false);
  });
});
