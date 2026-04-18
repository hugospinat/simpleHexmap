import { Graphics } from "pixi.js";
import type { Pixel } from "@/core/geometry/hex";
import type { RiverEdgeIndex, RiverEdgeRef } from "@/core/map/world";
import { getSegmentKey } from "@/render/canvasPrimitives";
import { getWorldHexCorners, scaleWorldLength, type Segment } from "./pixiLayers";
import type { PixiSceneCellRecord, PixiSceneRenderFrame } from "./pixiTypes";

const riverStrokeWidth = 2.3;
const riverHaloWidth = 4.4;
const hoveredRiverStrokeWidth = 2.6;
const hoveredRiverHaloWidth = 5.2;

function collectRiverSegments(visibleCells: PixiSceneCellRecord[]): Segment[] {
  const segments = new Map<string, [Pixel, Pixel]>();

  for (const { riverEdges, worldCorners } of visibleCells) {
    if (riverEdges.size === 0) {
      continue;
    }

    for (const edge of riverEdges as Set<RiverEdgeIndex>) {
      const start = worldCorners[edge];
      const end = worldCorners[(edge + 1) % worldCorners.length];
      const segmentKey = getSegmentKey(start, end);

      if (!segments.has(segmentKey)) {
        segments.set(segmentKey, [start, end]);
      }
    }
  }

  return Array.from(segments.values());
}

function pathSegments(graphics: Graphics, segments: Segment[]): void {
  for (const [start, end] of segments) {
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
  }
}

function pathRiverEdge(graphics: Graphics, hoverEdge: RiverEdgeRef, frame: PixiSceneRenderFrame): void {
  const corners = getWorldHexCorners(hoverEdge.axial, frame.transform.level);
  const start = corners[hoverEdge.edge];
  const end = corners[(hoverEdge.edge + 1) % corners.length];
  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);
}

export function drawPixiRiverLayer(graphics: Graphics, frame: PixiSceneRenderFrame): number {
  graphics.clear();
  const segments = collectRiverSegments(frame.visibleTerrainCells);

  if (segments.length === 0) {
    return 0;
  }

  pathSegments(graphics, segments);
  graphics.stroke({
    color: "#cfe8ff",
    width: scaleWorldLength(frame, riverHaloWidth)
  });
  pathSegments(graphics, segments);
  graphics.stroke({
    color: "#1f6fb5",
    width: scaleWorldLength(frame, riverStrokeWidth)
  });

  return segments.length;
}

export function drawPixiHoveredRiverEdge(graphics: Graphics, hoverEdge: RiverEdgeRef, frame: PixiSceneRenderFrame): void {
  pathRiverEdge(graphics, hoverEdge, frame);
  graphics.stroke({
    alpha: 0.9,
    color: "#ffffff",
    width: scaleWorldLength(frame, hoveredRiverHaloWidth)
  });
  pathRiverEdge(graphics, hoverEdge, frame);
  graphics.stroke({
    alpha: 0.95,
    color: "#267fcc",
    width: scaleWorldLength(frame, hoveredRiverStrokeWidth)
  });
}
