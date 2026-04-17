import {
  getAncestorAtLevel,
  getDescendantsAtLevel,
  getNeighbors,
  hexKey,
  parseHexKey,
  type Axial
} from "@/core/geometry/hex";
import { TERRAIN_TYPES } from "./terrainTypes";
import { SOURCE_LEVEL } from "./mapRules";
import type { LevelMap, RiverLevelMap, RoadLevelMap, TerrainType, MapState } from "./worldTypes";
import { bumpMapStateVersion, createInitialMapStateVersions } from "./worldTypes";

export function createEmptyWorld(): MapState {
  return {
    levels: {},
    featuresByLevel: {},
    factions: new Map(),
    factionAssignmentsByLevel: {},
    riversByLevel: {},
    roadsByLevel: {},
    versions: createInitialMapStateVersions()
  };
}

export function createInitialWorld(maxLevels: number): MapState {
  return addTileWithPropagation(createEmptyWorld(), 1, { q: 0, r: 0 }, "plain", maxLevels);
}

function getStoredLevelMap(world: MapState, level: number): LevelMap {
  return world.levels[level] ?? new Map();
}

function getMostCommonTerrainType(cells: { type: TerrainType }[]): TerrainType | null {
  if (cells.length === 0) {
    return null;
  }

  const counts = new Map<TerrainType, number>();

  for (const { type } of cells) {
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

function getDerivedLevelMapFromSource(world: MapState, level: number): LevelMap {
  const sourceMap = getStoredLevelMap(world, SOURCE_LEVEL);
  const grouped = new Map<string, { hidden: boolean; type: TerrainType }[]>();

  for (const [hexId, cell] of sourceMap.entries()) {
    const parent = getAncestorAtLevel(parseHexKey(hexId), SOURCE_LEVEL, level);
    const parentKey = hexKey(parent);
    const cells = grouped.get(parentKey) ?? [];
    cells.push({
      hidden: cell.hidden,
      type: cell.type
    });
    grouped.set(parentKey, cells);
  }

  const derived = new Map<string, { hidden: boolean; type: TerrainType }>();

  for (const [parentKey, cells] of grouped.entries()) {
    const type = getMostCommonTerrainType(cells);

    if (type) {
      derived.set(parentKey, {
        // A parent cell is hidden only when all source descendants are hidden.
        // Revealing any descendant reveals the aggregated parent tile.
        hidden: cells.every((cell) => cell.hidden),
        type
      });
    }
  }

  return derived;
}

export function getLevelMap(world: MapState, level: number): LevelMap {
  if (level === SOURCE_LEVEL) {
    return getStoredLevelMap(world, level);
  }

  return getDerivedLevelMapFromSource(world, level);
}

export function getRiverLevelMap(world: MapState, level: number): RiverLevelMap {
  return world.riversByLevel[level] ?? new Map();
}

export function getRoadLevelMap(world: MapState, level: number): RoadLevelMap {
  return world.roadsByLevel?.[level] ?? new Map();
}

export function addTile(world: MapState, level: number, axial: Axial, type: TerrainType): MapState {
  const key = hexKey(axial);
  const current = getStoredLevelMap(world, level).get(key);

  if (current?.type === type) {
    return world;
  }

  const nextLevel = new Map(getStoredLevelMap(world, level));
  nextLevel.set(key, {
    hidden: current?.hidden ?? false,
    type
  });

  return {
    ...world,
    levels: {
      ...world.levels,
      [level]: nextLevel
    },
    versions: bumpMapStateVersion(world, "terrain")
  };
}

export function setCellHidden(world: MapState, level: number, axial: Axial, hidden: boolean): MapState {
  const sourceLevelMap = getStoredLevelMap(world, SOURCE_LEVEL);
  const sourceTargets = level === SOURCE_LEVEL
    ? [axial]
    : getDescendantsAtLevel(axial, level, SOURCE_LEVEL);
  let nextLevel: LevelMap | null = null;

  for (const target of sourceTargets) {
    const targetKey = hexKey(target);
    const current = sourceLevelMap.get(targetKey);

    if (!current || current.hidden === hidden) {
      continue;
    }

    if (!nextLevel) {
      nextLevel = new Map(sourceLevelMap);
    }

    nextLevel.set(targetKey, {
      ...current,
      hidden
    });
  }

  if (!nextLevel) {
    return world;
  }

  return {
    ...world,
    levels: {
      ...world.levels,
      [SOURCE_LEVEL]: nextLevel
    },
    versions: bumpMapStateVersion(world, "terrain")
  };
}

export function removeTile(world: MapState, level: number, axial: Axial): MapState {
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
    },
    versions: bumpMapStateVersion(world, "terrain")
  };
}

function removeTiles(world: MapState, level: number, axials: Axial[]): MapState {
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
    },
    versions: bumpMapStateVersion(world, "terrain")
  };
}

export function deleteWithDescendants(
  world: MapState,
  level: number,
  axial: Axial,
  maxLevels: number
): MapState {
  const descendants = getDescendantsAtLevel(axial, level, SOURCE_LEVEL);
  const currentLevel = getStoredLevelMap(world, SOURCE_LEVEL);

  if (!descendants.some((descendant) => currentLevel.has(hexKey(descendant)))) {
    return world;
  }

  return removeTiles(world, SOURCE_LEVEL, descendants);
}

export function propagateTileToDeeperLevels(
  world: MapState,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): MapState {
  let nextWorld = world;

  for (const descendant of getDescendantsAtLevel(axial, level, SOURCE_LEVEL)) {
    nextWorld = addTile(nextWorld, SOURCE_LEVEL, descendant, type);
  }

  return nextWorld;
}

export function addTileWithPropagation(
  world: MapState,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): MapState {
  return propagateTileToDeeperLevels(world, level, axial, type, maxLevels);
}

export function addMissingNeighborsWithPropagation(
  world: MapState,
  level: number,
  axial: Axial,
  type: TerrainType,
  maxLevels: number
): MapState {
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
