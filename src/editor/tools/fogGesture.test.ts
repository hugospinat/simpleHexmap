import { describe, expect, it } from "vitest";
import { addTile, createEmptyWorld, getLevelMap } from "@/core/map/world";
import { applyFogGestureCells, createFogGesture, finishFogGesture } from "./fogGesture";

describe("fog gestures", () => {
  it("toggles each touched cell once and emits operations", () => {
    const world = addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain");
    const gesture = createFogGesture(world, 3);

    applyFogGestureCells(gesture, [
      { q: 0, r: 0 },
      { q: 0, r: 0 }
    ]);

    const commit = finishFogGesture(gesture);

    expect(commit.changed).toBe(true);
    expect(commit.operations).toEqual([
      {
        type: "set_cell_hidden",
        cell: { q: 0, r: 0, hidden: true }
      }
    ]);
    expect(getLevelMap(gesture.world, 3).get("0,0")?.hidden).toBe(true);
  });
});
