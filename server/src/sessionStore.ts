import { WebSocket } from "ws";
import {
  deleteMapFile,
  listDiskMapSummaries,
  readDiskMap
} from "./mapStorage.js";
import {
  createMapDocumentRuntime,
  materializeRuntimeContent
} from "./mapDocumentRuntime.js";
import type {
  MapRecord,
  MapSession,
  MapSummary
} from "./types.js";

const sessionsByMapId = new Map<string, MapSession>();

function toMapSummary(map: MapRecord): MapSummary {
  return {
    id: map.id,
    name: map.name,
    permissions: map.permissions,
    updatedAt: map.updatedAt
  };
}

export function getSessionMapRecord(session: MapSession): MapRecord {
  return {
    ...session.map,
    content: materializeRuntimeContent(session.runtime)
  };
}

export async function listMaps(): Promise<MapSummary[]> {
  const summariesById = new Map<string, MapSummary>();

  for (const summary of await listDiskMapSummaries()) {
    summariesById.set(summary.id, summary);
  }

  for (const session of sessionsByMapId.values()) {
    summariesById.set(session.map.id, toMapSummary(session.map));
  }

  const summaries = Array.from(summariesById.values());
  summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return summaries;
}

export async function getMap(mapId: string, fallbackOwnerProfileId?: string): Promise<MapRecord | null> {
  const session = sessionsByMapId.get(mapId);

  if (session) {
    return getSessionMapRecord(session);
  }

  return readDiskMap(mapId, fallbackOwnerProfileId);
}

export async function getOrCreateSession(mapId: string, fallbackOwnerProfileId?: string): Promise<MapSession | null> {
  const existing = sessionsByMapId.get(mapId);

  if (existing) {
    return existing;
  }

  const map = await getMap(mapId, fallbackOwnerProfileId);

  if (!map) {
    return null;
  }

  const session: MapSession = {
    map,
    runtime: createMapDocumentRuntime(map),
    clients: new Set<WebSocket>(),
    persistTimer: null,
    appliedOperationPayloads: new Map<string, string>(),
    appliedOperationOrder: [],
    nextSequence: 1
  };
  sessionsByMapId.set(mapId, session);
  return session;
}

export async function deleteMap(mapId: string): Promise<boolean> {
  const session = sessionsByMapId.get(mapId);

  if (session) {
    if (session.persistTimer) {
      clearTimeout(session.persistTimer);
      session.persistTimer = null;
    }

    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close(1000, "map_deleted");
      }
    }

    session.clients.clear();
    sessionsByMapId.delete(mapId);
  }

  const deletedFile = await deleteMapFile(mapId);
  return Boolean(session) || deletedFile;
}
