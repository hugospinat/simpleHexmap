import { Graphics } from "pixi.js";
import { pathPolygon, scaleWorldLength } from "./pixiLayers";
import { drawPixiHoveredRiverEdge } from "./pixiRiverLayer";
import type { MapInteractionOverlay, PixiSceneRenderFrame } from "./pixiTypes";

export function drawPixiOverlayLayer(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  overlay: MapInteractionOverlay
): void {
  graphics.clear();

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
