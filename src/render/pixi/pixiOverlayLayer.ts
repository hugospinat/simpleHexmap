import { Graphics } from "pixi.js";
import type { FeatureVisibilityMode } from "@/core/map/features";
import { pathPolygon, scaleWorldLength } from "./pixiLayers";
import { drawPixiHoveredRiverEdge } from "./pixiRiverLayer";
import type { MapInteractionOverlay, PixiSceneRenderFrame } from "./pixiTypes";

const fogOverlayOpacity = 0.4;

export function drawPixiOverlayLayer(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  overlay: MapInteractionOverlay,
  fogEditingActive: boolean,
  featureVisibilityMode: FeatureVisibilityMode
): void {
  graphics.clear();

  if (fogEditingActive && featureVisibilityMode === "gm") {
    for (const cell of frame.hiddenCells) {
      pathPolygon(graphics, cell.worldCorners);
    }

    graphics.fill({
      alpha: fogOverlayOpacity,
      color: 0x000000
    });
  }

  if (overlay.hoverRiverEdge) {
    drawPixiHoveredRiverEdge(graphics, overlay.hoverRiverEdge, frame);
  }

  if (overlay.highlightedHex) {
    const highlightedCell = frame.visibleTerrainCells.find((cell) => cell.key === overlay.highlightedHex);

    if (highlightedCell) {
      pathPolygon(graphics, highlightedCell.worldCorners);
      graphics.stroke({
        color: 0x000000,
        width: scaleWorldLength(frame, 2)
      });
    }
  }
}
