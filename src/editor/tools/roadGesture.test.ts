import { describe, expect, it } from "vitest";
import { createEmptyWorld, getRoadEdgesAt, getRoadLevelMap } from "@/domain/world/world";
import {
  applyRoadGestureCells,
  createRoadGesture,
  getFinishedRoadGestureWorld
} from "./roadGesture";

describe("road gestures", () => {
  it("adds road connections between consecutive dragged hexes", () => {
    const gesture = createRoadGesture("add", createEmptyWorld(), 3);

    applyRoadGestureCells(gesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 }
    ]);

    expect(getFinishedRoadGestureWorld(gesture)).not.toBeNull();
    expect(Array.from(getRoadEdgesAt(gesture.world, 3, { q: 1, r: 0 })).sort()).toEqual([2, 5]);
    expect(getRoadLevelMap(gesture.world, 3).size).toBe(3);
  });

  it("does not finish when no connection was created", () => {
    const gesture = createRoadGesture("add", createEmptyWorld(), 3);

    applyRoadGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(getFinishedRoadGestureWorld(gesture)).toBeNull();
  });

  it("removes road connections touching dragged hexes", () => {
    const addGesture = createRoadGesture("add", createEmptyWorld(), 3);
    applyRoadGestureCells(addGesture, [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 }
    ]);

    const removeGesture = createRoadGesture("remove", addGesture.world, 3);
    applyRoadGestureCells(removeGesture, [{ q: 1, r: 0 }]);

    expect(getFinishedRoadGestureWorld(removeGesture)).not.toBeNull();
    expect(getRoadLevelMap(removeGesture.world, 3).size).toBe(0);
  });
});
