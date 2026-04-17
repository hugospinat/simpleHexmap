import {
  drawFeatureTerrainOverrideTile,
  featureCanOverrideTerrainTile
} from "@/render/featureLayer";
import { getLevelRotation, hexKey, type Axial } from "@/core/geometry/hex";
import { tileColors } from "@/core/map/world";
import { drawTileContent } from "@/render/tileVisuals";
import { fillPolygon, strokePolygon } from "./canvasPrimitives";
import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";

export function drawTerrainBaseLayer(
  context: CanvasRenderingContext2D,
  visibleCells: RenderCell[],
  transform: MapRenderTransform
): number {
  for (const { cell, corners } of visibleCells) {
    fillPolygon(context, corners, tileColors[cell.type]);
  }

  return visibleCells.length;
}

export function drawHiddenCellOverlay(
  context: CanvasRenderingContext2D,
  hiddenCells: RenderCell[],
  transform: MapRenderTransform,
  opacity = 0.4
): void {
  if (hiddenCells.length === 0) {
    return;
  }

  context.save();
  context.globalAlpha = opacity;

  for (const { corners } of hiddenCells) {
    fillPolygon(context, corners, "#000000");
  }

  context.restore();
}

export function drawTerrainDetailLayer(
  context: CanvasRenderingContext2D,
  visibleCells: RenderCell[],
  highlightedHex: Axial | null,
  transform: MapRenderTransform,
  showCoordinates: boolean
): { labels: number; tiles: number; terrainOverriddenHexes: Set<string> } {
  const highlightedKey = highlightedHex ? hexKey(highlightedHex) : null;
  let labels = 0;
  const terrainOverriddenHexes = new Set<string>();

  for (const { cell, center, corners, feature, key } of visibleCells) {
    const label = center;
    const radius = transform.scaleMapLength(32);
    const canOverride = feature ? featureCanOverrideTerrainTile(feature) : false;

    if (canOverride && feature && drawFeatureTerrainOverrideTile(context, feature.kind, corners)) {
      terrainOverriddenHexes.add(key);
    } else {
      drawTileContent(context, cell.type, corners, label, radius);
    }

    if (highlightedKey === key) {
      strokePolygon(context, corners, "#000000", transform.scaleMapLength(2));
    }

    if (showCoordinates && radius > 14) {
      labels += 1;
      context.save();
      context.translate(label.x, label.y);
      context.rotate(getLevelRotation(transform.level));
      context.scale(transform.mapScale, transform.mapScale);
      context.fillStyle = "#777777";
      context.font = "10px Georgia, 'Times New Roman', serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(key, 0, 0);
      context.restore();
    }
  }

  return {
    labels,
    terrainOverriddenHexes,
    tiles: visibleCells.length
  };
}
