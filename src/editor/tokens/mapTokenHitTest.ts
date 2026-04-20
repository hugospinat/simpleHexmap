import {
  axialToScreenPixel,
  getAncestorAtLevel,
  getHexCorners,
  hexKey,
  type Axial,
  type HexId,
  type Pixel,
} from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { getLevelMap, type MapState } from "@/core/map/world";
import type { MapTokenRecord } from "@/core/protocol";
import type { Viewport } from "@/render/renderTypes";

type MapTokenHitTestInput = {
  center: Axial;
  level: number;
  point: Pixel;
  tokens: readonly MapTokenRecord[];
  viewport: Viewport;
  visualZoom: number;
  world: MapState;
};

type TokenScreenRecord = {
  userId: string;
  screenCenter: Pixel;
};

function distanceBetween(left: Pixel, right: Pixel): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function getTokenOffset(
  index: number,
  count: number,
  boundsWidth: number,
  boundsHeight: number,
): Pixel {
  if (count <= 1) {
    return { x: 0, y: 0 };
  }

  const ringRadius =
    Math.min(boundsWidth, boundsHeight) * (count === 2 ? 0.11 : 0.13);
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  return {
    x: Math.cos(angle) * ringRadius,
    y: Math.sin(angle) * ringRadius,
  };
}

function getScreenBounds(corners: Pixel[]): { height: number; width: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const corner of corners) {
    minX = Math.min(minX, corner.x);
    maxX = Math.max(maxX, corner.x);
    minY = Math.min(minY, corner.y);
    maxY = Math.max(maxY, corner.y);
  }

  return {
    height: maxY - minY,
    width: maxX - minX,
  };
}

function tokenSourceAxial(token: MapTokenRecord): Axial {
  return { q: token.q, r: token.r };
}

function tokenFrameAxial(token: MapTokenRecord, level: number): Axial {
  const sourceAxial = tokenSourceAxial(token);
  return level === SOURCE_LEVEL
    ? sourceAxial
    : getAncestorAtLevel(sourceAxial, SOURCE_LEVEL, level);
}

export function findMapTokenUserAtPoint({
  center,
  level,
  point,
  tokens,
  viewport,
  visualZoom,
  world,
}: MapTokenHitTestInput): string | null {
  const sourceCells = getLevelMap(world, SOURCE_LEVEL);
  const levelCells = getLevelMap(world, level);
  const tokensByHex = new Map<HexId, MapTokenRecord[]>();

  for (const token of tokens) {
    const sourceAxial = tokenSourceAxial(token);
    const sourceCell = sourceCells.get(hexKey(sourceAxial));

    if (!sourceCell || sourceCell.hidden) {
      continue;
    }

    const frameAxial = tokenFrameAxial(token, level);
    const frameKey = hexKey(frameAxial);

    if (!levelCells.has(frameKey)) {
      continue;
    }

    const group = tokensByHex.get(frameKey) ?? [];
    group.push(token);
    tokensByHex.set(frameKey, group);
  }

  let nearest: { distance: number; userId: string } | null = null;
  const viewportPixel = { x: viewport.width, y: viewport.height };

  for (const group of tokensByHex.values()) {
    const frameAxial = tokenFrameAxial(group[0], level);
    const corners = getHexCorners(
      frameAxial,
      center,
      level,
      visualZoom,
      viewportPixel,
    );
    const bounds = getScreenBounds(corners);
    const screenCenter = axialToScreenPixel(
      frameAxial,
      center,
      level,
      visualZoom,
      viewportPixel,
    );
    const sorted = [...group].sort((left, right) =>
      left.userId.localeCompare(right.userId),
    );
    const radius = Math.max(
      2.5,
      Math.min(bounds.width, bounds.height) *
        (sorted.length > 4 ? 0.065 : 0.08),
    );

    for (const [index, token] of sorted.entries()) {
      const offset = getTokenOffset(
        index,
        sorted.length,
        bounds.width,
        bounds.height,
      );
      const tokenRecord: TokenScreenRecord = {
        userId: token.userId,
        screenCenter: {
          x: screenCenter.x + offset.x,
          y: screenCenter.y + offset.y,
        },
      };
      const distance = distanceBetween(point, tokenRecord.screenCenter);

      if (distance <= radius + 3 && (!nearest || distance < nearest.distance)) {
        nearest = {
          distance,
          userId: tokenRecord.userId,
        };
      }
    }
  }

  return nearest?.userId ?? null;
}
