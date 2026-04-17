import capital from "./features/capital.svg";
import city from "./features/city.svg";
import dungeon from "./features/dungeon.svg";
import fort from "./features/fort.svg";
import marker from "./features/marker.svg";
import ruin from "./features/ruin.svg";
import tower from "./features/tower.svg";
import village from "./features/village.svg";
import overRideVillage from "./features/village.png";
import overRideTower from "./features/tower.png";
import overRideCapital from "./features/capital.png";
import overRideFort from "./features/fort.png";
import overRideRuin from "./features/ruin.png";
import overRideDungeon from "./features/dungeon.png";
import overRideCity from "./features/city.png";

import type { FeatureKind } from "@/domain/world/features";
import {
  defineMapImageAsset,
  type MapImageAsset,
  type MapImageAssetRegistry
} from "./mapImageAssets";

// PNG assets can also be registered from public URLs:
// city: defineMapImageAsset("/assets/features/city.png")
export const featureAssets: MapImageAssetRegistry<FeatureKind> = {
  capital: defineMapImageAsset(capital),
  city: defineMapImageAsset(city),
  dungeon: defineMapImageAsset(dungeon),
  fort: defineMapImageAsset(fort),
  marker: defineMapImageAsset(marker),
  ruin: defineMapImageAsset(ruin),
  tower: defineMapImageAsset(tower),
  village: defineMapImageAsset(village)
};

const featureTerrainOverrideAssets: MapImageAssetRegistry<FeatureKind> = {
  capital: defineMapImageAsset(overRideCapital),
  city: defineMapImageAsset(overRideCity),
  dungeon: defineMapImageAsset(overRideDungeon),
  fort: defineMapImageAsset(overRideFort),
  ruin: defineMapImageAsset(overRideRuin),
  tower: defineMapImageAsset(overRideTower),
  village: defineMapImageAsset(overRideVillage)
};

export function getFeatureAsset(type: FeatureKind): MapImageAsset | undefined {
  return featureAssets[type];
}

export function getFeatureTerrainOverrideAsset(type: FeatureKind): MapImageAsset | undefined {
  return featureTerrainOverrideAssets[type];
}

export function canFeatureOverrideTerrain(type: FeatureKind): boolean {
  if (type === "label" || type === "marker") {
    return false;
  }

  return Boolean(getFeatureTerrainOverrideAsset(type));
}
