import { describe, expect, it } from "vitest";
import { addFeature, getFeatureAt } from "@/domain/world/features";
import { createEmptyWorld } from "@/domain/world/world";
import {
  placeOrSelectFeature,
  removeFeatureOnHex
} from "./featureActions";

describe("feature actions", () => {
  it("places a feature on an empty hex without opening selection", () => {
    let nextId = 0;
    const result = placeOrSelectFeature(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      "village",
      () => `f${(nextId += 1)}`
    );

    expect(result.selectedFeatureId).toBeNull();
    expect(getFeatureAt(result.world, 3, { q: 0, r: 0 })).toEqual({
      id: "f1",
      kind: "village",
      hexId: "0,0",
      overrideTerrainTile: true,
      hidden: false,
      labelRevealed: false
    });
  });

  it("selects an existing feature without replacing it", () => {
    const placed = placeOrSelectFeature(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      "village",
      () => "f1"
    );
    const selected = placeOrSelectFeature(
      placed.world,
      3,
      { q: 0, r: 0 },
      "dungeon",
      () => "f2"
    );

    expect(selected.world).toBe(placed.world);
    expect(selected.selectedFeatureId).toBe("f1");
    expect(getFeatureAt(selected.world, 3, { q: 0, r: 0 })?.kind).toBe("village");
  });

  it("removes the feature on a hex without type-specific deletion", () => {
    const placed = placeOrSelectFeature(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      "city",
      () => "f1"
    );
    const removed = removeFeatureOnHex(
      placed.world,
      3,
      { q: 0, r: 0 },
      placed.selectedFeatureId
    );

    expect(removed.selectedFeatureId).toBeNull();
    expect(getFeatureAt(removed.world, 3, { q: 0, r: 0 })).toBeNull();
  });

  it("clears selection when removing on an empty hex", () => {
    const result = removeFeatureOnHex(
      createEmptyWorld(),
      3,
      { q: 0, r: 0 },
      "selected"
    );

    expect(result.selectedFeatureId).toBeNull();
  });

  it("does not create or delete features on derived levels", () => {
    const createResult = placeOrSelectFeature(
      createEmptyWorld(),
      2,
      { q: 0, r: 0 },
      "village",
      () => "f1"
    );

    expect(createResult.world).toEqual(createEmptyWorld());
    expect(createResult.selectedFeatureId).toBeNull();

    const world = addFeature(createEmptyWorld(), 3, {
      id: "f2",
      kind: "city",
      hexId: "0,0",
      hidden: false
    });
    const removeResult = removeFeatureOnHex(world, 2, { q: 0, r: 0 }, null);

    expect(removeResult.world).toBe(world);
    expect(removeResult.selectedFeatureId).toBe("f2");
  });
});
