import { featureKinds, terrainTypes, type RiverEdgeIndex, type RoadEdgeIndex, type TerrainType } from "@/core/map/world";
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

export type SavedMapContentCodec = {
  normalizeLegacy(raw: unknown): SavedMapContent;
  parse(raw: unknown): SavedMapContent;
  parseText(text: string): SavedMapContent;
  serialize(content: SavedMapContent): SavedMapContent;
};

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

export function parseSavedMapContent(raw: unknown): SavedMapContent {
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

export function parseSavedMapContentText(text: string): SavedMapContent {
  return parseSavedMapContent(JSON.parse(text) as unknown);
}

export const savedMapCodec: SavedMapContentCodec = {
  normalizeLegacy: parseSavedMapContent,
  parse: parseSavedMapContent,
  parseText: parseSavedMapContentText,
  serialize: (content) => content
};
