import { describe, expect, it } from "vitest";
import { createEmptyWorld, getRiverLevelMap } from "@/core/map/world";
import {
  applyRiverGestureEdges,
  createRiverGesture
} from "./riverGesture";
import { finishGestureSession } from "./gestureSession";

describe("river gestures", () => {
  it("adds dragged edges and deduplicates opposite-side repeats", () => {
    const gesture = createRiverGesture("add", createEmptyWorld(), 3);

    applyRiverGestureEdges(gesture, [
      { axial: { q: 0, r: 0 }, edge: 0 },
      { axial: { q: 0, r: 1 }, edge: 3 },
      { axial: { q: 0, r: 0 }, edge: 0 }
    ]);

    expect(finishGestureSession(gesture).changed).toBe(true);
    expect(gesture.touchedEdgeKeys.size).toBe(1);
    expect(getRiverLevelMap(gesture.world, 3).get("0,0")?.has(0)).toBe(true);
    expect(getRiverLevelMap(gesture.world, 3).get("0,1")?.has(3)).toBe(true);
  });

  it("does not finish when removing an edge that does not exist", () => {
    const gesture = createRiverGesture("remove", createEmptyWorld(), 3);

    applyRiverGestureEdges(gesture, [{ axial: { q: 8, r: -3 }, edge: 2 }]);

    expect(finishGestureSession(gesture).changed).toBe(false);
    expect(gesture.touchedEdgeKeys.size).toBe(1);
  });
});
