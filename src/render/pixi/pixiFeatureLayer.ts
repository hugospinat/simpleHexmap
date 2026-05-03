import { Text, TextStyle, type Container, type Texture } from "pixi.js";
import {
  isFeatureVisible,
  type FeatureVisibilityMode,
} from "@/core/map/features";
import { featureGlyphs } from "@/render/featureVisualPrimitives";
import { scaleWorldLength } from "./pixiLayers";
import type {
  PixiAssetCatalog,
  PixiObjectPools,
  PixiSceneRenderFrame,
} from "./pixiTypes";

type PixiFeatureStats = {
  features: number;
  hexes: number;
};

const featureGlyphStyle = new TextStyle({
  align: "center",
  fill: "#111111",
  fontFamily: "Georgia, Times New Roman, serif",
  fontSize: 20,
  stroke: {
    color: "#ffffff",
    width: 2.2,
  },
});

function updateText(text: Text, value: string, fontSize: number): void {
  if (text.text !== value) {
    text.text = value;
  }

  if (text.style !== featureGlyphStyle) {
    text.style = featureGlyphStyle;
  }

  text.anchor.set(0.5);
}

function getFeatureTexture(
  kind: string,
  assets: PixiAssetCatalog,
): Texture | null {
  return assets.featureTextures.get(kind) ?? null;
}

export function drawPixiFeatureLayer(
  frame: PixiSceneRenderFrame,
  assets: PixiAssetCatalog,
  pools: PixiObjectPools,
  parent: Container,
  excludedHexes: ReadonlySet<string>,
  visibilityMode: FeatureVisibilityMode,
  emphasizeHidden: boolean,
): PixiFeatureStats {
  const visibleSpriteKeys = new Set<string>();
  const visibleTextKeys = new Set<string>();
  const featureScale = scaleWorldLength(frame, 1);
  let visibleHexes = 0;
  let visibleFeatures = 0;

  for (const cell of frame.visibleTerrainCells) {
    const feature = cell.feature;

    if (
      !feature ||
      excludedHexes.has(cell.key) ||
      !isFeatureVisible(feature, visibilityMode)
    ) {
      continue;
    }

    visibleHexes += 1;
    visibleFeatures += 1;
    const alpha =
      visibilityMode === "gm" && emphasizeHidden && feature.hidden ? 0.5 : 1;

    const texture = getFeatureTexture(feature.kind, assets);

    if (texture) {
      const spriteKey = `feature:${cell.key}`;
      visibleSpriteKeys.add(spriteKey);
      const sprite = pools.featureSprites.acquire(spriteKey, parent);
      sprite.texture = texture;
      sprite.anchor.set(0.5);
      sprite.position.set(cell.worldCenter.x, cell.worldCenter.y);
      sprite.width = scaleWorldLength(frame, 18);
      sprite.height = scaleWorldLength(frame, 18);
      sprite.alpha = alpha;
      sprite.rotation = 0;
    } else {
      const glyphKey = `feature-glyph:${cell.key}`;
      visibleTextKeys.add(glyphKey);
      const glyph = pools.labelTexts.acquire(glyphKey, parent);
      updateText(glyph, featureGlyphs[feature.kind], 20);
      glyph.position.set(cell.worldCenter.x, cell.worldCenter.y);
      glyph.scale.set(featureScale);
      glyph.alpha = alpha;
    }
  }

  pools.featureSprites.releaseUnused(visibleSpriteKeys);
  pools.labelTexts.releaseUnused(visibleTextKeys);

  return {
    features: visibleFeatures,
    hexes: visibleHexes,
  };
}
