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

function drawSegmentLayer(
  context: CanvasRenderingContext2D,
  segments: Map<string, Segment>,
  transform: MapRenderTransform,
  dash: readonly number[]
) {
  if (segments.size === 0) {
    return;
  }

  context.setLineDash(scaleDashForTransform(dash, transform));

  for (const [start, end] of segments.values()) {
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
}

export function drawBoundaryOverlays(
  context: CanvasRenderingContext2D,
  visibleCells: RenderCell[],
  transform: MapRenderTransform
): number {
  if (visibleCells.length === 0) {
    return 0;
  }

  const currentSegments = new Map<string, Segment>();

  for (const { corners } of visibleCells) {
    for (let edgeIndex = 0; edgeIndex < 6; edgeIndex += 1) {
      const start = corners[edgeIndex];
      const end = corners[(edgeIndex + 1) % corners.length];
      const segmentKey = getSegmentKey(start, end);

      if (!currentSegments.has(segmentKey)) {
        currentSegments.set(segmentKey, [start, end]);
      }
    }
  }

  context.save();
  context.globalAlpha = editorConfig.boundaryLineAlpha;
  context.strokeStyle = editorConfig.boundaryLineColor;
  context.lineWidth = transform.scaleMapLength(editorConfig.boundaryLineWidth);
  context.lineCap = "round";
  context.lineJoin = "round";

  drawSegmentLayer(context, currentSegments, transform, editorConfig.boundaryLineDashCurrent);

  context.restore();
  return currentSegments.size;
}
