import { hexKey, parseHexKey } from "@/core/geometry/hex";
import {
  addFaction,
  addFeature,
  addRoadConnection,
  addRiverEdge,
  setCellHidden,
  addTile,
  assignFactionAt,
  createEmptyWorld,
  featureKinds,
  getCanonicalRiverEdgeRef,
  getFactionLevelMap,
  getFactions,
  getNeighborForRoadEdge,
  type TerrainType,
  type MapState
} from "@/core/map/world";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import {
  mapFileVersion,
  type MapFactionRecord,
  type MapFactionTerritoryRecord,
  type MapFeatureRecord,
  type MapRiverRecord,
  type MapRoadRecord,
  type MapTileRecord,
  type SavedMapContent
} from "@/app/document/savedMapTypes";

function serializeTiles(world: MapState): MapTileRecord[] {
  const levelMap = world.levels[SOURCE_LEVEL] ?? new Map();

  return Array.from(levelMap.entries())
    .map(([hexId, cell]) => {
      const axial = parseHexKey(hexId);

      return {
        q: axial.q,
        r: axial.r,
        terrain: cell.type,
        hidden: cell.hidden
      };
    })
    .sort((left, right) => (left.q - right.q) || (left.r - right.r) || left.terrain.localeCompare(right.terrain));
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
        visibility: feature.hidden ? "hidden" as const : "visible" as const,
        overrideTerrainTile: feature.overrideTerrainTile,
        gmLabel: feature.gmLabel ?? null,
        playerLabel: feature.playerLabel ?? null,
        labelRevealed: feature.labelRevealed ?? false
      };
    })
    .sort((left, right) => (left.q - right.q) || (left.r - right.r) || left.kind.localeCompare(right.kind));
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
        edge: canonical.edge
      });
    }
  }

  return serialized.sort((left, right) => (left.q - right.q) || (left.r - right.r) || (left.edge - right.edge));
}

function serializeRoads(world: MapState): MapRoadRecord[] {
  const roads = world.roadsByLevel[SOURCE_LEVEL] ?? new Map();

  return Array.from(roads.entries())
    .map(([hexId, edges]) => {
      const axial = parseHexKey(hexId);

      return {
        q: axial.q,
        r: axial.r,
        edges: Array.from(edges).sort((left, right) => left - right)
      };
    })
    .sort((left, right) => (left.q - right.q) || (left.r - right.r));
}

function serializeFactions(world: MapState): MapFactionRecord[] {
  return getFactions(world).map((faction) => ({
    id: faction.id,
    name: faction.name,
    color: faction.color
  }));
}

function serializeFactionTerritories(world: MapState): MapFactionTerritoryRecord[] {
  const assignments = getFactionLevelMap(world, SOURCE_LEVEL);

  return Array.from(assignments.entries())
    .map(([hexId, factionId]) => {
      const axial = parseHexKey(hexId);
      return {
        q: axial.q,
        r: axial.r,
        factionId
      };
    })
    .sort((left, right) => (left.q - right.q) || (left.r - right.r) || left.factionId.localeCompare(right.factionId));
}

export function deserializeWorld(savedMap: SavedMapContent): MapState {
  let world = createEmptyWorld();

  for (const tile of savedMap.tiles) {
    world = addTile(world, SOURCE_LEVEL, { q: tile.q, r: tile.r }, tile.terrain as TerrainType);
    world = setCellHidden(world, SOURCE_LEVEL, { q: tile.q, r: tile.r }, tile.hidden);
  }

  for (const faction of savedMap.factions) {
    world = addFaction(world, faction);
  }

  for (const feature of savedMap.features) {
    world = addFeature(world, SOURCE_LEVEL, {
      id: feature.id,
      kind: feature.kind as (typeof featureKinds)[number],
      hexId: hexKey({ q: feature.q, r: feature.r }),
      hidden: feature.visibility === "hidden",
      overrideTerrainTile: feature.overrideTerrainTile,
      gmLabel: feature.gmLabel ?? undefined,
      playerLabel: feature.playerLabel ?? undefined,
      labelRevealed: feature.labelRevealed
    });
  }

  for (const river of savedMap.rivers) {
    world = addRiverEdge(world, SOURCE_LEVEL, {
      axial: { q: river.q, r: river.r },
      edge: river.edge
    });
  }

  for (const road of savedMap.roads) {
    const from = { q: road.q, r: road.r };

    for (const edge of road.edges) {
      const to = getNeighborForRoadEdge(from, edge);
      world = addRoadConnection(world, SOURCE_LEVEL, from, to);
    }
  }

  for (const territory of savedMap.factionTerritories) {
    world = assignFactionAt(world, SOURCE_LEVEL, { q: territory.q, r: territory.r }, territory.factionId);
  }

  return world;
}

export function serializeWorld(world: MapState): SavedMapContent {
  return {
    version: mapFileVersion,
    tiles: serializeTiles(world),
    features: serializeFeatures(world),
    rivers: serializeRivers(world),
    roads: serializeRoads(world),
    factions: serializeFactions(world),
    factionTerritories: serializeFactionTerritories(world)
  };
}
