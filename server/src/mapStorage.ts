import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const mapIdPatternSource = "[a-zA-Z0-9_-]{1,64}";

const mapsDir = path.resolve(process.cwd(), "data/maps");
const mapIdPattern = new RegExp(`^${mapIdPatternSource}$`);

export const defaultMapContent = {
  version: 1,
  tiles: [{ q: 0, r: 0, terrain: "plain", hidden: false }],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: []
};

export function isObject(value) {
  return typeof value === "object" && value !== null;
}

export function sanitizeName(value) {
  if (typeof value !== "string") {
    return "Untitled map";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : "Untitled map";
}

export function isValidMapContent(value) {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.version === "number"
    && Array.isArray(value.tiles)
    && Array.isArray(value.features)
    && Array.isArray(value.rivers)
    && Array.isArray(value.factions)
    && Array.isArray(value.factionTerritories)
  );
}

export function normalizeMapContent(content) {
  const roads = Array.isArray(content.roads) ? content.roads : [];

  return {
    version: content.version,
    tiles: Array.isArray(content.tiles)
      ? content.tiles.map((tile) => {
          const terrain = typeof tile.terrain === "string" ? tile.terrain : tile.tileId;

          return {
            ...tile,
            terrain,
            hidden: typeof tile.hidden === "boolean" ? tile.hidden : false
          };
        })
      : [],
    features: Array.isArray(content.features)
      ? content.features.map((feature, index) => ({
          ...feature,
          kind: typeof feature.kind === "string" ? feature.kind : feature.type,
          id: typeof feature.id === "string" && feature.id.trim()
            ? feature.id
            : `loaded-feature-${index}-${feature.q}-${feature.r}`
        }))
      : [],
    rivers: Array.isArray(content.rivers) ? content.rivers : [],
    roads,
    factions: Array.isArray(content.factions) ? content.factions : [],
    factionTerritories: Array.isArray(content.factionTerritories) ? content.factionTerritories : []
  };
}

export function mapPathFromId(mapId) {
  if (!mapIdPattern.test(mapId)) {
    return null;
  }

  return path.join(mapsDir, `${mapId}.json`);
}

export function nowIso() {
  return new Date().toISOString();
}

export function createMapId() {
  return randomUUID();
}

export function createOperationId() {
  return `op-${randomUUID()}`;
}

export async function ensureStorage() {
  await fs.mkdir(mapsDir, { recursive: true });
}

export async function readMapFromFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(text);

  if (!isObject(parsed) || typeof parsed.id !== "string" || typeof parsed.name !== "string" || typeof parsed.updatedAt !== "string" || !isValidMapContent(parsed.content)) {
    throw new Error("Invalid map file format.");
  }

  return {
    id: parsed.id,
    name: parsed.name,
    updatedAt: parsed.updatedAt,
    content: normalizeMapContent(parsed.content)
  };
}

export async function readDiskMap(mapId) {
  const filePath = mapPathFromId(mapId);

  if (!filePath) {
    return null;
  }

  try {
    return await readMapFromFile(filePath);
  } catch {
    return null;
  }
}

export async function writeMapToFile(mapRecord) {
  const filePath = mapPathFromId(mapRecord.id);

  if (!filePath) {
    throw new Error("Invalid map id.");
  }

  await ensureStorage();

  const payload = `${JSON.stringify(mapRecord, null, 2)}\n`;
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await fs.writeFile(tempPath, payload, "utf8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

export async function listDiskMapSummaries() {
  await ensureStorage();

  const entries = await fs.readdir(mapsDir, { withFileTypes: true });
  const summaries = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const fullPath = path.join(mapsDir, entry.name);

    try {
      const map = await readMapFromFile(fullPath);
      summaries.push({ id: map.id, name: map.name, updatedAt: map.updatedAt });
    } catch {
      // Ignore malformed files.
    }
  }

  return summaries;
}

