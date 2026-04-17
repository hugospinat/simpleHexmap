import { describe, expect, it } from "vitest";
import { getDescendantsAtLevel, hexKey } from "@/core/geometry/hex";
import {
  addFaction,
  addTile,
  assignFactionAt,
  clearFactionAt,
  createEmptyWorld,
  getFactionLevelMap,
  getFactionOverlayColorMap,
  getFactions,
  removeFaction
} from "./world";

describe("factions", () => {
  it("stores source-level faction assignments on hexes", () => {
    let world = createEmptyWorld();
    world = addTile(world, 3, { q: 2, r: -1 }, "forest");
    world = addFaction(world, { id: "f1", name: "North", color: "#3366cc" });
    world = assignFactionAt(world, 3, { q: 2, r: -1 }, "f1");

    expect(getFactionLevelMap(world, 3).get("2,-1")).toBe("f1");
    expect(getFactionOverlayColorMap(world, 3).get("2,-1")).toBe("#3366cc");
  });

  it("derives parent faction ownership by dominant source assignments", () => {
    let world = createEmptyWorld();
    world = addFaction(world, { id: "f1", name: "North", color: "#3366cc" });
    world = addFaction(world, { id: "f2", name: "South", color: "#cc6633" });

    const descendants = getDescendantsAtLevel({ q: 0, r: 0 }, 2, 3);

    for (const descendant of descendants) {
      world = addTile(world, 3, descendant, "plain");
    }

    world = assignFactionAt(world, 3, descendants[0], "f1");
    world = assignFactionAt(world, 3, descendants[1], "f1");
    world = assignFactionAt(world, 3, descendants[2], "f2");

    expect(getFactionLevelMap(world, 2).get("0,0")).toBe("f1");
  });

  it("assigns and clears factions from descendants when painting at parent level", () => {
    let world = createEmptyWorld();
    world = addFaction(world, { id: "f1", name: "North", color: "#3366cc" });

    const descendants = getDescendantsAtLevel({ q: 1, r: 0 }, 2, 3);

    for (const descendant of descendants) {
      world = addTile(world, 3, descendant, "hill");
    }

    world = assignFactionAt(world, 2, { q: 1, r: 0 }, "f1");

    for (const descendant of descendants) {
      expect(getFactionLevelMap(world, 3).get(hexKey(descendant))).toBe("f1");
    }

    world = clearFactionAt(world, 2, { q: 1, r: 0 });

    for (const descendant of descendants) {
      expect(getFactionLevelMap(world, 3).has(hexKey(descendant))).toBe(false);
    }
  });

  it("removes a faction and clears all affected hex marks", () => {
    let world = createEmptyWorld();
    world = addFaction(world, { id: "f1", name: "North", color: "#3366cc" });
    world = addTile(world, 3, { q: 0, r: 0 }, "plain");
    world = addTile(world, 3, { q: 1, r: 0 }, "plain");
    world = assignFactionAt(world, 3, { q: 0, r: 0 }, "f1");
    world = assignFactionAt(world, 3, { q: 1, r: 0 }, "f1");

    world = removeFaction(world, "f1");

    expect(getFactions(world)).toEqual([]);
    expect(getFactionLevelMap(world, 3).size).toBe(0);
  });
});
