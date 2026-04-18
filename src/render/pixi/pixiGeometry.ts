import {
  HEX_BASE_SIZE,
  axialToWorldPixel,
  getLevelRotation,
  getLevelScale,
  type Axial,
  type Pixel
} from "@/core/geometry/hex";
import type { MapLevel } from "@/core/map/mapRules";
import type { Viewport } from "@/render/renderTypes";

export type WorldBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

export type WorldHexGeometry = {
  bounds: WorldBounds;
  boundsHeight: number;
  boundsWidth: number;
  worldCenter: Pixel;
  worldCorners: Pixel[];
};

export function getWorldHexGeometry(axial: Axial, level: MapLevel): WorldHexGeometry {
  const worldCenter = axialToWorldPixel(axial, level);
  const radius = HEX_BASE_SIZE * getLevelScale(level);
  const rotation = getLevelRotation(level);
  const worldCorners: Pixel[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < 6; index += 1) {
    const angle = rotation + Math.PI / 6 + (Math.PI / 3) * index;
    const point = {
      x: worldCenter.x + radius * Math.cos(angle),
      y: worldCenter.y + radius * Math.sin(angle)
    };

    worldCorners.push(point);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    bounds: { maxX, maxY, minX, minY },
    boundsHeight: maxY - minY,
    boundsWidth: maxX - minX,
    worldCenter,
    worldCorners
  };
}

export function getCameraWorldBounds(
  center: Axial,
  level: MapLevel,
  visualZoom: number,
  viewport: Viewport
): WorldBounds {
  const zoom = Math.max(0.0001, visualZoom);
  const worldCenter = axialToWorldPixel(center, level);
  const halfWidth = viewport.width / 2 / zoom;
  const halfHeight = viewport.height / 2 / zoom;

  return {
    maxX: worldCenter.x + halfWidth,
    maxY: worldCenter.y + halfHeight,
    minX: worldCenter.x - halfWidth,
    minY: worldCenter.y - halfHeight
  };
}

export function expandWorldBounds(bounds: WorldBounds, marginRatio = 0.75): WorldBounds {
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const marginX = width * marginRatio;
  const marginY = height * marginRatio;

  return {
    maxX: bounds.maxX + marginX,
    maxY: bounds.maxY + marginY,
    minX: bounds.minX - marginX,
    minY: bounds.minY - marginY
  };
}

export function boundsContains(outer: WorldBounds, inner: WorldBounds): boolean {
  return inner.minX >= outer.minX
    && inner.maxX <= outer.maxX
    && inner.minY >= outer.minY
    && inner.maxY <= outer.maxY;
}

export function boundsIntersects(left: WorldBounds, right: WorldBounds): boolean {
  return left.minX <= right.maxX
    && left.maxX >= right.minX
    && left.minY <= right.maxY
    && left.maxY >= right.minY;
}
