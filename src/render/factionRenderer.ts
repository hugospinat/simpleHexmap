import type { MapRenderTransform } from "./mapTransform";
import type { VisibleCell } from "./renderTypes";
import { fillPolygon } from "./canvasPrimitives";

const defaultFactionOverlayOpacity = 0.3;

export function drawFactionOverlays(
  context: CanvasRenderingContext2D,
  visibleCells: VisibleCell[],
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

  for (const { axial, key } of visibleCells) {
    const color = factionColorByHex.get(key);

    if (!color) {
      continue;
    }

    fillPolygon(context, transform.hexCorners(axial), color);
    count += 1;
  }

  context.restore();
  return count;
}
