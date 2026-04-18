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
  terrainType: TerrainType
): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const operations: MapOperation[] = [];

  for (const target of terrainTargets(level, axial)) {
    const current = sourceMap.get(hexKey(target));

    if (current?.type === terrainType) {
      continue;
    }

    operations.push({
      type: "set_tile",
      tile: {
        q: target.q,
        r: target.r,
        terrain: terrainType,
        hidden: current?.hidden ?? true
      }
    });
  }

  return operations.length > 0
    ? { changed: true, mapState: applyOperationsToWorld(world, operations), operations }
    : emptyCommandResult(world);
}

export function commandEraseTerrain(world: MapState, level: number, axial: Axial): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const operations: MapOperation[] = [];

  for (const target of terrainTargets(level, axial)) {
    if (!sourceMap.has(hexKey(target))) {
      continue;
    }

    operations.push({
      type: "set_tile",
      tile: {
        q: target.q,
        r: target.r,
        terrain: null,
        hidden: false
      }
    });
  }

  return operations.length > 0
    ? { changed: true, mapState: applyOperationsToWorld(world, operations), operations }
    : emptyCommandResult(world);
}

export function commandSetCellHidden(
  world: MapState,
  level: number,
  axial: Axial,
  hidden: boolean
): MapEditCommandResult {
  const sourceMap = world.levels[SOURCE_LEVEL] ?? new Map();
  const operations: MapOperation[] = [];

  for (const target of terrainTargets(level, axial)) {
    const current = sourceMap.get(hexKey(target));

    if (!current || current.hidden === hidden) {
      continue;
    }

    operations.push({
      type: "set_cell_hidden",
      cell: {
        q: target.q,
        r: target.r,
        hidden
      }
    });
  }

  return operations.length > 0
    ? { changed: true, mapState: applyOperationsToWorld(world, operations), operations }
    : emptyCommandResult(world);
}
