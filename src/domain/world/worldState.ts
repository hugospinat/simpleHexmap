import {
  getAncestorAtLevel,
  getDescendantsAtLevel,
  getNeighbors,
  hexKey,
  parseHexKey,
  type Axial
} from "@/domain/geometry/hex";
import { TERRAIN_TYPES } from "./terrainTypes";
import type { LevelMap, RiverLevelMap, RoadLevelMap, TerrainType, World } from "./worldTypes";

const sourceLevel = 3;

export function createEmptyWorld(): World {
  return {
    levels: {},
    featuresByLevel: {},
    factions: new Map(),
    factionAssignmentsByLevel: {},
    riversByLevel: {},
    roadsByLevel: {}
  };
}

export function createInitialWorld(maxLevels: number): World {
  return addTileWithPropagation(createEmptyWorld(), 1, { q: 0, r: 0 }, "plain", maxLevels);
}

function getStoredLevelMap(world: World, level: number): LevelMap {
  return world.levels[level] ?? new Map();
}

function getMostCommonTerrainType(types: TerrainType[]): TerrainType | null {
  if (types.length === 0) {
    return null;
  }

  const counts = new Map<TerrainType, number>();

  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }

  return TERRAIN_TYPES.reduce<{ count: number; type: TerrainType | null }>(
    (best, type) => {
      const count = counts.get(type) ?? 0;
      return count > best.count ? { count, type } : best;
    },
    { count: 0, type: null }
  ).type;
}

function getDerivedLevelMapFromSource(world: World, level: number): LevelMap {
  const sourceMap = getStoredLevelMap(world, sourceLevel);
  const grouped = new Map<string, TerrainType[]>();

  for (const [hexId, cell] of sourceMap.entries()) {
    const parent = getAncestorAtLevel(parseHexKey(hexId), sourceLevel, level);
    const parentKey = hexKey(parent);
    const terrains = grouped.get(parentKey) ?? [];
    terrains.push(cell.type);
    grouped.set(parentKey, terrains);
  }

  const derived = new Map<string, { type: TerrainType }>();

  for (const [parentKey, terrains] of grouped.entries()) {
    const type = getMostCommonTerrainType(terrains);

    if (type) {
      derived.set(parentKey, { type });
    }
  }

  return derived;
}

export function getLevelMap(world: World, level: number): LevelMap {
  if (level === sourceLevel) {
    return getStoredLevelMap(world, level);
  }

  return getDerivedLevelMapFromSource(world, level);
}

export function getRiverLevelMap(world: World, level: number): RiverLevelMap {
  return world.riversByLevel[level] ?? new Map();
}

export function getRoadLevelMap(world: World, level: number): RoadLevelMap {
  return world.roadsByLevel?.[level] ?? new Map();
}

export function addTile(world: World, level: number, axial: Axial, type: TerrainType): World {
  const key = hexKey(axial);
  const current = getStoredLevelMap(world, level).get(key);

  if (current?.type === type) {
    return world;
  }

  const nextLevel = new Map(getStoredLevelMap(world, level));
  nextLevel.set(key, { type });

  return {
    ...world,
    levels: {
      ...world.levels,
      [level]: nextLevel
    }
  };
}

export function removeTile(world: World, level: number, axial: Axial): World {
  const key = hexKey(axial);
  const currentLevel = getStoredLevelMap(world, level);

  if (!currentLevel.has(key)) {
    return world;
  }

  const nextLevel = new Map(currentLevel);
  nextLevel.delete(key);

  return {
    ...world,
    levels: {
      ...world.levels,
      [level]: nextLevel
    }
  };
}

function removeTiles(world: World, level: number, axials: Axial[]): World {
  const currentLevel = getStoredLevelMap(world, level);
  let nextLevel: LevelMap | null = null;

  for (const axial of axials) {
    const key = hexKey(axial);

    if (!currentLevel.has(key)) {
      continue;
    }

    if (!nextLevel) {
      nextLevel = new Map(currentLevel);
    }

    nextLevel.delete(key);
  }

  if (!nextLevel) {
    return world;
  }

  return {
    ...world,
    levels: {
      ...world.levels,
      [level]: nextLevel
    }
  };
}

export function deleteWithDescendants(
  world: World,
  level: number,
  axial: Axial,
  maxLevels: number
): World {
  const descendants = getDescendantsAtLevel(axial, level, sourceLevel);
  const currentLevel = getStoredLevelMap(world, sourceLevel);

  if (!descendants.some((descendant) => currentLevel.has(hexKey(descendant)))) {
    return world;
  }

  return removeTiles(world, sourceLevel, descendants);
}

export function propagateTileToDeeperLevels(
  world: World,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): World {
  let nextWorld = world;

  for (const descendant of getDescendantsAtLevel(axial, level, sourceLevel)) {
    nextWorld = addTile(nextWorld, sourceLevel, descendant, type);
  }

  return nextWorld;
}

export function addTileWithPropagation(
  world: World,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): World {
  return propagateTileToDeeperLevels(world, level, axial, type, maxLevels);
}

export function addMissingNeighborsWithPropagation(
  world: World,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): World {
  let nextWorld = world;
  const currentLevel = getLevelMap(world, level);

  for (const neighbor of getNeighbors(axial)) {
    const key = hexKey(neighbor);

    if (!currentLevel.has(key)) {
      nextWorld = addTileWithPropagation(nextWorld, level, neighbor, type, maxLevels);
    }
  }

  return nextWorld;
}
