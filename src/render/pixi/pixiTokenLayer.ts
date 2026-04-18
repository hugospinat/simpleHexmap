import { Graphics } from "pixi.js";
import { getAncestorAtLevel, hexKey, type Axial, type HexId } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import type { MapTokenRecord, PixiSceneCellRecord, PixiSceneRenderFrame } from "./pixiTypes";

function parseHexColor(value: string): number {
  return Number.parseInt(value.slice(1), 16);
}

function getTokenOffset(index: number, count: number, cell: PixiSceneCellRecord): { x: number; y: number } {
  if (count <= 1) {
    return { x: 0, y: 0 };
  }

  const ringRadius = Math.min(cell.boundsWidth, cell.boundsHeight) * (count === 2 ? 0.11 : 0.13);
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
  return {
    x: Math.cos(angle) * ringRadius,
    y: Math.sin(angle) * ringRadius
  };
}

function tokenSourceAxial(token: MapTokenRecord): Axial {
  return { q: token.q, r: token.r };
}

function tokenFrameHexId(token: MapTokenRecord, frame: PixiSceneRenderFrame): HexId {
  const sourceAxial = tokenSourceAxial(token);
  return hexKey(
    frame.transform.level === SOURCE_LEVEL
      ? sourceAxial
      : getAncestorAtLevel(sourceAxial, SOURCE_LEVEL, frame.transform.level)
  );
}

export function drawPixiTokenLayer(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  tokens: readonly MapTokenRecord[]
): number {
  graphics.clear();

  const cellsByKey = new Map(frame.visibleTerrainCells.map((cell) => [cell.key, cell]));
  const tokensByHex = new Map<string, MapTokenRecord[]>();

  for (const token of tokens) {
    const sourceKey = hexKey(tokenSourceAxial(token));
    const sourceCell = frame.world.levels[SOURCE_LEVEL]?.get(sourceKey);

    if (!sourceCell || sourceCell.hidden) {
      continue;
    }

    const key = tokenFrameHexId(token, frame);

    if (!frame.visibleTerrainKeys.has(key)) {
      continue;
    }

    const cell = cellsByKey.get(key);

    if (!cell) {
      continue;
    }

    const group = tokensByHex.get(key) ?? [];
    group.push(token);
    tokensByHex.set(key, group);
  }

  let visibleTokenCount = 0;

  for (const [key, group] of tokensByHex.entries()) {
    const cell = cellsByKey.get(key as HexId);

    if (!cell) {
      continue;
    }

    const sorted = [...group].sort((left, right) => left.profileId.localeCompare(right.profileId));
    const radius = Math.max(2.5, Math.min(cell.boundsWidth, cell.boundsHeight) * (sorted.length > 4 ? 0.065 : 0.08));

    sorted.forEach((token, index) => {
      const offset = getTokenOffset(index, sorted.length, cell);
      const x = cell.worldCenter.x + offset.x;
      const y = cell.worldCenter.y + offset.y;
      graphics.circle(x, y, radius);
      graphics.fill({ color: parseHexColor(token.color), alpha: 0.95 });
      graphics.circle(x, y, radius);
      graphics.stroke({ color: 0x000000, width: Math.max(1, radius * 0.18), alpha: 0.8 });
      visibleTokenCount += 1;
    });
  }

  return visibleTokenCount;
}
