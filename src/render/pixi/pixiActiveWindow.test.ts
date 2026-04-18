import { describe, expect, it } from "vitest";
import { createEmptyWorld, addTile } from "@/core/map/world";
import { createPixiActiveRenderWindow, shouldReusePixiActiveWindow } from "./pixiActiveWindow";
import { createPixiMapSceneCache } from "./pixiMapSceneCache";
import type { PixiCameraState } from "./pixiTypes";

function createCamera(center = { q: 0, r: 0 }): PixiCameraState {
  return {
    center,
    featureVisibilityMode: "gm",
    fogEditingActive: false,
    level: 3,
    showCoordinates: false,
    viewport: { height: 600, width: 800 },
    visualZoom: 1
  };
}

describe("pixi active render window", () => {
  it("reuses the window when pan stays inside the margin bounds", () => {
    const world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const cache = createPixiMapSceneCache(world);
    const scene = cache.getLevelScene(3, world);
    const window = createPixiActiveRenderWindow(scene, createCamera());

    expect(shouldReusePixiActiveWindow(window, createCamera({ q: 0.1, r: 0 }))).toBe(true);
  });

  it("rebuilds the window when pan exits the margin bounds", () => {
    const world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const cache = createPixiMapSceneCache(world);
    const scene = cache.getLevelScene(3, world);
    const window = createPixiActiveRenderWindow(scene, createCamera());

    expect(shouldReusePixiActiveWindow(window, createCamera({ q: 100, r: 100 }))).toBe(false);
  });
});
