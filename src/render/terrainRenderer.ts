import {
  drawFeatureTerrainOverrideTile,
  featureCanOverrideTerrainTile
} from "@/render/featureLayer";
import { getLevelRotation, hexKey, type Axial } from "@/core/geometry/hex";
import { tileColors } from "@/core/map/world";
import { drawTileContent } from "@/render/tileVisuals";
import { addPolygonPath, fillPolygon, strokePolygon } from "./canvasPrimitives";
import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";

type TerrainLayerStats = {
  labels: number;
  terrainOverriddenHexes: Set<string>;
  tiles: number;
};

function drawTerrainLayerContent(
  context: CanvasRenderingContext2D,
  cells: RenderCell[],
  transform: MapRenderTransform,
  showCoordinates: boolean
): TerrainLayerStats {
  const terrainOverriddenHexes = new Set<string>();
  let labels = 0;

  for (const terrainType of Object.keys(tileColors) as Array<keyof typeof tileColors>) {
    let hasPath = false;
    context.beginPath();

    for (const { cell, corners } of cells) {
      if (cell.type !== terrainType) {
        continue;
      }

      addPolygonPath(context, corners);
      hasPath = true;
    }

    if (hasPath) {
      context.fillStyle = tileColors[terrainType];
      context.fill();
    }
  }

  for (const { cell, center, corners, feature, featureTerrainOverrideImage, key, terrainImage } of cells) {
    const radius = transform.scaleMapLength(32);
    const canOverride = feature ? featureCanOverrideTerrainTile(feature) : false;

    if (
      canOverride &&
      feature &&
      drawFeatureTerrainOverrideTile(context, feature.kind, corners, featureTerrainOverrideImage)
    ) {
      terrainOverriddenHexes.add(key);
    } else {
      drawTileContent(context, cell.type, corners, center, radius, terrainImage);
    }

    if (showCoordinates && radius > 14) {
      labels += 1;
      context.save();
      context.translate(center.x, center.y);
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
    tiles: cells.length
  };
}

export function drawTerrainLayer(
  context: CanvasRenderingContext2D,
  visibleCells: RenderCell[],
  highlightedHex: Axial | null,
  transform: MapRenderTransform,
  showCoordinates: boolean
): TerrainLayerStats {
  const stats = drawTerrainLayerContent(context, visibleCells, transform, showCoordinates);
  const highlightedKey = highlightedHex ? hexKey(highlightedHex) : null;

  if (highlightedKey) {
    const highlightedCell = visibleCells.find((cell) => cell.key === highlightedKey);

    if (highlightedCell) {
      strokePolygon(context, highlightedCell.corners, "#000000", transform.scaleMapLength(2));
    }
  }

  return {
    labels: stats.labels,
    terrainOverriddenHexes: stats.terrainOverriddenHexes,
    tiles: visibleCells.length
  };
}

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
  context.beginPath();

  for (const { corners } of hiddenCells) {
    addPolygonPath(context, corners);
  }

  context.fillStyle = "#000000";
  context.fill();
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
      drawTileContent(context, cell.type, corners, label, radius, null);
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
