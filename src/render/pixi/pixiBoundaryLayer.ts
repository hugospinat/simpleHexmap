import { Graphics } from "pixi.js";
import { editorConfig } from "@/config/editorConfig";
import type { Pixel } from "@/core/geometry/hex";
import { getSegmentKey } from "@/render/canvasPrimitives";
import { getWorldVisibleCellHash, scaleWorldLength, type Segment } from "./pixiLayers";
import type { PixiSceneCellRecord, PixiSceneRenderFrame } from "./pixiTypes";

let lastBoundaryKey = "";
let lastBoundaryCount = 0;

function scaleDashForFrame(dash: readonly number[], frame: PixiSceneRenderFrame): number[] {
  return dash.map((segment) => scaleWorldLength(frame, segment));
}

function collectBoundarySegments(visibleCells: PixiSceneCellRecord[]): Segment[] {
  const segments: Segment[] = [];
  const seenSegments = new Set<string>();

  for (const { worldCorners } of visibleCells) {
    for (let edgeIndex = 0; edgeIndex < 6; edgeIndex += 1) {
      const start = worldCorners[edgeIndex];
      const end = worldCorners[(edgeIndex + 1) % worldCorners.length];
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

function drawDashedSegment(graphics: Graphics, start: Pixel, end: Pixel, dash: readonly number[]): void {
  if (dash.length === 0) {
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
    return;
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length <= 0) {
    return;
  }

  const ux = dx / length;
  const uy = dy / length;
  let distance = 0;
  let dashIndex = 0;
  let draw = true;

  while (distance < length) {
    const segmentLength = dash[dashIndex % dash.length] || length;
    const nextDistance = Math.min(length, distance + segmentLength);

    if (draw) {
      graphics.moveTo(start.x + ux * distance, start.y + uy * distance);
      graphics.lineTo(start.x + ux * nextDistance, start.y + uy * nextDistance);
    }

    distance = nextDistance;
    dashIndex += 1;
    draw = !draw;
  }
}

export function drawPixiBoundaryLayer(graphics: Graphics, frame: PixiSceneRenderFrame): number {
  const boundaryKey = [
    frame.transform.level,
    getWorldVisibleCellHash(frame.visibleTerrainCells)
  ].join("|");

  if (boundaryKey === lastBoundaryKey) {
    return lastBoundaryCount;
  }

  lastBoundaryKey = boundaryKey;
  graphics.clear();

  const segments = collectBoundarySegments(frame.visibleTerrainCells);

  if (segments.length === 0) {
    lastBoundaryCount = 0;
    return 0;
  }

  const dash = frame.visibleTerrainCells.length > 800
    ? []
    : scaleDashForFrame(editorConfig.boundaryLineDashCurrent, frame);

  for (const [start, end] of segments) {
    drawDashedSegment(graphics, start, end, dash);
  }

  graphics.stroke({
    alpha: editorConfig.boundaryLineAlpha,
    color: editorConfig.boundaryLineColor,
    width: scaleWorldLength(frame, editorConfig.boundaryLineWidth)
  });

  lastBoundaryCount = segments.length;
  return lastBoundaryCount;
}

export function resetPixiBoundaryLayerInvalidation(): void {
  lastBoundaryKey = "";
  lastBoundaryCount = 0;
}
