import {
  axialToScreenPixel,
  getHexCorners,
  getLevelScale,
  type Axial,
  type Pixel
} from "@/domain/geometry/hex";
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

  return {
    axialToScreen: (axial) => axialToScreenPixel(axial, center, level, zoom, canvasViewport),
    hexCorners: (axial) => getHexCorners(axial, center, level, zoom, canvasViewport),
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
