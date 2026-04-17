import { describe, expect, it, vi } from "vitest";
import { addRoadConnection, createEmptyWorld, getRoadLevelMap } from "@/core/map/world";
import type { Axial } from "@/core/geometry/hex";
import { createMapRenderTransform } from "./mapTransform";
import { drawRoadOverlays } from "./roadRenderer";
import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";

vi.mock("./assetImages", () => ({
  getLoadedImage: vi.fn(() => ({
    naturalHeight: 301,
    naturalWidth: 715
  }))
}));

function createContextStub() {
  return {
    drawImage: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn()
  } as unknown as CanvasRenderingContext2D;
}

function createRoadRenderCell(world: ReturnType<typeof createEmptyWorld>, transform: MapRenderTransform, axial: Axial): RenderCell {
  const key = `${axial.q},${axial.r}`;

  return {
    axial,
    cell: { hidden: false, type: "plain" },
    center: transform.axialToScreen(axial),
    corners: transform.hexCorners(axial),
    factionColor: null,
    feature: null,
    key,
    riverEdges: new Set(),
    roadEdges: getRoadLevelMap(world, 3).get(key) ?? new Set()
  };
}

describe("road renderer", () => {
  it("renders one centered asset stamp per shared road edge", () => {
    const world = addRoadConnection(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    );
    const context = createContextStub();
    const transform = createMapRenderTransform({ q: 0, r: 0 }, 1, 1, {
      width: 800,
      height: 600
    });
    const count = drawRoadOverlays(context, [
      createRoadRenderCell(world, transform, { q: 0, r: 0 }),
      createRoadRenderCell(world, transform, { q: 1, r: 0 })
    ], transform);

    expect(count).toBe(1);
    expect(context.translate).toHaveBeenCalled();
    expect(context.rotate).toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalledTimes(1);
  });

  it("skips road stamps when their source cell is not visible", () => {
    const world = addRoadConnection(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    );
    const context = createContextStub();
    const transform = createMapRenderTransform({ q: 0, r: 0 }, 1, 1, {
      width: 800,
      height: 600
    });
    const count = drawRoadOverlays(context, [
      createRoadRenderCell(world, transform, { q: 2, r: 0 })
    ], transform);

    expect(count).toBe(0);
    expect(context.drawImage).not.toHaveBeenCalled();
  });
});
