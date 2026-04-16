import { describe, expect, it, vi } from "vitest";
import { addRoadConnection, createEmptyWorld, getRoadLevelMap } from "@/domain/world/world";
import { createMapRenderTransform } from "./mapTransform";
import { drawRoadOverlays } from "./roadRenderer";

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
    const count = drawRoadOverlays(
      context,
      getRoadLevelMap(world, 3),
      transform
    );

    expect(count).toBe(1);
    expect(context.translate).toHaveBeenCalled();
    expect(context.rotate).toHaveBeenCalled();
    expect(context.drawImage).toHaveBeenCalledTimes(1);
  });
});
