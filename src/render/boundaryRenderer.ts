import { editorConfig } from "@/config/editorConfig";
import { getSegmentKey } from "./canvasPrimitives";
import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";

type Segment = [{ x: number; y: number }, { x: number; y: number }];

function scaleDashForTransform(dash: readonly number[], transform: MapRenderTransform): number[] {
  if (dash.length === 0) {
    return [];
  }

  return dash.map((segment) => transform.scaleMapLength(segment));
}

function collectBoundarySegments(visibleCells: RenderCell[]): Segment[] {
  const segments: Segment[] = [];
  const seenSegments = new Set<string>();

  for (const { corners } of visibleCells) {
    for (let edgeIndex = 0; edgeIndex < 6; edgeIndex += 1) {
      const start = corners[edgeIndex];
      const end = corners[(edgeIndex + 1) % corners.length];
      const segmentKey = getSegmentKey(start, end);

      if (seenSegments.has(segmentKey)) {
        continue;
      }

      seenSegments.add(segmentKey);
      segments.push([start, end]);
    }
  }

  return segments;
}

function drawSegmentLayer(
  context: CanvasRenderingContext2D,
  segments: readonly Segment[],
  transform: MapRenderTransform,
  dash: readonly number[]
) {
  if (segments.length === 0) {
    return;
  }

  context.setLineDash(scaleDashForTransform(dash, transform));
  context.beginPath();

  for (const [start, end] of segments) {
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
  }

  context.stroke();
}

function drawBoundarySegments(
  context: CanvasRenderingContext2D,
  segments: readonly Segment[],
  transform: MapRenderTransform
): void {
  context.save();
  context.globalAlpha = editorConfig.boundaryLineAlpha;
  context.strokeStyle = editorConfig.boundaryLineColor;
  context.lineWidth = transform.scaleMapLength(editorConfig.boundaryLineWidth);
  context.lineCap = "round";
  context.lineJoin = "round";
  drawSegmentLayer(context, segments, transform, editorConfig.boundaryLineDashCurrent);
  context.restore();
}

export function drawBoundaryOverlays(
  context: CanvasRenderingContext2D,
  visibleCells: RenderCell[],
  transform: MapRenderTransform
): number {
  if (visibleCells.length === 0) {
    return 0;
  }

  const segments = collectBoundarySegments(visibleCells);
  drawBoundarySegments(context, segments, transform);
  return segments.length;
}
