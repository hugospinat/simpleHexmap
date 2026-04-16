import {
  drawFeatureTerrainOverrideTile,
  featureCanOverrideTerrainTile
} from "@/domain/rendering/featureVisuals";
import { getLevelRotation, hexKey, type Axial } from "@/domain/geometry/hex";
import type { Feature } from "@/domain/world/features";
import { tileColors } from "@/domain/world/world";
import { drawTileContent } from "@/domain/rendering/tileVisuals";
import { fillPolygon, strokePolygon } from "./canvasPrimitives";
import type { MapRenderTransform } from "./mapTransform";
import type { VisibleCell } from "./renderTypes";

export function drawTerrainBaseLayer(
  context: CanvasRenderingContext2D,
  visibleCells: VisibleCell[],
  transform: MapRenderTransform
): number {
  for (const { axial, cell } of visibleCells) {
    fillPolygon(context, transform.hexCorners(axial), tileColors[cell.type]);
  }

  return visibleCells.length;
}

export function drawTerrainDetailLayer(
  context: CanvasRenderingContext2D,
  visibleCells: VisibleCell[],
  featuresByHex: Map<string, Feature>,
  highlightedHex: Axial | null,
  transform: MapRenderTransform,
  showCoordinates: boolean
): { labels: number; tiles: number; terrainOverriddenHexes: Set<string> } {
  const highlightedKey = highlightedHex ? hexKey(highlightedHex) : null;
  let labels = 0;
  const terrainOverriddenHexes = new Set<string>();

  for (const { axial, cell, key } of visibleCells) {
    const corners = transform.hexCorners(axial);
    const label = transform.axialToScreen(axial);
    const radius = transform.scaleMapLength(32);
    const feature = featuresByHex.get(key);
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
