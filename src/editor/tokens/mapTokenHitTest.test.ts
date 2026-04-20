import { describe, expect, it } from "vitest";
import { addTile, createEmptyWorld, setCellHidden } from "@/core/map/world";
import { findMapTokenUserAtPoint } from "./mapTokenHitTest";

describe("map token hit testing", () => {
  it("finds a visible token under the pointer", () => {
    const paintedWorld = addTile(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      "plain",
    );
    const world = setCellHidden(paintedWorld, 3, { q: 0, r: 0 }, false);

    expect(
      findMapTokenUserAtPoint({
        center: { q: 0, r: 0 },
        level: 3,
        point: { x: 250, y: 250 },
        tokens: [{ color: "#ff0000", userId: "profile-a", q: 0, r: 0 }],
        viewport: { height: 500, width: 500 },
        visualZoom: 1,
        world,
      }),
    ).toBe("profile-a");
  });

  it("does not hit tokens on hidden source terrain", () => {
    const world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");

    expect(
      findMapTokenUserAtPoint({
        center: { q: 0, r: 0 },
        level: 3,
        point: { x: 250, y: 250 },
        tokens: [{ color: "#ff0000", userId: "profile-a", q: 0, r: 0 }],
        viewport: { height: 500, width: 500 },
        visualZoom: 1,
        world,
      }),
    ).toBeNull();
  });
});
