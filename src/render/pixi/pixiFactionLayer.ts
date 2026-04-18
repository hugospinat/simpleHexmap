import { Graphics } from "pixi.js";
import { parseCssColor, pathPolygon } from "./pixiLayers";
import type { PixiSceneCellRecord, PixiSceneRenderFrame } from "./pixiTypes";

const defaultFactionOverlayOpacity = 0.3;

export function drawPixiFactionLayer(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  opacity = defaultFactionOverlayOpacity
): number {
  graphics.clear();

  let count = 0;
  const cellsByColor = new Map<string, PixiSceneCellRecord[]>();

  for (const cell of frame.visibleTerrainCells) {
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

  for (const [color, cells] of cellsByColor.entries()) {
    for (const cell of cells) {
      pathPolygon(graphics, cell.worldCorners);
    }

    graphics.fill({
      alpha: opacity,
      color: parseCssColor(color)
    });
    count += cells.length;
  }

  return count;
}
