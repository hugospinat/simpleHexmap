import {
  addAxial,
  axialDirections,
  hexKey,
  type Axial,
  type HexId
} from "@/core/geometry/hex";
import type { RiverEdgeIndex, RiverEdgeRef, RiverLevelMap, MapState } from "./worldTypes";

const riverEdgeDirectionIndex = [2, 5, 1, 3, 4, 0] as const;

export function getNeighborForRiverEdge(axial: Axial, edge: RiverEdgeIndex): Axial {
  return addAxial(axial, axialDirections[riverEdgeDirectionIndex[edge]]);
}

export function getOppositeRiverEdgeIndex(edge: RiverEdgeIndex): RiverEdgeIndex {
  return ((edge + 3) % 6) as RiverEdgeIndex;
}

export type RiverEdgeId = string & { readonly __brand: "RiverEdgeId" };

export function getRiverEdgeRefKey(ref: RiverEdgeRef): RiverEdgeId {
  return `${hexKey(ref.axial)}|${ref.edge}` as RiverEdgeId;
}

export function getCanonicalRiverEdgeRef(ref: RiverEdgeRef): RiverEdgeRef {
  const neighbor = getNeighborForRiverEdge(ref.axial, ref.edge);
  const oppositeEdge = getOppositeRiverEdgeIndex(ref.edge);
  const localKey = getRiverEdgeRefKey(ref);
  const oppositeRef = { axial: neighbor, edge: oppositeEdge };
  const oppositeKey = getRiverEdgeRefKey(oppositeRef);

  return localKey <= oppositeKey ? ref : oppositeRef;
}

export function getCanonicalRiverEdgeKey(ref: RiverEdgeRef): RiverEdgeId {
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

function getStoredRiverLevelMap(world: MapState, level: number): RiverLevelMap {
  return world.riversByLevel[level] ?? new Map();
}

export function getRiverLevelMap(world: MapState, level: number): RiverLevelMap {
  return getStoredRiverLevelMap(world, level);
}

function setRiverEdge(world: MapState, level: number, ref: RiverEdgeRef, enabled: boolean): MapState {
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

export function addRiverEdge(world: MapState, level: number, ref: RiverEdgeRef): MapState {
  return setRiverEdge(world, level, ref, true);
}

export function removeRiverEdge(world: MapState, level: number, ref: RiverEdgeRef): MapState {
  return setRiverEdge(world, level, ref, false);
}
