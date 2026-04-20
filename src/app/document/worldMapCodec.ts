import { hexKey, parseHexKey } from "@/core/geometry/hex";
import {
  getCanonicalRiverEdgeRef,
  getFactionLevelMap,
  getFactions,
  getNeighborForRiverEdge,
  getOppositeRiverEdgeIndex,
  type TerrainType,
  type MapState,
} from "@/core/map/world";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { createInitialMapStateVersions } from "@/core/map/worldTypes";
import { mapFileVersion } from "@/core/document/savedMapCodec";
import type {
  MapDocument,
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapRoadRecord,
  MapTileRecord,
} from "@/core/protocol";
import type {
  Feature,
  FeatureKind,
  FeatureLevelMap,
} from "@/core/map/features";
import type { FactionLevelMap, FactionMap } from "@/core/map/factions";
import type { RiverEdgeIndex, RiverLevelMap } from "@/core/map/worldTypes";
import type { RoadEdgeIndex, RoadLevelMap } from "@/core/map/roads";

function serializeTiles(world: MapState): MapTileRecord[] {
  const levelMap = world.levels[SOURCE_LEVEL] ?? new Map();

  return Array.from(levelMap.entries())
    .map(([hexId, cell]) => {
      const axial = parseHexKey(hexId);

      return {
        q: axial.q,
        r: axial.r,
        terrain: cell.type,
        hidden: cell.hidden,
      };
    })
    .sort(
      (left, right) =>
        left.q - right.q ||
        left.r - right.r ||
        left.terrain.localeCompare(right.terrain),
    );
}

function serializeFeatures(world: MapState): MapFeatureRecord[] {
  const featureMap = world.featuresByLevel[SOURCE_LEVEL] ?? new Map();

  return Array.from(featureMap.values())
    .map((feature) => {
      const axial = parseHexKey(feature.hexId);

      return {
        id: feature.id,
        kind: feature.kind,
        q: axial.q,
        r: axial.r,
        hidden: feature.hidden,
        gmLabel: feature.gmLabel ?? null,
        playerLabel: feature.playerLabel ?? null,
        labelRevealed: feature.labelRevealed ?? false,
      };
    })
    .sort(
      (left, right) =>
        left.q - right.q ||
        left.r - right.r ||
        left.kind.localeCompare(right.kind),
    );
}

function serializeRivers(world: MapState): MapRiverRecord[] {
  const riverMap = world.riversByLevel[SOURCE_LEVEL] ?? new Map();
  const seen = new Set<string>();
  const serialized: MapRiverRecord[] = [];

  for (const [hexId, edges] of riverMap.entries()) {
    const axial = parseHexKey(hexId);

    for (const edge of edges) {
      const canonical = getCanonicalRiverEdgeRef({ axial, edge });
      const canonicalKey = `${hexKey(canonical.axial)}|${canonical.edge}`;

      if (seen.has(canonicalKey)) {
        continue;
      }

      seen.add(canonicalKey);
      serialized.push({
        q: canonical.axial.q,
        r: canonical.axial.r,
        edge: canonical.edge,
      });
    }
  }

  return serialized.sort(
    (left, right) =>
      left.q - right.q || left.r - right.r || left.edge - right.edge,
  );
}

function serializeRoads(world: MapState): MapRoadRecord[] {
  const roads = world.roadsByLevel[SOURCE_LEVEL] ?? new Map();

  return Array.from(roads.entries())
    .map(([hexId, edges]) => {
      const axial = parseHexKey(hexId);

      return {
        q: axial.q,
        r: axial.r,
        edges: Array.from(edges).sort((left, right) => left - right),
      };
    })
    .sort((left, right) => left.q - right.q || left.r - right.r);
}

function serializeFactions(world: MapState): MapFactionRecord[] {
  return getFactions(world).map((faction) => ({
    id: faction.id,
    name: faction.name,
    color: faction.color,
  }));
}

function serializeFactionTerritories(
  world: MapState,
): MapFactionTerritoryRecord[] {
  const assignments = getFactionLevelMap(world, SOURCE_LEVEL);

  return Array.from(assignments.entries())
    .map(([hexId, factionId]) => {
      const axial = parseHexKey(hexId);
      return {
        q: axial.q,
        r: axial.r,
        factionId,
      };
    })
    .sort(
      (left, right) =>
        left.q - right.q ||
        left.r - right.r ||
        left.factionId.localeCompare(right.factionId),
    );
}

export function deserializeWorld(savedMap: MapDocument): MapState {
  const sourceLevel = new Map<string, { hidden: boolean; type: TerrainType }>();

  for (const tile of savedMap.tiles) {
    sourceLevel.set(hexKey({ q: tile.q, r: tile.r }), {
      hidden: tile.hidden,
      type: tile.terrain as TerrainType,
    });
  }

  const factions: FactionMap = new Map();

  for (const faction of savedMap.factions) {
    if (!factions.has(faction.id)) {
      factions.set(faction.id, { ...faction });
    }
  }

  const features: FeatureLevelMap = new Map();

  for (const feature of savedMap.features) {
    const hexId = hexKey({ q: feature.q, r: feature.r });

    if (features.has(hexId)) {
      continue;
    }

    features.set(hexId, {
      id: feature.id,
      kind: feature.kind as FeatureKind,
      hexId,
      hidden: feature.hidden,
      gmLabel: feature.gmLabel ?? undefined,
      playerLabel: feature.playerLabel ?? undefined,
      labelRevealed: feature.labelRevealed,
    } satisfies Feature);
  }

  const rivers: RiverLevelMap = new Map();

  const setRiverHalfEdge = (key: string, edge: RiverEdgeIndex) => {
    const edges = rivers.get(key) ?? new Set<RiverEdgeIndex>();
    edges.add(edge);
    rivers.set(key, edges);
  };

  for (const river of savedMap.rivers) {
    const axial = { q: river.q, r: river.r };
    const key = hexKey(axial);
    const neighbor = getNeighborForRiverEdge(axial, river.edge);
    const neighborEdge = getOppositeRiverEdgeIndex(river.edge);
    setRiverHalfEdge(key, river.edge);
    setRiverHalfEdge(hexKey(neighbor), neighborEdge);
  }

  const roads: RoadLevelMap = new Map();

  const setRoadHalfEdge = (key: string, edge: RoadEdgeIndex) => {
    const edges = roads.get(key) ?? new Set<RoadEdgeIndex>();
    edges.add(edge);
    roads.set(key, edges);
  };

  for (const road of savedMap.roads) {
    const key = hexKey({ q: road.q, r: road.r });

    for (const edge of road.edges) {
      setRoadHalfEdge(key, edge);
    }
  }

  const factionAssignments: FactionLevelMap = new Map();

  for (const territory of savedMap.factionTerritories) {
    const key = hexKey({ q: territory.q, r: territory.r });

    if (sourceLevel.has(key) && factions.has(territory.factionId)) {
      factionAssignments.set(key, territory.factionId);
    }
  }

  const versions = createInitialMapStateVersions();
  versions.terrain = sourceLevel.size > 0 ? 1 : 0;
  versions.features = features.size > 0 ? 1 : 0;
  versions.factions = factions.size > 0 || factionAssignments.size > 0 ? 1 : 0;
  versions.rivers = rivers.size > 0 ? 1 : 0;
  versions.roads = roads.size > 0 ? 1 : 0;

  return {
    levels: {
      [SOURCE_LEVEL]: sourceLevel,
    },
    featuresByLevel: {
      [SOURCE_LEVEL]: features,
    },
    factions,
    factionAssignmentsByLevel: {
      [SOURCE_LEVEL]: factionAssignments,
    },
    riversByLevel: {
      [SOURCE_LEVEL]: rivers,
    },
    roadsByLevel: {
      [SOURCE_LEVEL]: roads,
    },
    versions,
  };
}

export function serializeWorld(world: MapState): MapDocument {
  return {
    version: mapFileVersion,
    tiles: serializeTiles(world),
    features: serializeFeatures(world),
    rivers: serializeRivers(world),
    roads: serializeRoads(world),
    factions: serializeFactions(world),
    factionTerritories: serializeFactionTerritories(world),
  };
}
