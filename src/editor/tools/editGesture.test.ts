import { describe, expect, it } from "vitest";
import { createEmptyWorld, getLevelMap } from "@/domain/world/world";
import { applyEditGestureCells, createEditGesture, getFinishedGestureWorld } from "./editGesture";

describe("edit gestures", () => {
  it("paints multiple cells into one finished world and ignores duplicate hexes", () => {
    const gesture = createEditGesture("paint", createEmptyWorld(), 1, "forest", 2);

    applyEditGestureCells(gesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 0 }
    ]);

    const finishedWorld = getFinishedGestureWorld(gesture);

    expect(finishedWorld).not.toBeNull();
    expect(gesture.touchedKeys.size).toBe(2);
    expect(getLevelMap(gesture.world, 1).size).toBe(2);
    expect(getLevelMap(gesture.world, 2).size).toBe(14);
  });

  it("does not finish with a changed world when erasing empty hexes", () => {
    const gesture = createEditGesture("erase", createEmptyWorld(), 1, "plain", 2);

    applyEditGestureCells(gesture, [{ q: 8, r: -3 }]);

    expect(getFinishedGestureWorld(gesture)).toBeNull();
    expect(gesture.touchedKeys.size).toBe(1);
  });

  it("erases dragged tiles and their descendants in one finished world", () => {
    const paintGesture = createEditGesture("paint", createEmptyWorld(), 1, "forest", 2);
    applyEditGestureCells(paintGesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);

    const eraseGesture = createEditGesture("erase", paintGesture.world, 1, "forest", 2);
    applyEditGestureCells(eraseGesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);

    expect(getFinishedGestureWorld(eraseGesture)).not.toBeNull();
    expect(getLevelMap(eraseGesture.world, 1).size).toBe(0);
    expect(getLevelMap(eraseGesture.world, 2).size).toBe(0);
  });
});
