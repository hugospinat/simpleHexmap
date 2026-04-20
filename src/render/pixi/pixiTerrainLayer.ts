import { Graphics, TextStyle, Texture, type Container } from "pixi.js";
import { getLevelRotation } from "@/core/geometry/hex";
import { tileColors } from "@/core/map/world";
import { canFeatureOverrideTerrain } from "@/assets/featureAssets";
import { parseCssColor, pathPolygon } from "./pixiLayers";
import type {
  PixiAssetCatalog,
  PixiObjectPools,
  PixiSceneCellRecord,
  PixiSceneRenderFrame,
} from "./pixiTypes";

export type PixiTerrainLayerStats = {
  labels: number;
  terrainOverriddenHexes: Set<string>;
  tiles: number;
};

const coordinateTextStyle = new TextStyle({
  fill: "#777777",
  fontFamily: "Georgia, Times New Roman, serif",
  fontSize: 10,
});

function fitTextureSizePreservingAspect(
  texture: Texture,
  maxWidth: number,
  maxHeight: number,
): { height: number; width: number } {
  const sourceWidth = Math.max(1, texture.width);
  const sourceHeight = Math.max(1, texture.height);
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);

  return {
    height: sourceHeight * scale,
    width: sourceWidth * scale,
  };
}

function textureForCell(
  cell: PixiSceneCellRecord,
  assets: PixiAssetCatalog,
): Texture | null {
  if (
    cell.feature &&
    !cell.feature.hidden &&
    canFeatureOverrideTerrain(cell.feature.kind)
  ) {
    const overrideTexture = assets.featureTerrainOverrideTextures.get(
      cell.feature.kind,
    );

    if (overrideTexture) {
      return overrideTexture;
    }
  }

  return assets.terrainTextures.get(cell.cell.type) ?? null;
}

function drawFallbackTerrain(
  graphics: Graphics,
  cells: PixiSceneCellRecord[],
): void {
  if (cells.length === 0) {
    return;
  }

  for (const terrainType of Object.keys(tileColors) as Array<
    keyof typeof tileColors
  >) {
    const color = parseCssColor(tileColors[terrainType]);
    let hasTerrain = false;

    for (const cell of cells) {
      if (cell.cell.type !== terrainType) {
        continue;
      }

      pathPolygon(graphics, cell.worldCorners);
      hasTerrain = true;
    }

    if (hasTerrain) {
      graphics.fill({ color });
    }
  }
}

function drawCoordinateLabels(
  frame: PixiSceneRenderFrame,
  pools: PixiObjectPools,
  parent: Container,
  showCoordinates: boolean,
): number {
  const visibleKeys = new Set<string>();

  if (!showCoordinates || frame.transform.scaleMapLength(32) <= 14) {
    pools.coordinateTexts.releaseUnused(visibleKeys);
    return 0;
  }

  const rotation = getLevelRotation(frame.transform.level);

  for (const cell of frame.visibleTerrainCells) {
    const key = `coord:${cell.key}`;
    visibleKeys.add(key);
    const text = pools.coordinateTexts.acquire(key, parent);
    if (text.text !== cell.key) {
      text.text = cell.key;
    }
    if (text.style !== coordinateTextStyle) {
      text.style = coordinateTextStyle;
    }
    text.anchor.set(0.5);
    text.position.set(cell.worldCenter.x, cell.worldCenter.y);
    text.rotation = rotation;
    text.scale.set(frame.transform.mapScale);
    text.alpha = 1;
  }

  pools.coordinateTexts.releaseUnused(visibleKeys);
  return visibleKeys.size;
}

export function drawPixiTerrainLayer(
  terrainGraphics: Graphics,
  terrainSpriteParent: Container,
  frame: PixiSceneRenderFrame,
  assets: PixiAssetCatalog,
  pools: PixiObjectPools,
  showCoordinates: boolean,
): PixiTerrainLayerStats {
  void showCoordinates;
  terrainGraphics.clear();

  const visibleSpriteKeys = new Set<string>();
  const terrainOverriddenHexes = new Set<string>();
  const fallbackCells: PixiSceneCellRecord[] = [];

  for (const cell of frame.visibleTerrainCells) {
    const texture = textureForCell(cell, assets);
    const isTerrainOverride = Boolean(
      cell.feature &&
      !cell.feature.hidden &&
      canFeatureOverrideTerrain(cell.feature.kind) &&
      assets.featureTerrainOverrideTextures.get(cell.feature.kind) === texture,
    );

    if (!texture) {
      if (cell.cell.type !== "empty") {
        fallbackCells.push(cell);
      }
      continue;
    }

    if (cell.cell.type === "empty" && !isTerrainOverride) {
      continue;
    }

    visibleSpriteKeys.add(cell.key);
    const sprite = pools.terrainSprites.acquire(cell.key, terrainSpriteParent);
    sprite.texture = texture;
    sprite.anchor.set(0.5);
    sprite.position.set(cell.worldCenter.x, cell.worldCenter.y);
    const fitted = fitTextureSizePreservingAspect(
      texture,
      cell.boundsWidth * 0.92,
      cell.boundsHeight * 0.92,
    );
    sprite.width = fitted.width;
    sprite.height = fitted.height;
    sprite.rotation = 0;
    sprite.alpha = 1;

    if (isTerrainOverride) {
      terrainOverriddenHexes.add(cell.key);
    }
  }

  drawFallbackTerrain(terrainGraphics, fallbackCells);
  pools.terrainSprites.releaseUnused(visibleSpriteKeys);
  const labels = drawCoordinateLabels(
    frame,
    pools,
    terrainSpriteParent,
    showCoordinates,
  );

  return {
    labels,
    terrainOverriddenHexes,
    tiles: frame.visibleTerrainCells.length,
  };
}
