import { describe, expect, it } from "vitest";
import { createEmptyWorld, getLevelMap, addTile } from "./world";
import {
  addFeature,
  getFeatureAt,
  getFeatureById,
  getFeatureLabel,
  getFeaturesForLevel,
  isFeatureVisible,
  removeFeatureAt,
  updateFeature
} from "./features";
import type { MapState } from "./world";

describe("features", () => {
  it("stores features separately from terrain tiles", () => {
    const terrainWorld = addTile(createEmptyWorld(), 3, { q: 2, r: -1 }, "forest");
    const world = addFeature(terrainWorld, 3, {
      id: "f1",
      kind: "city",
      hexId: "2,-1",
      hidden: false,
      gmLabel: "Blackford"
    });

    expect(getLevelMap(world, 3).get("2,-1")).toEqual({ hidden: false, type: "forest" });
    expect(getFeatureAt(world, 3, { q: 2, r: -1 })).toEqual({
      id: "f1",
      kind: "city",
      hexId: "2,-1",
      overrideTerrainTile: true,
      hidden: false,
      gmLabel: "Blackford"
    });
  });

  it("keeps at most one feature on one hex", () => {
    const first = addFeature(createEmptyWorld(), 3, {
      id: "f1",
      kind: "ruin",
      hexId: "0,0",
      hidden: false
    });
    const second = addFeature(first, 3, {
      id: "f2",
      kind: "dungeon",
      hexId: "0,0",
      hidden: true,
      gmLabel: "Steps",
      playerLabel: "Old cellar",
      labelRevealed: false
    });

    expect(second).toBe(first);
    expect(getFeatureAt(second, 3, { q: 0, r: 0 })).toEqual({
      id: "f1",
      kind: "ruin",
      hexId: "0,0",
      overrideTerrainTile: true,
      hidden: false
    });
  });

  it("does not create or remove source features outside level 3", () => {
    const unchanged = addFeature(createEmptyWorld(), 2, {
      id: "f1",
      kind: "city",
      hexId: "0,0",
      hidden: false
    });

    expect(unchanged).toEqual(createEmptyWorld());

    const withFeature = addFeature(createEmptyWorld(), 3, {
      id: "f2",
      kind: "city",
      hexId: "0,0",
      hidden: false
    });

    expect(removeFeatureAt(withFeature, 2, { q: 0, r: 0 })).toBe(withFeature);
  });

  it("updates a selected feature by id", () => {
    const world = addFeature(createEmptyWorld(), 3, {
      id: "f1",
      kind: "marker",
      hexId: "0,0",
      hidden: false
    });
    const nextWorld = updateFeature(world, 3, "f1", {
      gmLabel: "Secret",
      hidden: true
    });

    expect(getFeatureById(nextWorld, 3, "f1")).toEqual({
      id: "f1",
      kind: "marker",
      hexId: "0,0",
      overrideTerrainTile: false,
      hidden: true,
      gmLabel: "Secret",
      playerLabel: undefined,
      labelRevealed: undefined
    });
  });

  it("derives parent features from level 3 and routes metadata edits to the source feature", () => {
    const world = addFeature(createEmptyWorld(), 3, {
      id: "f1",
      kind: "marker",
      hexId: "0,0",
      hidden: false
    });

    expect(getFeatureAt(world, 2, { q: 0, r: 0 })).toEqual({
      id: "f1",
      kind: "marker",
      hexId: "0,0",
      overrideTerrainTile: false,
      hidden: false
    });

    const nextWorld = updateFeature(world, 2, "f1", {
      gmLabel: "Source label",
      hidden: true,
      kind: "city"
    });

    expect(getFeatureById(nextWorld, 3, "f1")).toMatchObject({
      gmLabel: "Source label",
      hidden: true,
      kind: "marker"
    });
  });

  it("keeps GM labels separate from player labels", () => {
    const feature = {
      id: "f1",
      kind: "label",
      hexId: "0,0",
      overrideTerrainTile: false,
      hidden: false,
      gmLabel: "Secret shrine",
      playerLabel: "Weathered stones",
      labelRevealed: false
    } as const;

    expect(getFeatureLabel(feature, "gm")).toBe("Secret shrine");
    expect(getFeatureLabel(feature, "player")).toBeUndefined();
    expect(getFeatureLabel({ ...feature, labelRevealed: true }, "player")).toBe("Weathered stones");
  });

  it("shows hidden features to GMs but not players", () => {
    const hiddenFeature = {
      id: "f1",
      kind: "marker",
      hexId: "0,0",
      overrideTerrainTile: false,
      hidden: true
    } as const;

    expect(isFeatureVisible(hiddenFeature, "gm")).toBe(true);
    expect(isFeatureVisible(hiddenFeature, "player")).toBe(false);
    expect(isFeatureVisible({ ...hiddenFeature, hidden: false }, "player")).toBe(true);
  });
});
