import { describe, expect, it } from "vitest";
import { createEmptyWorld, getLevelMap } from "@/domain/world/world";
import { eraseTile, paintTile } from "./editorActions";

describe("editor actions", () => {
  it("paints with propagation and erases only the current level", () => {
    const painted = paintTile(createEmptyWorld(), 1, { q: 0, r: 0 }, "forest", 2);
    const erased = eraseTile(painted, 1, { q: 0, r: 0 }, 2);

    expect(getLevelMap(painted, 1).get("0,0")).toEqual({ hidden: false, type: "forest" });
    expect(getLevelMap(painted, 2).size).toBe(7);
    expect(getLevelMap(erased, 1).has("0,0")).toBe(false);
    expect(getLevelMap(erased, 2).size).toBe(0);
  });

});
