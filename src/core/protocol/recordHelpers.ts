import type {
  FactionPatch,
  FeaturePatch,
  MapFactionRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
  RoadEdgeIndex,
  SavedMapContent
} from "./types.js";

export type TileKey = `${number},${number}`;
export type RiverKey = `${number},${number},${number}`;

const axialDirections = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 }
] as const;

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

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function isRoadOrRiverEdge(value: unknown): value is RoadEdgeIndex {
  return isInteger(value) && value >= 0 && value <= 5;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function tileKey(tile: Pick<MapTileRecord, "q" | "r">): TileKey {
  return `${tile.q},${tile.r}`;
}

export function riverKey(river: MapRiverRecord): RiverKey {
  return `${river.q},${river.r},${river.edge}`;
}

export function roadKey(road: Pick<MapRoadRecord, "q" | "r">): TileKey {
  return `${road.q},${road.r}`;
}

export function normalizeRoad(road: MapRoadRecord): MapRoadRecord {
  return {
    q: road.q,
    r: road.r,
    edges: Array.from(new Set(road.edges)).sort((left, right) => left - right)
  };
}

export function getTileOperationTerrain(tile: { terrain: string | null }): string | null {
  return tile.terrain;
}

export function removeFactionTerritory(
  territories: SavedMapContent["factionTerritories"],
  q: number,
  r: number
): SavedMapContent["factionTerritories"] {
  return territories.filter((territory) => territory.q !== q || territory.r !== r);
}

export function sanitizeFeaturePatch(patch: FeaturePatch): FeaturePatch {
  const next: FeaturePatch = {};

  if (typeof patch.kind === "string") {
    next.kind = patch.kind;
  }
  if (patch.visibility === "visible" || patch.visibility === "hidden") {
    next.visibility = patch.visibility;
  }
  if (typeof patch.overrideTerrainTile === "boolean") {
    next.overrideTerrainTile = patch.overrideTerrainTile;
  }
  if (typeof patch.gmLabel === "string" || patch.gmLabel === null) {
    next.gmLabel = patch.gmLabel;
  }
  if (typeof patch.playerLabel === "string" || patch.playerLabel === null) {
    next.playerLabel = patch.playerLabel;
  }
  if (typeof patch.labelRevealed === "boolean") {
    next.labelRevealed = patch.labelRevealed;
  }

  return next;
}

export function sanitizeFactionPatch(patch: FactionPatch): FactionPatch {
  const next: FactionPatch = {};

  if (typeof patch.name === "string" && patch.name.trim()) {
    next.name = patch.name.trim();
  }
  if (isHexColor(patch.color)) {
    next.color = patch.color;
  }

  return next;
}

export function getRoadEdgeBetween(from: { q: number; r: number }, to: { q: number; r: number }): RoadEdgeIndex | null {
  const delta = {
    q: to.q - from.q,
    r: to.r - from.r
  };
  const directionIndex = axialDirections.findIndex((direction) => (
    direction.q === delta.q && direction.r === delta.r
  ));

  return directionIndex >= 0 ? axialDirectionIndexToRoadEdge[directionIndex] : null;
}

export function getOppositeRoadEdgeIndex(edge: RoadEdgeIndex): RoadEdgeIndex {
  return ((edge + 3) % 6) as RoadEdgeIndex;
}

export function getNeighborForRoadEdge(axial: { q: number; r: number }, edge: RoadEdgeIndex): { q: number; r: number } {
  const direction = axialDirections[roadEdgeToDirectionIndex[edge]];
  return {
    q: axial.q + direction.q,
    r: axial.r + direction.r
  };
}

export function addRoadConnectionToRecords(
  roads: MapRoadRecord[],
  from: { q: number; r: number },
  to: { q: number; r: number }
): MapRoadRecord[] {
  const edge = getRoadEdgeBetween(from, to);

  if (edge === null) {
    return roads;
  }

  const reverseEdge = getOppositeRoadEdgeIndex(edge);
  const fromEdges = getRoadRecordEdges(roads, from);
  const toEdges = getRoadRecordEdges(roads, to);

  if (fromEdges.has(edge) && toEdges.has(reverseEdge)) {
    return roads;
  }

  fromEdges.add(edge);
  toEdges.add(reverseEdge);
  return setRoadRecordEdges(setRoadRecordEdges(roads, from, fromEdges), to, toEdges);
}

export function removeRoadConnectionsAtFromRecords(
  roads: MapRoadRecord[],
  axial: { q: number; r: number }
): MapRoadRecord[] {
  const edges = getRoadRecordEdges(roads, axial);

  if (edges.size === 0) {
    return roads;
  }

  let next = roads.filter((road) => roadKey(road) !== roadKey(axial));

  for (const edge of edges) {
    const neighbor = getNeighborForRoadEdge(axial, edge);
    const neighborEdges = getRoadRecordEdges(next, neighbor);
    neighborEdges.delete(getOppositeRoadEdgeIndex(edge));
    next = setRoadRecordEdges(next, neighbor, neighborEdges);
  }

  return next;
}

function setRoadRecordEdges(
  roads: MapRoadRecord[],
  axial: { q: number; r: number },
  edges: Iterable<RoadEdgeIndex>
): MapRoadRecord[] {
  const edgeSet = new Set(edges);
  const next = roads.filter((road) => roadKey(road) !== roadKey(axial));

  if (edgeSet.size > 0) {
    next.push({
      q: axial.q,
      r: axial.r,
      edges: Array.from(edgeSet).sort((left, right) => left - right)
    });
  }

  return next;
}

function getRoadRecordEdges(roads: MapRoadRecord[], axial: { q: number; r: number }): Set<RoadEdgeIndex> {
  return new Set(roads.find((road) => roadKey(road) === roadKey(axial))?.edges ?? []);
}

export type { MapFactionRecord, MapFeatureRecord, MapRiverRecord, MapRoadRecord, MapTileRecord };
