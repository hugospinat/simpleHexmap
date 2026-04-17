import { describe, expect, it } from "vitest";
import { addFaction, addRoadConnection, addTile, assignFactionAt, createEmptyWorld } from "./world";
import { buildWorldView } from "./worldView";

describe("world view selectors", () => {
  it("memoizes derived data by world identity and level", () => {
    const world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");

    expect(buildWorldView(world, 3)).toBe(buildWorldView(world, 3));
    expect(buildWorldView(world, 2)).not.toBe(buildWorldView(world, 3));
  });

  it("collects render-facing maps in one derived view", () => {
    let world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    world = addTile(world, 3, { q: 1, r: 0 }, "forest");
    world = addRoadConnection(world, 3, { q: 0, r: 0 }, { q: 1, r: 0 });
    world = addFaction(world, { id: "f-1", name: "North", color: "#112233" });
    world = assignFactionAt(world, 3, { q: 0, r: 0 }, "f-1");

    const view = buildWorldView(world, 3);

    expect(view.levelMap.size).toBe(2);
    expect(view.roadLevelMap.size).toBe(2);
    expect(view.factionOverlayColorMap.get("0,0")).toBe("#112233");
  });
});
