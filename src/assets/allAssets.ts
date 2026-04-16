import { featureAssets } from "./featureAssets";
import { getRegisteredSourcesFromMixedRegistries } from "./mapImageAssets";
import { roadPathAsset, terrainAssets } from "./terrainAssets";

export function getAllMapAssetSources(): string[] {
  return getRegisteredSourcesFromMixedRegistries([
    terrainAssets,
    featureAssets,
    { roadPath: roadPathAsset }
  ]);
}
