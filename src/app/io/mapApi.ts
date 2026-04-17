import type { SavedMap } from "@/app/io/mapFormat";
import { parseSavedMap } from "@/app/io/mapFormat";

export type MapSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export type MapRecord = MapSummary & {
  content: SavedMap;
};

type CreateMapInput = {
  name: string;
  content?: SavedMap;
};

type SaveMapInput = {
  name?: string;
  content: SavedMap;
};

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = await response.json() as unknown;

  if (!response.ok) {
    const errorMessage = typeof payload === "object" && payload !== null && "error" in payload
      ? String((payload as { error: string }).error)
      : `Request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return payload;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMapSummary(raw: unknown): MapSummary {
  if (!isObject(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" || typeof raw.updatedAt !== "string") {
    throw new Error("Invalid map summary response.");
  }

  return {
    id: raw.id,
    name: raw.name,
    updatedAt: raw.updatedAt
  };
}

function parseMapRecord(raw: unknown): MapRecord {
  if (!isObject(raw) || typeof raw.id !== "string" || typeof raw.name !== "string" || typeof raw.updatedAt !== "string") {
    throw new Error("Invalid map response.");
  }

  return {
    id: raw.id,
    name: raw.name,
    updatedAt: raw.updatedAt,
    content: parseSavedMap(raw.content)
  };
}

export async function listMaps(): Promise<MapSummary[]> {
  const payload = await requestJson("/api/maps", { method: "GET" });

  if (!isObject(payload) || !Array.isArray(payload.maps)) {
    throw new Error("Invalid maps list response.");
  }

  return payload.maps.map(parseMapSummary);
}

export async function createMap(input: CreateMapInput): Promise<MapRecord> {
  const payload = await requestJson("/api/maps", {
    method: "POST",
    body: JSON.stringify(input)
  });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid create map response.");
  }

  return parseMapRecord(payload.map);
}

export async function loadMapById(mapId: string): Promise<MapRecord> {
  const payload = await requestJson(`/api/maps/${encodeURIComponent(mapId)}`, { method: "GET" });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid map load response.");
  }

  return parseMapRecord(payload.map);
}

export async function saveMapById(mapId: string, input: SaveMapInput): Promise<MapRecord> {
  const payload = await requestJson(`/api/maps/${encodeURIComponent(mapId)}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid map save response.");
  }

  return parseMapRecord(payload.map);
}
