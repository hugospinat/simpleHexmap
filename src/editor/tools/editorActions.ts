import type { Axial } from "@/domain/geometry/hex";
import {
  addMissingNeighborsWithPropagation,
  addTileWithPropagation,
  deleteWithDescendants,
  type TerrainType,
  type World
} from "@/domain/world/world";

export function paintTile(
  world: World,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): World {
  return addTileWithPropagation(world, level, axial, type, maxLevels);
}

export function eraseTile(world: World, level: number, axial: Axial, maxLevels: number): World {
  return deleteWithDescendants(world, level, axial, maxLevels);
}

export function growNeighbors(
  world: World,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): World {
  return addMissingNeighborsWithPropagation(world, level, axial, type, maxLevels);
}
