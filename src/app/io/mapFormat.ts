import { hexKey, parseHexKey } from "@/domain/geometry/hex";
import {
  mapFileVersion,
  type MapFactionRecord,
  type MapFactionTerritoryRecord,
  type MapFeatureRecord,
  type MapRiverRecord,
  type MapRoadRecord,
  type MapTileRecord,
  type SavedMap
} from "@/app/io/savedMapTypes";
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
  terrainTypes,
  type RiverEdgeIndex,
  type RoadEdgeIndex,
  type TerrainType,
  type World
} from "@/domain/world/world";
import { SOURCE_LEVEL } from "@/domain/world/mapRules";

export {
  mapFileVersion,
  type MapFactionRecord,
  type MapFactionTerritoryRecord,
  type MapFeatureRecord,
  type MapRiverRecord,
  type MapRoadRecord,
  type MapTileRecord,
  type SavedMap
} from "@/app/io/savedMapTypes";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isRiverEdgeIndex(value: unknown): value is RiverEdgeIndex {
  return isInteger(value) && value >= 0 && value <= 5;
}

function isRoadEdgeIndex(value: unknown): value is RoadEdgeIndex {
  return isInteger(value) && value >= 0 && value <= 5;
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function serializeTiles(world: World): MapTileRecord[] {
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

function serializeFeatures(world: World): MapFeatureRecord[] {
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

function serializeRivers(world: World): MapRiverRecord[] {
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

function serializeRoads(world: World): MapRoadRecord[] {
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

function serializeFactions(world: World): MapFactionRecord[] {
  return getFactions(world).map((faction) => ({
    id: faction.id,
    name: faction.name,
    color: faction.color
  }));
}

function serializeFactionTerritories(world: World): MapFactionTerritoryRecord[] {
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

export function parseSavedMap(raw: unknown): SavedMap {
  if (!isObject(raw)) {
    throw new Error("Invalid map file format.");
  }

  if (raw.version !== mapFileVersion) {
    throw new Error(`Unsupported map version: ${String(raw.version)}.`);
  }

  if (!Array.isArray(raw.tiles) || !Array.isArray(raw.features) || !Array.isArray(raw.rivers)) {
    throw new Error("Map file is missing required arrays.");
  }

  const rawRoads = Array.isArray(raw.roads) ? raw.roads : [];
  const rawFactions = Array.isArray(raw.factions) ? raw.factions : [];
  const rawFactionTerritories = Array.isArray(raw.factionTerritories) ? raw.factionTerritories : [];

  const tiles = raw.tiles.map((tile, index): MapTileRecord => {
    const terrain = isObject(tile) && typeof tile.terrain === "string"
      ? tile.terrain
      : isObject(tile) && typeof tile.tileId === "string"
        ? tile.tileId
        : null;

    if (!isObject(tile) || !isInteger(tile.q) || !isInteger(tile.r) || typeof terrain !== "string") {
      throw new Error(`Invalid tile entry at index ${index}.`);
    }

    if (!terrainTypes.includes(terrain as TerrainType)) {
      throw new Error(`Unknown terrain at index ${index}: ${terrain}.`);
    }

    return {
      q: tile.q,
      r: tile.r,
      terrain,
      hidden: typeof tile.hidden === "boolean" ? tile.hidden : false
    };
  });

  const features = raw.features.map((feature, index): MapFeatureRecord => {
    const kind = isObject(feature) && typeof feature.kind === "string"
      ? feature.kind
      : isObject(feature) && typeof feature.type === "string"
        ? feature.type
        : null;

    if (!isObject(feature) || !isInteger(feature.q) || !isInteger(feature.r) || typeof kind !== "string") {
      throw new Error(`Invalid feature entry at index ${index}.`);
    }

    if (!featureKinds.includes(kind as (typeof featureKinds)[number])) {
      throw new Error(`Unknown feature kind at index ${index}: ${kind}.`);
    }

    if (feature.visibility !== "visible" && feature.visibility !== "hidden") {
      throw new Error(`Invalid feature visibility at index ${index}.`);
    }

    if (typeof feature.overrideTerrainTile !== "boolean") {
      throw new Error(`Invalid overrideTerrainTile at index ${index}.`);
    }

    if (!isStringOrNull(feature.gmLabel)) {
      throw new Error(`Invalid gmLabel at index ${index}.`);
    }

    if (!isStringOrNull(feature.playerLabel)) {
      throw new Error(`Invalid playerLabel at index ${index}.`);
    }

    if (typeof feature.labelRevealed !== "boolean") {
      throw new Error(`Invalid labelRevealed at index ${index}.`);
    }

    const id = typeof feature.id === "string" && feature.id.trim()
      ? feature.id
      : `loaded-feature-${index}-${feature.q}-${feature.r}`;

    return {
      id,
      kind,
      q: feature.q,
      r: feature.r,
      visibility: feature.visibility,
      overrideTerrainTile: feature.overrideTerrainTile,
      gmLabel: feature.gmLabel,
      playerLabel: feature.playerLabel,
      labelRevealed: feature.labelRevealed
    };
  });

  const rivers = raw.rivers.map((river, index): MapRiverRecord => {
    if (!isObject(river) || !isInteger(river.q) || !isInteger(river.r) || !isRiverEdgeIndex(river.edge)) {
      throw new Error(`Invalid river entry at index ${index}.`);
    }

    return {
      q: river.q,
      r: river.r,
      edge: river.edge
    };
  });

  const roads = rawRoads.map((road, index): MapRoadRecord => {
    if (!isObject(road) || !isInteger(road.q) || !isInteger(road.r) || !Array.isArray(road.edges)) {
      throw new Error(`Invalid road entry at index ${index}.`);
    }

    const edges = road.edges.filter((edge): edge is RoadEdgeIndex => isRoadEdgeIndex(edge));

    if (edges.length !== road.edges.length) {
      throw new Error(`Invalid road edges at index ${index}.`);
    }

    return {
      q: road.q,
      r: road.r,
      edges: Array.from(new Set(edges)).sort((left, right) => left - right)
    };
  });

  const factions = rawFactions.map((faction, index): MapFactionRecord => {
    if (!isObject(faction) || typeof faction.id !== "string" || typeof faction.name !== "string" || typeof faction.color !== "string") {
      throw new Error(`Invalid faction entry at index ${index}.`);
    }

    if (!faction.id.trim() || !faction.name.trim() || !faction.color.trim()) {
      throw new Error(`Invalid faction values at index ${index}.`);
    }

    if (!isHexColor(faction.color)) {
      throw new Error(`Invalid faction color '${faction.color}' at index ${index}.`);
    }

    return {
      id: faction.id,
      name: faction.name,
      color: faction.color
    };
  });

  const factionTerritories = rawFactionTerritories.map((territory, index): MapFactionTerritoryRecord => {
    if (!isObject(territory) || !isInteger(territory.q) || !isInteger(territory.r) || typeof territory.factionId !== "string") {
      throw new Error(`Invalid faction territory entry at index ${index}.`);
    }

    return {
      q: territory.q,
      r: territory.r,
      factionId: territory.factionId
    };
  });

  return {
    version: mapFileVersion,
    tiles,
    features,
    rivers,
    roads,
    factions,
    factionTerritories
  };
}

export function parseSavedMapText(text: string): SavedMap {
  return parseSavedMap(JSON.parse(text) as unknown);
}

export function deserializeWorld(savedMap: SavedMap): World {
  let world = createEmptyWorld();

  for (const tile of savedMap.tiles) {
    world = addTile(world, SOURCE_LEVEL, { q: tile.q, r: tile.r }, tile.terrain as TerrainType);
    world = setCellHidden(world, SOURCE_LEVEL, { q: tile.q, r: tile.r }, tile.hidden);
  }

  for (const faction of savedMap.factions) {
    world = addFaction(world, faction);
  }

  for (let index = 0; index < savedMap.features.length; index += 1) {
    const feature = savedMap.features[index];

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

export function serializeWorld(world: World): SavedMap {
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
