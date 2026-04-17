import { describe, expect, it } from "vitest";
import {
  addFeature,
  addRoadConnection,
  addTile,
  createEmptyWorld,
  setCellHidden
} from "@/core/map/world";
import { featureCanOverrideTerrainTile } from "./featureVisualPrimitives";
import { createMapRenderFrame } from "./mapRenderFrame";

const viewport = {
  height: 600,
  width: 800
};

describe("map render view visibility", () => {
  it("excludes hidden terrain and features from player-visible render keys", () => {
    let world = createEmptyWorld();
    world = addTile(world, 3, { q: 0, r: 0 }, "plain");
    world = addTile(world, 3, { q: 1, r: 0 }, "forest");
    world = setCellHidden(world, 3, { q: 1, r: 0 }, true);
    world = addFeature(world, 3, {
      id: "hidden-city",
      kind: "city",
      hexId: "1,0",
      hidden: false,
      overrideTerrainTile: true
    });

    const playerView = createMapRenderFrame({
      center: { q: 0, r: 0 },
      featureVisibilityMode: "player",
      highlightedHex: null,
      hoverRiverEdge: null,
      level: 3,
      viewport,
      visualZoom: 1,
      world
    });
    const gmView = createMapRenderFrame({
      center: { q: 0, r: 0 },
      featureVisibilityMode: "gm",
      highlightedHex: null,
      hoverRiverEdge: null,
      level: 3,
      viewport,
      visualZoom: 1,
      world
    });

    expect(playerView.visibleTerrainKeys.has("1,0")).toBe(false);
    expect(playerView.featureVisibleKeys.has("1,0")).toBe(false);
    expect(gmView.visibleTerrainKeys.has("1,0")).toBe(true);
    expect(gmView.featureVisibleKeys.has("1,0")).toBe(true);
  });

  it("prevents hidden feature terrain overrides from leaking feature kind", () => {
    expect(featureCanOverrideTerrainTile({
      id: "secret-city",
      kind: "city",
      hexId: "0,0",
      hidden: true,
      overrideTerrainTile: true
    })).toBe(false);
  });
});
