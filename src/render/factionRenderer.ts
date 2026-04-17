import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";
import { addPolygonPath } from "./canvasPrimitives";

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
  const cellsByColor = new Map<string, RenderCell[]>();

  for (const cell of visibleCells) {
    if (!cell.factionColor) {
      continue;
    }

    const cells = cellsByColor.get(cell.factionColor);

    if (cells) {
      cells.push(cell);
    } else {
      cellsByColor.set(cell.factionColor, [cell]);
    }
  }

  context.save();
  context.globalAlpha = opacity;

  for (const [color, cells] of cellsByColor.entries()) {
    context.beginPath();

    for (const { corners } of cells) {
      addPolygonPath(context, corners);
    }

    context.fillStyle = color;
    context.fill();
    count += cells.length;
  }

  context.restore();
  return count;
}
