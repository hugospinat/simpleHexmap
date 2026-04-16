import { describe, expect, it } from "vitest";
import {
  defineMapImageAsset,
  getRegisteredSourcesFromMixedRegistries,
  type MapImageAssetRegistry
} from "./mapImageAssets";
import { terrainAssets } from "./terrainAssets";

type TestTerrain = "forest" | "plain";
type TestFeature = "city" | "label";

describe("map image assets", () => {
  it("treats svg and png paths as generic image sources", () => {
    const terrain: MapImageAssetRegistry<TestTerrain> = {
      forest: defineMapImageAsset("/assets/terrain/forest.png")
    };
    const features: MapImageAssetRegistry<TestFeature> = {
      city: defineMapImageAsset("/assets/features/city.svg")
    };

    expect(getRegisteredSourcesFromMixedRegistries([terrain, features])).toEqual([
      "/assets/terrain/forest.png",
      "/assets/features/city.svg"
    ]);
  });

  it("deduplicates repeated image paths", () => {
    expect(
      getRegisteredSourcesFromMixedRegistries([
        { forest: defineMapImageAsset("/assets/shared.png") },
        { city: defineMapImageAsset("/assets/shared.png") }
      ])
    ).toEqual(["/assets/shared.png"]);
  });

  it("registers artwork for every terrain type except empty", () => {
    expect(terrainAssets.empty).toBeUndefined();
    expect(terrainAssets.water?.src).toBeTruthy();
    expect(terrainAssets.plain?.src).toBeTruthy();
    expect(terrainAssets.forest?.src).toBeTruthy();
    expect(terrainAssets.hill?.src).toBeTruthy();
    expect(terrainAssets.mountain?.src).toBeTruthy();
    expect(terrainAssets.desert?.src).toBeTruthy();
    expect(terrainAssets.swamp?.src).toBeTruthy();
    expect(terrainAssets.tundra?.src).toBeTruthy();
    expect(terrainAssets.wasteland?.src).toBeTruthy();
  });
});
