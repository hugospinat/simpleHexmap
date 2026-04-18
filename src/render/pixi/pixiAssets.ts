import { Assets, Texture } from "pixi.js";
import {
  featureAssets,
  featureTerrainOverrideAssets
} from "@/assets/featureAssets";
import {
  getRoadPathAsset,
  terrainAssets
} from "@/assets/terrainAssets";
import type { PixiAssetCatalog } from "./pixiTypes";

let catalogPromise: Promise<PixiAssetCatalog> | null = null;

async function loadTexture(src: string): Promise<Texture | null> {
  try {
    return await Assets.load<Texture>(src);
  } catch {
    try {
      return Texture.from(src);
    } catch {
      return null;
    }
  }
}

async function loadRegistryTextures(registry: Record<string, { src: string } | undefined>): Promise<Map<string, Texture>> {
  const entries = await Promise.all(
    Object.entries(registry).map(async ([key, asset]) => {
      if (!asset) {
        return null;
      }

      const texture = await loadTexture(asset.src);
      return texture ? ([key, texture] as const) : null;
    })
  );

  return new Map(entries.filter((entry): entry is readonly [string, Texture] => Boolean(entry)));
}

export function loadPixiAssetCatalog(): Promise<PixiAssetCatalog> {
  catalogPromise ??= (async () => {
    const [
      terrainTextures,
      featureTextures,
      featureTerrainOverrideTextures,
      roadTexture
    ] = await Promise.all([
      loadRegistryTextures(terrainAssets),
      loadRegistryTextures(featureAssets),
      loadRegistryTextures(featureTerrainOverrideAssets),
      loadTexture(getRoadPathAsset().src)
    ]);

    return {
      fallbackTextures: new Map([["white", Texture.WHITE]]),
      featureTerrainOverrideTextures,
      featureTextures,
      ready: true,
      roadTexture,
      terrainTextures
    };
  })();

  return catalogPromise;
}

export function createEmptyPixiAssetCatalog(): PixiAssetCatalog {
  return {
    fallbackTextures: new Map([["white", Texture.WHITE]]),
    featureTerrainOverrideTextures: new Map(),
    featureTextures: new Map(),
    ready: false,
    roadTexture: null,
    terrainTextures: new Map()
  };
}

