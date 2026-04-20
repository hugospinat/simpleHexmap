import { getDescendantsAtLevel, hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { applyOperationsToWorld } from "@/core/map/worldOperationApplier";
import type { TerrainType, MapState } from "@/core/map/world";
import type { MapOperation } from "@/core/protocol";
import { emptyCommandResult, type MapEditCommandResult } from "./commandTypes";

export function terrainTargets(level: number, axial: Axial): Axial[] {
  return getDescendantsAtLevel(axial, level, SOURCE_LEVEL);
}

export function commandPaintTerrain(
  world: MapState,
  level: number,
  axial: Axial,
  terrainType: TerrainType,
): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const tiles: Array<{
    q: number;
    r: number;
    terrain: string;
    hidden: boolean;
  }> = [];

  for (const target of terrainTargets(level, axial)) {
    const current = sourceMap.get(hexKey(target));

    if (current?.type === terrainType) {
      continue;
    }

    tiles.push({
      q: target.q,
      r: target.r,
      terrain: terrainType,
      hidden: current?.hidden ?? true,
    });
  }

  let operations: MapOperation[] = [];

  if (tiles.length > 0) {
    const hiddenValue = tiles[0].hidden;
    const allSameHidden = tiles.every((tile) => tile.hidden === hiddenValue);

    operations = allSameHidden
      ? [
          {
            type: "paint_cells",
            cells: tiles.map((tile) => ({ q: tile.q, r: tile.r })),
            terrain: terrainType,
            hidden: hiddenValue,
          },
        ]
      : [
          {
            type: "set_tiles",
            tiles: tiles.map((tile) => ({
              q: tile.q,
              r: tile.r,
              terrain: tile.terrain,
              hidden: tile.hidden,
            })),
          },
        ];
  }

  return operations.length > 0
    ? {
        changed: true,
        mapState: applyOperationsToWorld(world, operations),
        operations,
      }
    : emptyCommandResult(world);
}

export function commandEraseTerrain(
  world: MapState,
  level: number,
  axial: Axial,
): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const cells: Array<{ q: number; r: number }> = [];

  for (const target of terrainTargets(level, axial)) {
    if (!sourceMap.has(hexKey(target))) {
      continue;
    }

    cells.push({ q: target.q, r: target.r });
  }

  const operations: MapOperation[] =
    cells.length > 0
      ? [
          {
            type: "paint_cells",
            cells,
            terrain: null,
            hidden: false,
          },
        ]
      : [];

  return operations.length > 0
    ? {
        changed: true,
        mapState: applyOperationsToWorld(world, operations),
        operations,
      }
    : emptyCommandResult(world);
}

export function commandSetCellHidden(
  world: MapState,
  level: number,
  axial: Axial,
  hidden: boolean,
): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const cells: Array<{ q: number; r: number }> = [];

  for (const target of terrainTargets(level, axial)) {
    const current = sourceMap.get(hexKey(target));

    if (!current || current.hidden === hidden) {
      continue;
    }

    cells.push({ q: target.q, r: target.r });
  }

  const operations: MapOperation[] =
    cells.length > 0
      ? [
          {
            type: "set_cells_hidden",
            cells,
            hidden,
          },
        ]
      : [];

  return operations.length > 0
    ? {
        changed: true,
        mapState: applyOperationsToWorld(world, operations),
        operations,
      }
    : emptyCommandResult(world);
}
