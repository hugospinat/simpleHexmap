import { WebSocket } from "ws";
import type { MapSession } from "./types.js";

const sessionsByMapId = new Map<string, MapSession>();

export function getOrCreateSession(mapId: string): MapSession {
  const existing = sessionsByMapId.get(mapId);

  if (existing) {
    return existing;
  }

  const session: MapSession = {
    workspaceId: mapId,
    clients: new Set<WebSocket>()
  };
  sessionsByMapId.set(mapId, session);
  return session;
}

export function getSession(mapId: string): MapSession | null {
  return sessionsByMapId.get(mapId) ?? null;
}

export function closeSession(mapId: string): void {
  const session = sessionsByMapId.get(mapId);

  if (!session) {
    return;
  }

  for (const client of session.clients) {
    if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
      client.close(1000, "map_deleted");
    }
  }

  session.clients.clear();
  sessionsByMapId.delete(mapId);
}
