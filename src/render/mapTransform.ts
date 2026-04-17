import {
  axialToScreenPixel,
  getHexCorners,
  getLevelScale,
  hexKey,
  type Axial,
  type Pixel
} from "@/core/geometry/hex";
import type { Viewport } from "./renderTypes";

export type MapRenderTransform = {
  axialToScreen: (axial: Axial) => Pixel;
  hexCorners: (axial: Axial) => Pixel[];
  level: number;
  mapScale: number;
  scaleMapLength: (length: number) => number;
  viewport: Viewport;
  zoom: number;
};

export function createMapRenderTransform(
  center: Axial,
  level: number,
  zoom: number,
  viewport: Viewport
): MapRenderTransform {
  const canvasViewport = { x: viewport.width, y: viewport.height };
  const mapScale = getLevelScale(level) * zoom;
  const axialToScreenCache = new Map<string, Pixel>();
  const hexCornersCache = new Map<string, Pixel[]>();

  return {
    axialToScreen: (axial) => {
      const key = hexKey(axial);
      const cached = axialToScreenCache.get(key);

      if (cached) {
        return cached;
      }

      const pixel = axialToScreenPixel(axial, center, level, zoom, canvasViewport);
      axialToScreenCache.set(key, pixel);
      return pixel;
    },
    hexCorners: (axial) => {
      const key = hexKey(axial);
      const cached = hexCornersCache.get(key);

      if (cached) {
        return cached;
      }

      const corners = getHexCorners(axial, center, level, zoom, canvasViewport);
      hexCornersCache.set(key, corners);
      return corners;
    },
    level,
    mapScale,
    // Map content sizes are authored in level-local map units and then scaled
    // once by the same level+zoom factor as terrain geometry. Avoid raw
    // screen-space widths here unless drawing actual UI.
    scaleMapLength: (length) => length * mapScale,
    viewport,
    zoom
  };
}
