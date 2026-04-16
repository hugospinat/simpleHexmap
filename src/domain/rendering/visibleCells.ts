import { editorConfig } from "@/config/editorConfig";
import {
  hexKey,
  screenPixelToAxial,
  type Axial
} from "@/domain/geometry/hex";
import type { LevelMap } from "@/domain/world/world";
import type { Viewport, VisibleCell } from "./renderTypes";

function getVisibleAxialRange(
  center: Axial,
  level: number,
  zoom: number,
  viewport: Viewport,
  marginCells: number
): { maxQ: number; maxR: number; minQ: number; minR: number } {
  const marginPixels = 96;
  const samplePoints = [
    { x: -marginPixels, y: -marginPixels },
    { x: viewport.width / 2, y: -marginPixels },
    { x: viewport.width + marginPixels, y: -marginPixels },
    { x: viewport.width + marginPixels, y: viewport.height / 2 },
    { x: viewport.width + marginPixels, y: viewport.height + marginPixels },
    { x: viewport.width / 2, y: viewport.height + marginPixels },
    { x: -marginPixels, y: viewport.height + marginPixels },
    { x: -marginPixels, y: viewport.height / 2 },
    { x: viewport.width / 2, y: viewport.height / 2 }
  ];

  const axials = samplePoints.map((point) =>
    screenPixelToAxial(point, center, level, zoom, {
      x: viewport.width,
      y: viewport.height
    })
  );

  const minQ = Math.floor(Math.min(...axials.map((axial) => axial.q))) - marginCells;
  const maxQ = Math.ceil(Math.max(...axials.map((axial) => axial.q))) + marginCells;
  const minR = Math.floor(Math.min(...axials.map((axial) => axial.r))) - marginCells;
  const maxR = Math.ceil(Math.max(...axials.map((axial) => axial.r))) + marginCells;

  return { maxQ, maxR, minQ, minR };
}

export function collectVisibleCells(
  levelMap: LevelMap,
  center: Axial,
  level: number,
  zoom: number,
  viewport: Viewport
): { cells: VisibleCell[]; keys: Set<string> } {
  const range = getVisibleAxialRange(center, level, zoom, viewport, editorConfig.renderViewportMarginCells);
  const cells: VisibleCell[] = [];
  const keys = new Set<string>();

  for (let q = range.minQ; q <= range.maxQ; q += 1) {
    for (let r = range.minR; r <= range.maxR; r += 1) {
      const axial = { q, r };
      const key = hexKey(axial);
      const cell = levelMap.get(key);

      if (!cell) {
        continue;
      }

      cells.push({ axial, cell, key });
      keys.add(key);
    }
  }

  return { cells, keys };
}
