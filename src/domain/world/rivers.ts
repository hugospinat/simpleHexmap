import {
  addAxial,
  axialDirections,
  hexKey,
  type Axial
} from "@/domain/geometry/hex";
import type { RiverEdgeIndex, RiverEdgeRef, RiverFlow, RiverFlowLevelMap, RiverLevelMap, World } from "./worldTypes";

const riverEdgeDirectionIndex = [2, 5, 1, 3, 4, 0] as const;

export function getNeighborForRiverEdge(axial: Axial, edge: RiverEdgeIndex): Axial {
  return addAxial(axial, axialDirections[riverEdgeDirectionIndex[edge]]);
}

export function getOppositeRiverEdgeIndex(edge: RiverEdgeIndex): RiverEdgeIndex {
  return ((edge + 3) % 6) as RiverEdgeIndex;
}

export function getRiverEdgeRefKey(ref: RiverEdgeRef): string {
  return `${hexKey(ref.axial)}|${ref.edge}`;
}

export function getCanonicalRiverEdgeRef(ref: RiverEdgeRef): RiverEdgeRef {
  const neighbor = getNeighborForRiverEdge(ref.axial, ref.edge);
  const oppositeEdge = getOppositeRiverEdgeIndex(ref.edge);
  const localKey = getRiverEdgeRefKey(ref);
  const oppositeRef = { axial: neighbor, edge: oppositeEdge };
  const oppositeKey = getRiverEdgeRefKey(oppositeRef);

  return localKey <= oppositeKey ? ref : oppositeRef;
}

export function getCanonicalRiverEdgeKey(ref: RiverEdgeRef): string {
  return getRiverEdgeRefKey(getCanonicalRiverEdgeRef(ref));
}

function setRiverHalfEdge(levelMap: RiverLevelMap, key: string, edge: RiverEdgeIndex, enabled: boolean) {
  const current = levelMap.get(key);

  if (enabled) {
    if (current?.has(edge)) {
      return;
    }

    const next = current ? new Set(current) : new Set<RiverEdgeIndex>();
    next.add(edge);
    levelMap.set(key, next);
    return;
  }

  if (!current?.has(edge)) {
    return;
  }

  const next = new Set(current);
  next.delete(edge);

  if (next.size === 0) {
    levelMap.delete(key);
    return;
  }

  levelMap.set(key, next);
}

function getStoredRiverLevelMap(world: World, level: number): RiverLevelMap {
  return world.riversByLevel[level] ?? new Map();
}

function walkRiverEdgesAroundParent(
  start: RiverEdgeIndex,
  end: RiverEdgeIndex,
  step: 1 | -1
): RiverEdgeIndex[] {
  const edges: RiverEdgeIndex[] = [start];
  let current = start;

  while (current !== end) {
    current = ((current + step + 6) % 6) as RiverEdgeIndex;
    edges.push(current);
  }

  return edges;
}

export function getRiverEdgePathBetween(entryEdge: RiverEdgeIndex, exitEdge: RiverEdgeIndex): RiverEdgeIndex[] {
  const clockwise = walkRiverEdgesAroundParent(entryEdge, exitEdge, 1);
  const counterClockwise = walkRiverEdgesAroundParent(entryEdge, exitEdge, -1);

  return clockwise.length <= counterClockwise.length ? clockwise : counterClockwise;
}

export function getRiverFlowLevelMap(world: World, level: number): RiverFlowLevelMap {
  void world;
  void level;
  return new Map();
}

export function getRiverLevelMap(world: World, level: number): RiverLevelMap {
  return getStoredRiverLevelMap(world, level);
}

function setRiverEdge(world: World, level: number, ref: RiverEdgeRef, enabled: boolean): World {
  const currentLevel = getStoredRiverLevelMap(world, level);
  const key = hexKey(ref.axial);
  const neighbor = getNeighborForRiverEdge(ref.axial, ref.edge);
  const neighborKey = hexKey(neighbor);
  const neighborOppositeEdge = getOppositeRiverEdgeIndex(ref.edge);
  const hasCurrent = currentLevel.get(key)?.has(ref.edge) ?? false;
  const hasNeighbor = currentLevel.get(neighborKey)?.has(neighborOppositeEdge) ?? false;

  if (hasCurrent === enabled && hasNeighbor === enabled) {
    return world;
  }

  const nextLevel = new Map(currentLevel);
  setRiverHalfEdge(nextLevel, key, ref.edge, enabled);
  setRiverHalfEdge(nextLevel, neighborKey, neighborOppositeEdge, enabled);

  return {
    ...world,
    riversByLevel: {
      ...world.riversByLevel,
      [level]: nextLevel
    }
  };
}

export function addRiverEdge(world: World, level: number, ref: RiverEdgeRef): World {
  return setRiverEdge(world, level, ref, true);
}

export function removeRiverEdge(world: World, level: number, ref: RiverEdgeRef): World {
  return setRiverEdge(world, level, ref, false);
}
