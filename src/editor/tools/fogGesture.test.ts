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
  it("left click puts fog on visible feature before terrain", () => {
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
    const gesture = createFogGesture("paint", world, 3);

    applyFogGestureCells(gesture, [
      { q: 0, r: 0 },
      { q: 0, r: 0 },
    ]);

    const commit = finishFogGesture(gesture);

    expect(commit.changed).toBe(true);
    expect(commit.operations).toEqual([
      {
        type: "set_feature_hidden",
        featureId: "feature-1",
        hidden: true,
      },
    ]);
    expect(getFeatureAt(gesture.world, 3, { q: 0, r: 0 })?.hidden).toBe(true);
    expect(getLevelMap(gesture.world, 3).get("0,0")?.hidden).toBe(false);
  });

  it("left click puts fog on visible terrain when there is no visible feature", () => {
    const world = setCellHidden(
      addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain"),
      3,
      { q: 0, r: 0 },
      false,
    );
    const gesture = createFogGesture("paint", world, 3);

    applyFogGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(finishFogGesture(gesture).operations).toEqual([
      {
        type: "set_cells_hidden",
        cells: [{ q: 0, r: 0 }],
        hidden: true,
      },
    ]);
    expect(getLevelMap(gesture.world, 3).get("0,0")?.hidden).toBe(true);
  });

  it("right click removes terrain fog before hidden feature fog", () => {
    const world = addFeature(
      addTile(createEmptyWorld(), 3, { q: 0, r: 0 }, "plain"),
      3,
      {
        ...createFeature("feature-1", "city", "0,0"),
        hidden: true,
      },
    );
    const gesture = createFogGesture("erase", world, 3);

    applyFogGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(finishFogGesture(gesture).operations).toEqual([
      {
        type: "set_cells_hidden",
        cells: [{ q: 0, r: 0 }],
        hidden: false,
      },
    ]);
    expect(getLevelMap(gesture.world, 3).get("0,0")?.hidden).toBe(false);
    expect(getFeatureAt(gesture.world, 3, { q: 0, r: 0 })?.hidden).toBe(true);
  });

  it("right click removes feature fog when terrain is already visible", () => {
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
    const gesture = createFogGesture("erase", world, 3);

    applyFogGestureCells(gesture, [{ q: 0, r: 0 }]);

    expect(finishFogGesture(gesture).operations).toEqual([
      {
        type: "set_feature_hidden",
        featureId: "feature-1",
        hidden: false,
      },
    ]);
    expect(getFeatureAt(gesture.world, 3, { q: 0, r: 0 })?.hidden).toBe(false);
  });
});
