import {
  type MapDocument,
  type MapFactionRecord,
  type MapFactionTerritoryRecord,
  type MapFeatureRecord,
  type MapRiverRecord,
  type MapRoadRecord,
  type MapTileRecord,
} from "../protocol/index.js";

export const mapFileVersion = 1;

const terrainTypes = [
  "empty",
  "water",
  "plain",
  "forest",
  "hill",
  "mountain",
  "desert",
  "swamp",
  "tundra",
  "wasteland",
] as const;

const featureKinds = [
  "city",
  "capital",
  "village",
  "fort",
  "ruin",
  "tower",
  "dungeon",
  "marker",
  "label",
] as const;

type TerrainType = (typeof terrainTypes)[number];
type RoadEdgeIndex = 0 | 1 | 2 | 3 | 4 | 5;
type RiverEdgeIndex = RoadEdgeIndex;

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

export function parseMapDocument(raw: unknown): MapDocument {
  if (!isObject(raw)) {
    throw new Error("Invalid map file format.");
  }

  if (raw.version !== mapFileVersion) {
    throw new Error(`Unsupported map version: ${String(raw.version)}.`);
  }

  if (
    !Array.isArray(raw.tiles) ||
    !Array.isArray(raw.features) ||
    !Array.isArray(raw.rivers) ||
    !Array.isArray(raw.roads) ||
    !Array.isArray(raw.factions) ||
    !Array.isArray(raw.factionTerritories)
  ) {
    throw new Error("Map file is missing required arrays.");
  }

  const tiles = raw.tiles.map((tile, index): MapTileRecord => {
    if (
      !isObject(tile) ||
      !isInteger(tile.q) ||
      !isInteger(tile.r) ||
      typeof tile.terrain !== "string" ||
      typeof tile.hidden !== "boolean"
    ) {
      throw new Error(`Invalid tile entry at index ${index}.`);
    }

    if (!terrainTypes.includes(tile.terrain as TerrainType)) {
      throw new Error(`Unknown terrain at index ${index}: ${tile.terrain}.`);
    }

    return {
      q: tile.q,
      r: tile.r,
      terrain: tile.terrain,
      hidden: tile.hidden,
    };
  });

  const features = raw.features.map((feature, index): MapFeatureRecord => {
    if (
      !isObject(feature) ||
      !isInteger(feature.q) ||
      !isInteger(feature.r) ||
      typeof feature.kind !== "string" ||
      typeof feature.id !== "string" ||
      !feature.id.trim()
    ) {
      throw new Error(`Invalid feature entry at index ${index}.`);
    }

    if (!featureKinds.includes(feature.kind as (typeof featureKinds)[number])) {
      throw new Error(
        `Unknown feature kind at index ${index}: ${feature.kind}.`,
      );
    }

    if (typeof feature.hidden !== "boolean") {
      throw new Error(`Invalid feature hidden flag at index ${index}.`);
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

    return {
      id: feature.id,
      kind: feature.kind,
      q: feature.q,
      r: feature.r,
      hidden: feature.hidden,
      gmLabel: feature.gmLabel,
      playerLabel: feature.playerLabel,
      labelRevealed: feature.labelRevealed,
    };
  });

  const rivers = raw.rivers.map((river, index): MapRiverRecord => {
    if (
      !isObject(river) ||
      !isInteger(river.q) ||
      !isInteger(river.r) ||
      !isRiverEdgeIndex(river.edge)
    ) {
      throw new Error(`Invalid river entry at index ${index}.`);
    }

    return {
      q: river.q,
      r: river.r,
      edge: river.edge,
    };
  });

  const roads = raw.roads.map((road, index): MapRoadRecord => {
    if (
      !isObject(road) ||
      !isInteger(road.q) ||
      !isInteger(road.r) ||
      !Array.isArray(road.edges)
    ) {
      throw new Error(`Invalid road entry at index ${index}.`);
    }

    const edges = road.edges.filter((edge): edge is RoadEdgeIndex =>
      isRoadEdgeIndex(edge),
    );

    if (edges.length !== road.edges.length) {
      throw new Error(`Invalid road edges at index ${index}.`);
    }

    return {
      q: road.q,
      r: road.r,
      edges: Array.from(new Set(edges)).sort((left, right) => left - right),
    };
  });

  const factions = raw.factions.map((faction, index): MapFactionRecord => {
    if (
      !isObject(faction) ||
      typeof faction.id !== "string" ||
      typeof faction.name !== "string" ||
      typeof faction.color !== "string"
    ) {
      throw new Error(`Invalid faction entry at index ${index}.`);
    }

    if (!faction.id.trim() || !faction.name.trim() || !faction.color.trim()) {
      throw new Error(`Invalid faction values at index ${index}.`);
    }

    if (!isHexColor(faction.color)) {
      throw new Error(
        `Invalid faction color '${faction.color}' at index ${index}.`,
      );
    }

    return {
      id: faction.id,
      name: faction.name,
      color: faction.color,
    };
  });

  const factionTerritories = raw.factionTerritories.map(
    (territory, index): MapFactionTerritoryRecord => {
      if (
        !isObject(territory) ||
        !isInteger(territory.q) ||
        !isInteger(territory.r) ||
        typeof territory.factionId !== "string"
      ) {
        throw new Error(`Invalid faction territory entry at index ${index}.`);
      }

      return {
        q: territory.q,
        r: territory.r,
        factionId: territory.factionId,
      };
    },
  );

  return {
    version: mapFileVersion,
    tiles,
    features,
    rivers,
    roads,
    factions,
    factionTerritories,
  };
}

export function parseMapDocumentText(text: string): MapDocument {
  return parseMapDocument(JSON.parse(text) as unknown);
}
