import { describe, expect, it } from "vitest";
import { createEmptyWorld, getLevelMap, addTile } from "./world";
import {
  addFeature,
  getFeatureAt,
  getFeatureById,
  getFeatureLevelForKind,
  getFeaturesForLevel,
  isFeatureVisible,
  removeFeatureAt,
  updateFeature,
} from "./features";

describe("features", () => {
  it("stores features separately from terrain tiles", () => {
    const terrainWorld = addTile(
      createEmptyWorld(),
      3,
      { q: 2, r: -1 },
      "forest",
    );
    const world = addFeature(terrainWorld, 3, {
      id: "f1",
      kind: "city",
      hexId: "2,-1",
      hidden: false,
    });

    expect(getLevelMap(world, 3).get("2,-1")).toEqual({
      hidden: true,
      type: "forest",
    });
    expect(getFeatureAt(world, 3, { q: 2, r: -1 })).toEqual({
      id: "f1",
      kind: "city",
      featureLevel: 2,
      hexId: "2,-1",
      hidden: false,
    });
  });

  it("keeps at most one feature on one hex", () => {
    const first = addFeature(createEmptyWorld(), 3, {
      id: "f1",
      kind: "ruin",
      hexId: "0,0",
      hidden: false,
    });
    const second = addFeature(first, 3, {
      id: "f2",
      kind: "donjon",
      hexId: "0,0",
      hidden: true,
    });

    expect(second).toBe(first);
    expect(getFeatureAt(second, 3, { q: 0, r: 0 })).toEqual({
      id: "f1",
      kind: "ruin",
      featureLevel: 1,
      hexId: "0,0",
      hidden: false,
    });
  });

  it("does not create or remove source features outside level 3", () => {
    const unchanged = addFeature(createEmptyWorld(), 2, {
      id: "f1",
      kind: "city",
      hexId: "0,0",
      hidden: false,
    });

    expect(unchanged).toEqual(createEmptyWorld());

    const withFeature = addFeature(createEmptyWorld(), 3, {
      id: "f2",
      kind: "city",
      hexId: "0,0",
      hidden: false,
    });

    expect(removeFeatureAt(withFeature, 2, { q: 0, r: 0 })).toBe(withFeature);
  });

  it("updates a selected feature by id", () => {
    const world = addFeature(createEmptyWorld(), 3, {
      id: "f1",
      kind: "camp",
      hexId: "0,0",
      hidden: false,
    });
    const nextWorld = updateFeature(world, 3, "f1", {
      hidden: true,
    });

    expect(getFeatureById(nextWorld, 3, "f1")).toEqual({
      id: "f1",
      kind: "camp",
      featureLevel: 1,
      hexId: "0,0",
      hidden: true,
    });
  });

  it("filters derived features by feature level", () => {
    const world = addFeature(createEmptyWorld(), 3, {
      id: "f1",
      kind: "camp",
      hexId: "0,0",
      hidden: false,
    });
    const nextWorld = addFeature(world, 3, {
      id: "f2",
      kind: "city",
      hexId: "1,0",
      hidden: false,
    });
    const finalWorld = addFeature(nextWorld, 3, {
      id: "f3",
      kind: "capital",
      hexId: "2,0",
      hidden: false,
    });

    expect(
      Array.from(getFeaturesForLevel(finalWorld, 3).values()),
    ).toHaveLength(3);
    expect(
      Array.from(getFeaturesForLevel(finalWorld, 2).values()),
    ).toHaveLength(2);
    expect(
      Array.from(getFeaturesForLevel(finalWorld, 1).values()),
    ).toHaveLength(1);
    expect(
      Array.from(getFeaturesForLevel(finalWorld, 1).values()).map(
        (feature) => feature.kind,
      ),
    ).toEqual(["capital"]);
  });

  it("routes derived hidden updates back to the source feature", () => {
    const world = addFeature(createEmptyWorld(), 3, {
      id: "f1",
      kind: "capital",
      hexId: "0,0",
      hidden: false,
    });

    const nextWorld = updateFeature(world, 2, "f1", { hidden: true });

    expect(getFeatureById(nextWorld, 3, "f1")).toMatchObject({
      hidden: true,
      kind: "capital",
    });
  });

  it("derives feature levels from feature kind", () => {
    expect(getFeatureLevelForKind("camp")).toBe(1);
    expect(getFeatureLevelForKind("city")).toBe(2);
    expect(getFeatureLevelForKind("capital")).toBe(3);
  });

  it("shows hidden features to GMs but not players", () => {
    const hiddenFeature = {
      id: "f1",
      kind: "camp",
      featureLevel: 1,
      hexId: "0,0",
      hidden: true,
    } as const;

    expect(isFeatureVisible(hiddenFeature, "gm")).toBe(true);
    expect(isFeatureVisible(hiddenFeature, "player")).toBe(false);
    expect(
      isFeatureVisible({ ...hiddenFeature, hidden: false }, "player"),
    ).toBe(true);
  });
});
