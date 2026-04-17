export type MapImageAsset = {
  src: string;
};

export type MapImageAssetRegistry<Key extends string> = Partial<Record<Key, MapImageAsset>>;

export type AssetCatalog<TTerrain extends string, TFeature extends string> = {
  features: MapImageAssetRegistry<TFeature>;
  terrain: MapImageAssetRegistry<TTerrain>;
};

export function defineMapImageAsset(src: string): MapImageAsset {
  return { src };
}

export function getRegisteredAssetSources<Key extends string>(
  registries: Array<MapImageAssetRegistry<Key>>
): string[] {
  return Array.from(
    new Set(
      registries
        .flatMap((registry) => Object.values(registry) as Array<MapImageAsset | undefined>)
        .map((asset) => asset?.src)
        .filter((src): src is string => Boolean(src))
    )
  );
}

export function getRegisteredSourcesFromMixedRegistries(
  registries: Array<Record<string, MapImageAsset | undefined>>
): string[] {
  return Array.from(
    new Set(
      registries
        .flatMap((registry) => Object.values(registry))
        .map((asset) => asset?.src)
        .filter((src): src is string => Boolean(src))
    )
  );
}
