import { WebSocket } from "ws";
import {
  listDiskMapSummaries,
  readDiskMap
} from "./mapStorage.js";
import type {
  MapRecord,
  MapSession,
  MapSummary
} from "./types.js";

const mapSessions = new Map<string, MapSession>();

function toMapSummary(map: MapRecord): MapSummary {
  return {
    id: map.id,
    name: map.name,
    updatedAt: map.updatedAt
  };
}

export async function listMaps(): Promise<MapSummary[]> {
  const summariesById = new Map<string, MapSummary>();

  for (const summary of await listDiskMapSummaries()) {
    summariesById.set(summary.id, summary);
  }

  for (const session of mapSessions.values()) {
    summariesById.set(session.map.id, toMapSummary(session.map));
  }

  const summaries = Array.from(summariesById.values());
  summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return summaries;
}

export async function getMap(mapId: string): Promise<MapRecord | null> {
  const session = mapSessions.get(mapId);

  if (session) {
    return session.map;
  }

  return readDiskMap(mapId);
}

export async function getOrCreateSession(mapId: string): Promise<MapSession | null> {
  const existing = mapSessions.get(mapId);

  if (existing) {
    return existing;
  }

  const map = await getMap(mapId);

  if (!map) {
    return null;
  }

  const session: MapSession = {
    map,
    clients: new Set<WebSocket>(),
    persistTimer: null,
    appliedOperationPayloads: new Map<string, string>(),
    appliedOperationOrder: [],
    nextSequence: 1
  };
  mapSessions.set(mapId, session);
  return session;
}
