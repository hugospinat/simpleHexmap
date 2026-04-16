import desert from "./terrain/dessert.png";
import forest from "./terrain/forest.png";
import tundra from "./terrain/tundra.png";
import mountain from "./terrain/mountain.png";
import path from "./terrain/path.png";
import plain from "./terrain/plain.png";
import wasteland from "./terrain/wasteland.png";
import water from "./terrain/water.png";
import swamp from "./terrain/swamp.png";
import hill from "./terrain/hill.png";
import type { TerrainType } from "@/domain/world/world";
import {
  defineMapImageAsset,
  type MapImageAsset,
  type MapImageAssetRegistry
} from "./mapImageAssets";

export type { MapImageAsset };

// PNG assets can be imported and registered the same way:
// import forestPng from "./terrain/forest.png";
// forest: defineMapImageAsset(forestPng)
export const terrainAssets: MapImageAssetRegistry<TerrainType> = {
  water: defineMapImageAsset(water),
  plain: defineMapImageAsset(plain),
  forest: defineMapImageAsset(forest),
  hill: defineMapImageAsset(hill),
  mountain: defineMapImageAsset(mountain),
  desert: defineMapImageAsset(desert),
  swamp: defineMapImageAsset(swamp),
  tundra: defineMapImageAsset(tundra),
  wasteland: defineMapImageAsset(wasteland)
};

export const roadPathAsset = defineMapImageAsset(path);

export function getTerrainAsset(tileType: TerrainType): MapImageAsset | undefined {
  return terrainAssets[tileType];
}

export function getRoadPathAsset(): MapImageAsset {
  return roadPathAsset;
}
