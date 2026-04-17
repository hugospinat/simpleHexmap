import type { Pixel } from "@/core/geometry/hex";
import type { RiverEdgeIndex, RiverEdgeRef } from "@/core/map/world";
import { getSegmentKey } from "./canvasPrimitives";
import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";

const riverStrokeWidth = 2.3;
const riverHaloWidth = 4.4;
const hoveredRiverStrokeWidth = 2.6;
const hoveredRiverHaloWidth = 5.2;

export function drawHoveredRiverEdge(
  context: CanvasRenderingContext2D,
  hoverEdge: RiverEdgeRef,
  transform: MapRenderTransform
) {
  const corners = transform.hexCorners(hoverEdge.axial);
  const start = corners[hoverEdge.edge];
  const end = corners[(hoverEdge.edge + 1) % corners.length];

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  context.strokeStyle = "rgba(255, 255, 255, 0.9)";
  context.lineWidth = transform.scaleMapLength(hoveredRiverHaloWidth);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.strokeStyle = "rgba(38, 127, 204, 0.95)";
  context.lineWidth = transform.scaleMapLength(hoveredRiverStrokeWidth);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();

  context.restore();
}

export function drawRiverOverlays(
  context: CanvasRenderingContext2D,
  visibleCells: RenderCell[],
  transform: MapRenderTransform
): number {
  if (visibleCells.length === 0) {
    return 0;
  }

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";

  const segments = new Map<string, [Pixel, Pixel]>();

  for (const { corners, riverEdges } of visibleCells) {
    if (riverEdges.size === 0) {
      continue;
    }

    for (const edge of riverEdges as Set<RiverEdgeIndex>) {
      const start = corners[edge];
      const end = corners[(edge + 1) % corners.length];
      const segmentKey = getSegmentKey(start, end);

      if (!segments.has(segmentKey)) {
        segments.set(segmentKey, [start, end]);
      }
    }
  }

  if (segments.size === 0) {
    context.restore();
    return 0;
  }

  context.strokeStyle = "#cfe8ff";
  context.lineWidth = transform.scaleMapLength(riverHaloWidth);
  for (const [start, end] of segments.values()) {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  context.strokeStyle = "#1f6fb5";
  context.lineWidth = transform.scaleMapLength(riverStrokeWidth);
  for (const [start, end] of segments.values()) {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }

  context.restore();
  return segments.size;
}
