import capital from "./features/capital.svg";
import camp from "./features/camp.png";
import citadel from "./features/bastion.png";
import city from "./features/city.svg";
import donjon from "./features/dungeon.svg";
import fort from "./features/fort.svg";
import megadungeon from "./features/megadungeon.png";
import ruin from "./features/ruin.svg";
import village from "./features/village.svg";
import overRideCamp from "./features/camp.png";
import overRideCitadel from "./features/bastion.png";
import overRideVillage from "./features/village.png";
import overRideCapital from "./features/capital.png";
import overRideFort from "./features/fort.png";
import overRideRuin from "./features/ruin.png";
import overRideDonjon from "./features/dungeon.png";
import overRideCity from "./features/city.png";
import overRideMegadungeon from "./features/megadungeon.png";

import {
  canFeatureKindOverrideTerrain,
  type FeatureKind,
} from "@/core/map/features";
import {
  defineMapImageAsset,
  type MapImageAsset,
  type MapImageAssetRegistry,
} from "./mapImageAssets";

// PNG assets can also be registered from public URLs:
// city: defineMapImageAsset("/assets/features/city.png")
export const featureAssets: MapImageAssetRegistry<FeatureKind> = {
  camp: defineMapImageAsset(camp),
  citadel: defineMapImageAsset(citadel),
  capital: defineMapImageAsset(capital),
  city: defineMapImageAsset(city),
  donjon: defineMapImageAsset(donjon),
  fort: defineMapImageAsset(fort),
  megadungeon: defineMapImageAsset(megadungeon),
  ruin: defineMapImageAsset(ruin),
  village: defineMapImageAsset(village),
};

export const featureTerrainOverrideAssets: MapImageAssetRegistry<FeatureKind> =
  {
    camp: defineMapImageAsset(overRideCamp),
    citadel: defineMapImageAsset(overRideCitadel),
    capital: defineMapImageAsset(overRideCapital),
    city: defineMapImageAsset(overRideCity),
    donjon: defineMapImageAsset(overRideDonjon),
    fort: defineMapImageAsset(overRideFort),
    megadungeon: defineMapImageAsset(overRideMegadungeon),
    ruin: defineMapImageAsset(overRideRuin),
    village: defineMapImageAsset(overRideVillage),
  };

export function getFeatureAsset(type: FeatureKind): MapImageAsset | undefined {
  return featureAssets[type];
}

export function getFeatureTerrainOverrideAsset(
  type: FeatureKind,
): MapImageAsset | undefined {
  return featureTerrainOverrideAssets[type];
}

export function canFeatureOverrideTerrain(type: FeatureKind): boolean {
  return (
    canFeatureKindOverrideTerrain(type) &&
    Boolean(getFeatureTerrainOverrideAsset(type))
  );
}
