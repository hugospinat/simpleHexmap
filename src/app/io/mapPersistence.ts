import { hexKey, parseHexKey } from "@/domain/geometry/hex";
import {
  addFaction,
  addFeature,
  addRiverEdge,
  addTile,
  assignFactionAt,
  createEmptyWorld,
  featureKinds,
  getFactionLevelMap,
  getFactions,
  getCanonicalRiverEdgeRef,
  terrainTypes,
  type RiverEdgeIndex,
  type TerrainType,
  type World
} from "@/domain/world/world";

const sourceLevel = 3;
const mapFileVersion = 1;

type MapTileRecord = {
  q: number;
  r: number;
  tileId: string;
};

type MapFeatureRecord = {
  type: string;
  q: number;
  r: number;
  visibility: "visible" | "hidden";
  overrideTerrainTile: boolean;
  gmLabel: string | null;
  playerLabel: string | null;
  labelRevealed: boolean;
};

type MapRiverRecord = {
  q: number;
  r: number;
  edge: RiverEdgeIndex;
};

type MapFactionRecord = {
  id: string;
  name: string;
  color: string;
};

type MapFactionTerritoryRecord = {
  q: number;
  r: number;
  factionId: string;
};

type SavedMap = {
  version: number;
  tiles: MapTileRecord[];
  features: MapFeatureRecord[];
  rivers: MapRiverRecord[];
  factions: MapFactionRecord[];
  factionTerritories: MapFactionTerritoryRecord[];
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

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function serializeTiles(world: World): MapTileRecord[] {
  const levelMap = world.levels[sourceLevel] ?? new Map();

  return Array.from(levelMap.entries())
    .map(([hexId, cell]) => {
      const axial = parseHexKey(hexId);

      return {
        q: axial.q,
        r: axial.r,
        tileId: cell.type
      };
    })
    .sort((left, right) => (left.q - right.q) || (left.r - right.r) || left.tileId.localeCompare(right.tileId));
}

function serializeFeatures(world: World): MapFeatureRecord[] {
  const featureMap = world.featuresByLevel[sourceLevel] ?? new Map();

  return Array.from(featureMap.values())
    .map((feature) => {
      const axial = parseHexKey(feature.hexId);

      return {
        type: feature.kind,
        q: axial.q,
        r: axial.r,
        visibility: feature.hidden ? "hidden" as const : "visible" as const,
        overrideTerrainTile: feature.overrideTerrainTile,
        gmLabel: feature.gmLabel ?? null,
        playerLabel: feature.playerLabel ?? null,
        labelRevealed: feature.labelRevealed ?? false
      };
    })
    .sort((left, right) => (left.q - right.q) || (left.r - right.r) || left.type.localeCompare(right.type));
}

function serializeRivers(world: World): MapRiverRecord[] {
  const riverMap = world.riversByLevel[sourceLevel] ?? new Map();
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

function serializeFactions(world: World): MapFactionRecord[] {
  return getFactions(world).map((faction) => ({
    id: faction.id,
    name: faction.name,
    color: faction.color
  }));
}

function serializeFactionTerritories(world: World): MapFactionTerritoryRecord[] {
  const assignments = getFactionLevelMap(world, sourceLevel);

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

function downloadJson(filename: string, jsonText: string): void {
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read map file."));
    reader.readAsText(file);
  });
}

function parseSavedMap(raw: unknown): SavedMap {
  if (!isObject(raw)) {
    throw new Error("Invalid map file format.");
  }

  if (raw.version !== mapFileVersion) {
    throw new Error(`Unsupported map version: ${String(raw.version)}.`);
  }

  if (!Array.isArray(raw.tiles) || !Array.isArray(raw.features) || !Array.isArray(raw.rivers)) {
    throw new Error("Map file is missing required arrays.");
  }

  const rawFactions = Array.isArray(raw.factions) ? raw.factions : [];
  const rawFactionTerritories = Array.isArray(raw.factionTerritories) ? raw.factionTerritories : [];

  const tiles = raw.tiles.map((tile, index): MapTileRecord => {
    if (!isObject(tile) || !isInteger(tile.q) || !isInteger(tile.r) || typeof tile.tileId !== "string") {
      throw new Error(`Invalid tile entry at index ${index}.`);
    }

    if (!terrainTypes.includes(tile.tileId as TerrainType)) {
      throw new Error(`Unknown tileId at index ${index}: ${tile.tileId}.`);
    }

    return {
      q: tile.q,
      r: tile.r,
      tileId: tile.tileId
    };
  });

  const features = raw.features.map((feature, index): MapFeatureRecord => {
    if (!isObject(feature) || !isInteger(feature.q) || !isInteger(feature.r) || typeof feature.type !== "string") {
      throw new Error(`Invalid feature entry at index ${index}.`);
    }

    if (!featureKinds.includes(feature.type as (typeof featureKinds)[number])) {
      throw new Error(`Unknown feature type at index ${index}: ${feature.type}.`);
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

    return {
      type: feature.type,
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

  const factions = rawFactions.map((faction, index): MapFactionRecord => {
    if (!isObject(faction) || typeof faction.id !== "string" || typeof faction.name !== "string" || typeof faction.color !== "string") {
      throw new Error(`Invalid faction entry at index ${index}.`);
    }

    if (!faction.id.trim() || !faction.name.trim() || !faction.color.trim()) {
      throw new Error(`Invalid faction values at index ${index}.`);
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
    factions,
    factionTerritories
  };
}

function buildWorldFromSavedMap(savedMap: SavedMap): World {
  let world = createEmptyWorld();

  for (const tile of savedMap.tiles) {
    world = addTile(world, sourceLevel, { q: tile.q, r: tile.r }, tile.tileId as TerrainType);
  }

  for (const faction of savedMap.factions) {
    world = addFaction(world, faction);
  }

  for (let index = 0; index < savedMap.features.length; index += 1) {
    const feature = savedMap.features[index];

    world = addFeature(world, sourceLevel, {
      id: `loaded-feature-${index}-${feature.q}-${feature.r}`,
      kind: feature.type as (typeof featureKinds)[number],
      hexId: hexKey({ q: feature.q, r: feature.r }),
      hidden: feature.visibility === "hidden",
      overrideTerrainTile: feature.overrideTerrainTile,
      gmLabel: feature.gmLabel ?? undefined,
      playerLabel: feature.playerLabel ?? undefined,
      labelRevealed: feature.labelRevealed
    });
  }

  for (const river of savedMap.rivers) {
    world = addRiverEdge(world, sourceLevel, {
      axial: { q: river.q, r: river.r },
      edge: river.edge
    });
  }

  for (const territory of savedMap.factionTerritories) {
    world = assignFactionAt(world, sourceLevel, { q: territory.q, r: territory.r }, territory.factionId);
  }

  return world;
}

export function saveMap(mapState: World): void {
  const payload: SavedMap = {
    version: mapFileVersion,
    tiles: serializeTiles(mapState),
    features: serializeFeatures(mapState),
    rivers: serializeRivers(mapState),
    factions: serializeFactions(mapState),
    factionTerritories: serializeFactionTerritories(mapState)
  };

  downloadJson("map.json", `${JSON.stringify(payload, null, 2)}\n`);
}

export async function loadMap(file: File): Promise<World> {
  const text = await readFileAsText(file);
  const raw = JSON.parse(text) as unknown;
  const parsed = parseSavedMap(raw);

  return buildWorldFromSavedMap(parsed);
}

export type {
  SavedMap,
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapTileRecord
};
