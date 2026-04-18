import { describe, expect, it } from "vitest";
import { createEmptyWorld, getLevelMap } from "@/core/map/world";
import { applyEditGestureCells, createEditGesture } from "./editGesture";
import { finishGestureSession } from "./gestureSession";

describe("edit gestures", () => {
  it("paints multiple cells into one finished world and ignores duplicate hexes", () => {
    const gesture = createEditGesture("paint", createEmptyWorld(), 1, "forest");

    applyEditGestureCells(gesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 0 }
    ]);

    const commit = finishGestureSession(gesture);

    expect(commit.changed).toBe(true);
    expect(gesture.touchedKeys.size).toBe(2);
    expect(getLevelMap(gesture.world, 1).size).toBe(2);
    expect(getLevelMap(gesture.world, 2).size).toBe(14);
  });

  it("does not finish with a changed world when erasing empty hexes", () => {
    const gesture = createEditGesture("erase", createEmptyWorld(), 1, "plain");

    applyEditGestureCells(gesture, [{ q: 8, r: -3 }]);

    expect(finishGestureSession(gesture).changed).toBe(false);
    expect(gesture.touchedKeys.size).toBe(1);
  });

  it("erases dragged tiles and their descendants in one finished world", () => {
    const paintGesture = createEditGesture("paint", createEmptyWorld(), 1, "forest");
    applyEditGestureCells(paintGesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);

    const eraseGesture = createEditGesture("erase", paintGesture.world, 1, "forest");
    applyEditGestureCells(eraseGesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);

    expect(finishGestureSession(eraseGesture).changed).toBe(true);
    expect(getLevelMap(eraseGesture.world, 1).size).toBe(0);
    expect(getLevelMap(eraseGesture.world, 2).size).toBe(0);
  });
});
