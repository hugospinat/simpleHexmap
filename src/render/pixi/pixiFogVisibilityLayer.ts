import { Graphics } from "pixi.js";
import type { FeatureVisibilityMode } from "@/core/map/features";
import { pathPolygon } from "./pixiLayers";
import type { PixiSceneRenderFrame } from "./pixiTypes";

const fogVisibilityOpacity = 0.4;

export function shouldDrawPixiFogVisibilityLayer(
  featureVisibilityMode: FeatureVisibilityMode,
  fogEditingActive: boolean
): boolean {
  return featureVisibilityMode === "gm" && fogEditingActive;
}

export function drawPixiFogVisibilityLayer(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  featureVisibilityMode: FeatureVisibilityMode,
  fogEditingActive: boolean
): number {
  graphics.clear();

  if (!shouldDrawPixiFogVisibilityLayer(featureVisibilityMode, fogEditingActive)) {
    return 0;
  }

  for (const cell of frame.hiddenCells) {
    pathPolygon(graphics, cell.worldCorners);
  }

  if (frame.hiddenCells.length > 0) {
    graphics.fill({
      alpha: fogVisibilityOpacity,
      color: 0x000000
    });
  }

  return frame.hiddenCells.length;
}
