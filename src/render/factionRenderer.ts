import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";
import { fillPolygon } from "./canvasPrimitives";

const defaultFactionOverlayOpacity = 0.3;

export function drawFactionOverlays(
  context: CanvasRenderingContext2D,
  visibleCells: RenderCell[],
  factionColorByHex: Map<string, string>,
  transform: MapRenderTransform,
  opacity = defaultFactionOverlayOpacity
): number {
  if (factionColorByHex.size === 0) {
    return 0;
  }

  let count = 0;

  context.save();
  context.globalAlpha = opacity;

  for (const { corners, factionColor } of visibleCells) {
    const color = factionColor;

    if (!color) {
      continue;
    }

    fillPolygon(context, corners, color);
    count += 1;
  }

  context.restore();
  return count;
}
