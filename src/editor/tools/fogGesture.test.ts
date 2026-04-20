import { describe, expect, it } from "vitest";
import {
  addFeature,
  addTile,
  createEmptyWorld,
  createFeature,
  getFeatureAt,
  getLevelMap,
  setCellHidden,
} from "@/core/map/world";
import {
  applyFogGestureCells,
  createFogGesture,
  finishFogGesture,
} from "./fogGesture";

describe("fog gestures", () => {
  it("left click hides visible terrain", () => {
    const world = addFeature(
      setCellHidden(
        addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain"),
        3,
        { q: 0, r: 0 },
        false,
      ),
      3,
      {
        ...createFeature("feature-1", "city", "0,0"),
        hidden: false,
      },
    );
    const gesture = createFogGesture("paint", world, 3, { q: 0, r: 0 });

    applyFogGestureCells(gesture, [
      { q: 0, r: 0 },
      { q: 0, r: 0 },
    ]);

    const commit = finishFogGesture(gesture);

    expect(commit.changed).toBe(true);
    expect(commit.operations).toEqual([
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: "plain", hidden: true }],
      },
    ]);
    expect(getFeatureAt(gesture.world, 3, { q: 0, r: 0 })?.hidden).toBe(false);
    expect(getLevelMap(gesture.world, 3).get("0,0")?.hidden).toBe(true);
  });

  it("left click reveals hidden terrain when the first clicked cell is hidden", () => {
    const world = setCellHidden(
      addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain"),
      3,
      { q: 0, r: 0 },
      true,
    );
    const gesture = createFogGesture("paint", world, 3, { q: 0, r: 0 });

    applyFogGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(finishFogGesture(gesture).operations).toEqual([
      {
        type: "set_tiles",
        tiles: [{ q: 0, r: 0, terrain: "plain", hidden: false }],
      },
    ]);
    expect(getLevelMap(gesture.world, 3).get("0,0")?.hidden).toBe(false);
  });

  it("right click hides a visible feature", () => {
    const world = addFeature(
      addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain"),
      3,
      {
        ...createFeature("feature-1", "city", "0,0"),
        hidden: false,
      },
    );
    const gesture = createFogGesture("erase", world, 3, { q: 0, r: 0 });

    applyFogGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(finishFogGesture(gesture).operations).toEqual([
      {
        type: "update_feature",
        featureId: "feature-1",
        patch: { hidden: true },
      },
    ]);
    expect(getFeatureAt(gesture.world, 3, { q: 0, r: 0 })?.hidden).toBe(true);
  });

  it("right click reveals a hidden feature when the first clicked feature is hidden", () => {
    const world = addFeature(
      setCellHidden(
        addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain"),
        3,
        { q: 0, r: 0 },
        false,
      ),
      3,
      {
        ...createFeature("feature-1", "city", "0,0"),
        hidden: true,
      },
    );
    const gesture = createFogGesture("erase", world, 3, { q: 0, r: 0 });

    applyFogGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(finishFogGesture(gesture).operations).toEqual([
      {
        type: "update_feature",
        featureId: "feature-1",
        patch: { hidden: false },
      },
    ]);
    expect(getFeatureAt(gesture.world, 3, { q: 0, r: 0 })?.hidden).toBe(false);
  });

  it("becomes a no-op when the first clicked cell has no applicable fog target", () => {
    const world = createEmptyWorld();
    const gesture = createFogGesture("erase", world, 3, { q: 0, r: 0 });

    applyFogGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(finishFogGesture(gesture).changed).toBe(false);
    expect(finishFogGesture(gesture).operations).toEqual([]);
  });
});
