import { describe, expect, it } from "vitest";
import { hexKey } from "@/core/geometry/hex";
import { addFeature, addTile, createEmptyWorld, createFeature } from "@/core/map/world";
import { createPixiMapSceneCache } from "./pixiMapSceneCache";

describe("pixi map scene cache", () => {
  it("builds level scenes lazily", () => {
    const world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const cache = createPixiMapSceneCache(world);

    expect(cache.levels.size).toBe(0);

    const scene = cache.getLevelScene(3, world);

    expect(cache.levels.size).toBe(1);
    expect(scene.cellsByHex.get(hexKey({ q: 0, r: 0 }))?.cell.type).toBe("plain");
  });

  it("patches cached source-level cells after operations", () => {
    const world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const cache = createPixiMapSceneCache(world);
    const scene = cache.getLevelScene(3, world);
    const nextWorld = addTile(world, 3, { q: 0, r: 0 }, "forest");

    const dirtySet = cache.applyOperations(nextWorld, [{
      tile: { hidden: false, q: 0, r: 0, terrain: "forest" },
      type: "set_tile"
    }]);

    expect(dirtySet.terrainHexes.has(hexKey({ q: 0, r: 0 }))).toBe(true);
    expect(scene.stale).toBe(false);
    expect(cache.getLevelScene(3, nextWorld).cellsByHex.get(hexKey({ q: 0, r: 0 }))?.cell.type).toBe("forest");
  });

  it("materializes feature records for renderer layers", () => {
    const feature = createFeature("feature-1", "city", hexKey({ q: 0, r: 0 }));
    const world = addFeature(addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain"), 3, feature);
    const cache = createPixiMapSceneCache(world);

    expect(cache.getLevelScene(3, world).cellsByHex.get(hexKey({ q: 0, r: 0 }))?.feature?.kind).toBe("city");
  });
});
