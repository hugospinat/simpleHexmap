import { describe, expect, it } from "vitest";
import {
  addFaction,
  addFeature,
  addTile,
  assignFactionAt,
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

  it("precomputes render cell geometry and overlays", () => {
    let world = createEmptyWorld();
    world = addTile(world, 3, { q: 0, r: 0 }, "plain");
    world = addFaction(world, { id: "f-1", name: "North", color: "#112233" });
    world = assignFactionAt(world, 3, { q: 0, r: 0 }, "f-1");

    const frame = createMapRenderFrame({
      center: { q: 0, r: 0 },
      featureVisibilityMode: "gm",
      highlightedHex: null,
      hoverRiverEdge: null,
      level: 3,
      viewport,
      visualZoom: 1,
      world
    });
    const cell = frame.renderCells.find((entry) => entry.key === "0,0");

    expect(cell?.center).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    expect(cell?.corners).toHaveLength(6);
    expect(cell?.factionColor).toBe("#112233");
  });
});
