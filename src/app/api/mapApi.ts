import type { MapOperation } from "@/app/document/mapOperations";
import type { SavedMapContent } from "@/app/document/savedMapTypes";
import { parseSavedMapContent } from "@/app/document/savedMapCodec";
import { buildApiUrl } from "@/app/api/apiBase";

export type MapSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export type MapRecord = MapSummary & {
  content: SavedMapContent;
};

type CreateMapInput = {
  name: string;
  content?: SavedMapContent;
};

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(buildApiUrl(path), {
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
    content: parseSavedMapContent(raw.content)
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

export async function renameMapById(mapId: string, name: string): Promise<MapRecord> {
  const payload = await requestJson(`/api/maps/${encodeURIComponent(mapId)}`, {
    method: "PATCH",
    body: JSON.stringify({ name })
  });

  if (!isObject(payload) || !("map" in payload)) {
    throw new Error("Invalid map rename response.");
  }

  return parseMapRecord(payload.map);
}

export type MapOperationMessage = {
  type: "map_operation_applied";
  sequence: number;
  operationId: string;
  operation: MapOperation;
  sourceClientId: string;
  updatedAt: string;
};

export type MapAppliedOperationEntry = Omit<MapOperationMessage, "type">;

export type MapOperationBatchAppliedMessage = {
  type: "map_operation_batch_applied";
  operations: MapAppliedOperationEntry[];
  updatedAt: string;
};

export type MapSyncSnapshotMessage = {
  type: "sync_snapshot";
  lastSequence: number;
  updatedAt: string;
  content: SavedMapContent;
};

export type MapOperationRequest = {
  type: "map_operation";
  operationId: string;
  operation: MapOperation;
  clientId: string;
};

export type MapOperationBatchItem = {
  operationId: string;
  operation: MapOperation;
};

export type MapOperationBatchRequest = {
  type: "map_operation_batch";
  clientId: string;
  operations: MapOperationBatchItem[];
};
