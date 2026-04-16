import { describe, expect, it } from "vitest";
import {
  addRoadConnection,
  createEmptyWorld,
  getRoadEdgesAt,
  getRoadLevelMap,
  removeRoadConnection,
  removeRoadConnectionsAt
} from "./world";

describe("roads", () => {
  it("stores roads as symmetric local hex edges", () => {
    const world = addRoadConnection(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    );

    expect(Array.from(getRoadEdgesAt(world, 3, { q: 0, r: 0 }))).toEqual([5]);
    expect(Array.from(getRoadEdgesAt(world, 3, { q: 1, r: 0 }))).toEqual([2]);
  });

  it("does not duplicate existing connections", () => {
    const first = addRoadConnection(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    );
    const second = addRoadConnection(first, 3, { q: 0, r: 0 }, { q: 1, r: 0 });

    expect(second).toBe(first);
    expect(getRoadLevelMap(second, 3).size).toBe(2);
  });

  it("removes a road connection from both neighboring hexes", () => {
    const world = addRoadConnection(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    );
    const nextWorld = removeRoadConnection(world, 3, { q: 0, r: 0 }, { q: 1, r: 0 });

    expect(getRoadEdgesAt(nextWorld, 3, { q: 0, r: 0 }).size).toBe(0);
    expect(getRoadEdgesAt(nextWorld, 3, { q: 1, r: 0 }).size).toBe(0);
    expect(getRoadLevelMap(nextWorld, 3).size).toBe(0);
  });

  it("removes all road connections touching one hex", () => {
    const withEast = addRoadConnection(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    );
    const withWest = addRoadConnection(withEast, 3, { q: 0, r: 0 }, { q: -1, r: 0 });
    const nextWorld = removeRoadConnectionsAt(withWest, 3, { q: 0, r: 0 });

    expect(getRoadEdgesAt(nextWorld, 3, { q: 0, r: 0 }).size).toBe(0);
    expect(getRoadEdgesAt(nextWorld, 3, { q: 1, r: 0 }).size).toBe(0);
    expect(getRoadEdgesAt(nextWorld, 3, { q: -1, r: 0 }).size).toBe(0);
  });

  it("derives parent road edges from level 3 traversals", () => {
    const world = addRoadConnection(
      createEmptyWorld(),
      3,
      { q: 1, r: 0 },
      { q: 2, r: 0 }
    );

    expect(Array.from(getRoadEdgesAt(world, 2, { q: 0, r: 0 }))).toEqual([5]);
    expect(Array.from(getRoadEdgesAt(world, 2, { q: 1, r: 0 }))).toEqual([2]);
  });
});
