import { describe, expect, it } from "vitest";
import { createMapRenderTransform } from "./mapTransform";

describe("map render transform", () => {
  it("scales map-authored lengths with level scale and zoom", () => {
    const zoomedOut = createMapRenderTransform({ q: 0, r: 0 }, 2, 3, {
      width: 800,
      height: 600
    });
    const zoomedIn = createMapRenderTransform({ q: 0, r: 0 }, 2, 6, {
      width: 800,
      height: 600
    });

    expect(zoomedIn.scaleMapLength(2)).toBeCloseTo(zoomedOut.scaleMapLength(2) * 2);
  });
});
