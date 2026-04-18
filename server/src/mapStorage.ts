import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseSavedMapContent } from "../../src/core/document/savedMapCodec.js";
import { normalizeMapPermissions, type MapPermissions } from "../../src/core/profile/profileTypes.js";

export const mapIdPatternSource = "[a-zA-Z0-9_-]{1,64}";

const mapsDir = path.resolve(process.cwd(), "data/maps");
const mapIdPattern = new RegExp(`^${mapIdPatternSource}$`);
const legacyOwnerProfileId = "legacy-owner";

export const defaultMapContent = {
  version: 1,
  tiles: [{ q: 0, r: 0, terrain: "plain", hidden: true }],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: [],
  tokens: []
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sanitizeName(value) {
  if (typeof value !== "string") {
    return "Untitled map";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : "Untitled map";
}

export function normalizeMapContent(content) {
  return parseSavedMapContent(content);
}

export function createDefaultMapPermissions(ownerProfileId: string): MapPermissions {
  return {
    ownerProfileId,
    gmProfileIds: []
  };
}

export function normalizeMapPermissionsFromInput(input: unknown, fallbackOwnerProfileId = legacyOwnerProfileId): MapPermissions {
  if (!isObject(input) || typeof input.ownerProfileId !== "string" || !input.ownerProfileId.trim()) {
    return createDefaultMapPermissions(fallbackOwnerProfileId);
  }

  return normalizeMapPermissions({
    ownerProfileId: input.ownerProfileId,
    gmProfileIds: Array.isArray(input.gmProfileIds)
      ? input.gmProfileIds.filter((profileId): profileId is string => typeof profileId === "string" && profileId.trim().length > 0)
      : []
  });
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

export async function readMapFromFile(filePath, fallbackOwnerProfileId = legacyOwnerProfileId) {
  const text = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(text);

  if (!isObject(parsed) || typeof parsed.id !== "string" || typeof parsed.name !== "string" || typeof parsed.updatedAt !== "string") {
    throw new Error("Invalid map file format.");
  }

  return {
    id: parsed.id,
    name: parsed.name,
    updatedAt: parsed.updatedAt,
    permissions: normalizeMapPermissionsFromInput(parsed.permissions, fallbackOwnerProfileId),
    content: normalizeMapContent(parsed.content)
  };
}

export async function readDiskMap(mapId, fallbackOwnerProfileId = legacyOwnerProfileId) {
  const filePath = mapPathFromId(mapId);

  if (!filePath) {
    return null;
  }

  try {
    return await readMapFromFile(filePath, fallbackOwnerProfileId);
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

export async function deleteMapFile(mapId) {
  const filePath = mapPathFromId(mapId);

  if (!filePath) {
    throw new Error("Invalid map id.");
  }

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }

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
      summaries.push({ id: map.id, name: map.name, permissions: map.permissions, updatedAt: map.updatedAt });
    } catch {
      // Ignore malformed files.
    }
  }

  return summaries;
}

