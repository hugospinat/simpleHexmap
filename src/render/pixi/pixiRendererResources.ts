import { createSpritePool, createTextPool } from "./pixiLayers";
import type { PixiObjectPools } from "./pixiTypes";

export function createPixiRendererPools(): PixiObjectPools {
  return {
    coordinateTexts: createTextPool(),
    featureSprites: createSpritePool(),
    labelTexts: createTextPool(),
    noteTexts: createTextPool(),
    previewTerrainSprites: createSpritePool(),
    roadSprites: createSpritePool(),
    terrainSprites: createSpritePool(),
  };
}

export function destroyPixiRendererPools(pools: PixiObjectPools): void {
  pools.featureSprites.destroy();
  pools.coordinateTexts.destroy();
  pools.labelTexts.destroy();
  pools.noteTexts.destroy();
  pools.previewTerrainSprites.destroy();
  pools.roadSprites.destroy();
  pools.terrainSprites.destroy();
}

export function countPixiRendererSprites(pools: PixiObjectPools): number {
  return (
    pools.terrainSprites.size() +
    pools.roadSprites.size() +
    pools.featureSprites.size() +
    pools.labelTexts.size() +
    pools.noteTexts.size() +
    pools.previewTerrainSprites.size() +
    pools.coordinateTexts.size()
  );
}
