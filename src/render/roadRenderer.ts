import { getRoadPathAsset } from "@/assets/terrainAssets";
import type { Pixel } from "@/core/geometry/hex";
import type { RoadEdgeIndex } from "@/core/map/roads";
import { getLoadedImage } from "./assetImages";
import { getSegmentKey } from "./canvasPrimitives";
import type { MapRenderTransform } from "./mapTransform";
import type { RenderCell } from "./renderTypes";

type RoadEdgeStamp = {
  angle: number;
  center: Pixel;
};

function getMidpoint(a: Pixel, b: Pixel): Pixel {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function getEdgeStamps(
  renderCells: RenderCell[]
): RoadEdgeStamp[] {
  const stamps: RoadEdgeStamp[] = [];
  const seenEdges = new Set<string>();

  for (const { center: hexCenter, corners, roadEdges: edgeSet } of renderCells) {
    if (edgeSet.size === 0) {
      continue;
    }

    for (const edge of edgeSet as Set<RoadEdgeIndex>) {
      const start = corners[edge];
      const end = corners[(edge + 1) % corners.length];
      const segmentKey = getSegmentKey(start, end);

      if (seenEdges.has(segmentKey)) {
        continue;
      }

      seenEdges.add(segmentKey);
      const center = getMidpoint(start, end);

      stamps.push({
        center,
        // The source image is horizontal. Rotating toward the adjacent hex
        // makes each marker cross the shared edge instead of running along it.
        angle: Math.atan2(center.y - hexCenter.y, center.x - hexCenter.x)
      });
    }
  }

  return stamps;
}

function drawRoadEdgeStamp(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  stamp: RoadEdgeStamp,
  transform: MapRenderTransform
) {
  const width = transform.scaleMapLength(22);
  const height = width * (image.naturalHeight / image.naturalWidth);

  context.save();
  context.translate(stamp.center.x, stamp.center.y);
  context.rotate(stamp.angle);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
}

export function drawRoadOverlays(
  context: CanvasRenderingContext2D,
  renderCells: RenderCell[],
  transform: MapRenderTransform,
): number {
  if (renderCells.length === 0) {
    return 0;
  }

  const stamps = getEdgeStamps(renderCells);

  if (stamps.length === 0) {
    return 0;
  }

  const image = getLoadedImage(getRoadPathAsset().src);

  if (!image) {
    return stamps.length;
  }

  for (const stamp of stamps) {
    drawRoadEdgeStamp(context, image, stamp, transform);
  }

  return stamps.length;
}
