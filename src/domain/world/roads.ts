import {
  addAxial,
  axialDirections,
  getAncestorAtLevel,
  hexKey,
  parseHexKey,
  type Axial
} from "@/domain/geometry/hex";
import type { World } from "@/domain/world/worldTypes";

const sourceLevel = 3;

export type RoadEdgeIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type RoadEdgeSet = Set<RoadEdgeIndex>;
export type RoadLevelMap = Map<string, RoadEdgeSet>;

export const roadEdgeIndexes: RoadEdgeIndex[] = [0, 1, 2, 3, 4, 5];

const roadEdgeToDirectionIndex: Record<RoadEdgeIndex, number> = {
  0: 2,
  1: 5,
  2: 1,
  3: 3,
  4: 4,
  5: 0
};

const axialDirectionIndexToRoadEdge: Record<number, RoadEdgeIndex> = {
  0: 5,
  1: 2,
  2: 0,
  3: 3,
  4: 4,
  5: 1
};

function cloneRoadLevelMap(levelMap: RoadLevelMap): RoadLevelMap {
  return new Map(
    Array.from(levelMap.entries(), ([hexId, edges]) => [
      hexId,
      new Set(edges)
    ])
  );
}

function normalizeRoadLevelMap(levelMap: RoadLevelMap | undefined): RoadLevelMap {
  return levelMap ? cloneRoadLevelMap(levelMap) : new Map();
}

export function getRoadEdgeBetween(from: Axial, to: Axial): RoadEdgeIndex | null {
  const delta = {
    q: to.q - from.q,
    r: to.r - from.r
  };
  const directionIndex = axialDirections.findIndex((direction) => (
    direction.q === delta.q && direction.r === delta.r
  ));

  return directionIndex >= 0 ? axialDirectionIndexToRoadEdge[directionIndex] : null;
}

function setRoadEdges(levelMap: RoadLevelMap, axial: Axial, edges: RoadEdgeSet) {
  const key = hexKey(axial);

  if (edges.size === 0) {
    levelMap.delete(key);
    return;
  }

  levelMap.set(key, edges);
}

export function getRoadLevelMap(world: World, level: number): RoadLevelMap {
  if (level !== sourceLevel) {
    return deriveRoadLevelMapFromSource(world, level);
  }

  return normalizeRoadLevelMap(world.roadsByLevel?.[level]);
}

function getStoredRoadLevelMap(world: World, level: number): RoadLevelMap {
  return normalizeRoadLevelMap(world.roadsByLevel?.[level]);
}

function deriveRoadLevelMapFromSource(world: World, level: number): RoadLevelMap {
  const sourceMap = getStoredRoadLevelMap(world, sourceLevel);
  const derived = new Map<string, RoadEdgeSet>();
  const seenSourceEdges = new Set<string>();

  for (const [hexId, edges] of sourceMap.entries()) {
    const axial = roadHexIdToAxial(hexId);

    for (const edge of edges) {
      const neighbor = getNeighborForRoadEdge(axial, edge);
      const sourceEdgeKey = [hexKey(axial), hexKey(neighbor)].sort().join("|");

      if (seenSourceEdges.has(sourceEdgeKey)) {
        continue;
      }

      seenSourceEdges.add(sourceEdgeKey);

      const parent = getAncestorAtLevel(axial, sourceLevel, level);
      const neighborParent = getAncestorAtLevel(neighbor, sourceLevel, level);

      if (hexKey(parent) === hexKey(neighborParent)) {
        continue;
      }

      const parentEdge = getRoadEdgeBetween(parent, neighborParent);

      if (parentEdge === null) {
        continue;
      }

      const reverseEdge = getOppositeRoadEdgeIndex(parentEdge);
      setRoadEdges(derived, parent, new Set([...(derived.get(hexKey(parent)) ?? []), parentEdge]));
      setRoadEdges(
        derived,
        neighborParent,
        new Set([...(derived.get(hexKey(neighborParent)) ?? []), reverseEdge])
      );
    }
  }

  return derived;
}

export function getRoadEdgesAt(world: World, level: number, axial: Axial): RoadEdgeSet {
  return getRoadLevelMap(world, level).get(hexKey(axial)) ?? new Set();
}

export function getOppositeRoadEdgeIndex(edge: RoadEdgeIndex): RoadEdgeIndex {
  return ((edge + 3) % 6) as RoadEdgeIndex;
}

export function getNeighborForRoadEdge(axial: Axial, edge: RoadEdgeIndex): Axial {
  return addAxial(axial, axialDirections[roadEdgeToDirectionIndex[edge]]);
}

export function addRoadConnection(world: World, level: number, from: Axial, to: Axial): World {
  const edge = getRoadEdgeBetween(from, to);

  if (edge === null) {
    return world;
  }

  const reverseEdge = getOppositeRoadEdgeIndex(edge);
  const levelMap = getStoredRoadLevelMap(world, level);
  const fromKey = hexKey(from);
  const toKey = hexKey(to);
  const fromEdges = new Set(levelMap.get(fromKey) ?? []);
  const toEdges = new Set(levelMap.get(toKey) ?? []);

  if (fromEdges.has(edge) && toEdges.has(reverseEdge)) {
    return world;
  }

  fromEdges.add(edge);
  toEdges.add(reverseEdge);
  setRoadEdges(levelMap, from, fromEdges);
  setRoadEdges(levelMap, to, toEdges);

  return {
    ...world,
    roadsByLevel: {
      ...world.roadsByLevel,
      [level]: levelMap
    }
  };
}

export function removeRoadConnection(world: World, level: number, from: Axial, to: Axial): World {
  const edge = getRoadEdgeBetween(from, to);

  if (edge === null) {
    return world;
  }

  const reverseEdge = getOppositeRoadEdgeIndex(edge);
  const levelMap = getStoredRoadLevelMap(world, level);
  const fromKey = hexKey(from);
  const toKey = hexKey(to);
  const fromEdges = new Set(levelMap.get(fromKey) ?? []);
  const toEdges = new Set(levelMap.get(toKey) ?? []);

  if (!fromEdges.has(edge) && !toEdges.has(reverseEdge)) {
    return world;
  }

  fromEdges.delete(edge);
  toEdges.delete(reverseEdge);
  setRoadEdges(levelMap, from, fromEdges);
  setRoadEdges(levelMap, to, toEdges);

  return {
    ...world,
    roadsByLevel: {
      ...world.roadsByLevel,
      [level]: levelMap
    }
  };
}

export function removeRoadConnectionsAt(world: World, level: number, axial: Axial): World {
  const levelMap = getStoredRoadLevelMap(world, level);
  const key = hexKey(axial);
  const edges = levelMap.get(key);

  if (!edges || edges.size === 0) {
    return world;
  }

  for (const edge of edges) {
    const neighbor = getNeighborForRoadEdge(axial, edge);
    const neighborKey = hexKey(neighbor);
    const neighborEdges = new Set(levelMap.get(neighborKey) ?? []);
    neighborEdges.delete(getOppositeRoadEdgeIndex(edge));
    setRoadEdges(levelMap, neighbor, neighborEdges);
  }

  levelMap.delete(key);

  return {
    ...world,
    roadsByLevel: {
      ...world.roadsByLevel,
      [level]: levelMap
    }
  };
}

export function roadHexIdToAxial(hexId: string): Axial {
  return parseHexKey(hexId);
}
