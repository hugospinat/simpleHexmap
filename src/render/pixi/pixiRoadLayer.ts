import type { Container, Texture } from "pixi.js";
import type { Pixel } from "@/core/geometry/hex";
import type { RoadEdgeIndex } from "@/core/map/roads";
import { getSegmentKey } from "@/render/canvasPrimitives";
import { scaleWorldLength } from "./pixiLayers";
import type { PixiObjectPools, PixiSceneCellRecord, PixiSceneRenderFrame } from "./pixiTypes";

type RoadEdgeStamp = {
  angle: number;
  center: Pixel;
  key: string;
};

function getMidpoint(a: Pixel, b: Pixel): Pixel {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function collectRoadEdgeStamps(renderCells: PixiSceneCellRecord[]): RoadEdgeStamp[] {
  const stamps: RoadEdgeStamp[] = [];
  const seenEdges = new Set<string>();

  for (const { roadEdges, worldCenter: hexCenter, worldCorners } of renderCells) {
    if (roadEdges.size === 0) {
      continue;
    }

    for (const edge of roadEdges as Set<RoadEdgeIndex>) {
      const start = worldCorners[edge];
      const end = worldCorners[(edge + 1) % worldCorners.length];
      const segmentKey = getSegmentKey(start, end);

      if (seenEdges.has(segmentKey)) {
        continue;
      }

      seenEdges.add(segmentKey);
      const center = getMidpoint(start, end);

      stamps.push({
        angle: Math.atan2(center.y - hexCenter.y, center.x - hexCenter.x),
        center,
        key: segmentKey
      });
    }
  }

  return stamps;
}

export function drawPixiRoadLayer(
  frame: PixiSceneRenderFrame,
  pools: PixiObjectPools,
  roadTexture: Texture | null,
  parent: Container
): number {
  const stamps = collectRoadEdgeStamps(frame.visibleTerrainCells);
  const visibleKeys = new Set<string>();

  if (!roadTexture) {
    pools.roadSprites.releaseUnused(visibleKeys);
    return stamps.length;
  }

  const width = scaleWorldLength(frame, 22);
  const height = width * ((roadTexture.height || 1) / (roadTexture.width || 1));

  for (const stamp of stamps) {
    visibleKeys.add(stamp.key);
    const sprite = pools.roadSprites.acquire(stamp.key, parent);
    sprite.texture = roadTexture;
    sprite.anchor.set(0.5);
    sprite.position.set(stamp.center.x, stamp.center.y);
    sprite.rotation = stamp.angle;
    sprite.width = width;
    sprite.height = height;
    sprite.alpha = 1;
  }

  pools.roadSprites.releaseUnused(visibleKeys);
  return stamps.length;
}
