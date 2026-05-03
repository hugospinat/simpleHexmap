import { WebSocket } from "ws";
import { MemoryRateLimiter } from "./security/rateLimiter.js";
import type { MapSession } from "./types.js";

const sessionsByMapId = new Map<string, MapSession>();

export type SessionStoreMetrics = {
  activeSessions: number;
  activeClients: number;
};

export function getOrCreateSession(mapId: string): MapSession {
  const existing = sessionsByMapId.get(mapId);

  if (existing) {
    return existing;
  }

  const session: MapSession = {
    mapId,
    clients: new Map(),
    operationRateLimiter: new MemoryRateLimiter(),
  };
  sessionsByMapId.set(mapId, session);
  return session;
}

export function getSession(mapId: string): MapSession | null {
  return sessionsByMapId.get(mapId) ?? null;
}

export function getSessionStoreMetrics(): SessionStoreMetrics {
  let activeClients = 0;

  for (const session of sessionsByMapId.values()) {
    activeClients += session.clients.size;
  }

  return {
    activeSessions: sessionsByMapId.size,
    activeClients,
  };
}

export function removeClientFromSession(mapId: string, client: WebSocket): void {
  const session = sessionsByMapId.get(mapId);

  if (!session) {
    return;
  }

  session.clients.delete(client);

  if (session.clients.size === 0) {
    sessionsByMapId.delete(mapId);
  }
}

export function closeSession(mapId: string): void {
  const session = sessionsByMapId.get(mapId);

  if (!session) {
    return;
  }

  for (const client of session.clients.keys()) {
    if (
      client.readyState === WebSocket.OPEN ||
      client.readyState === WebSocket.CONNECTING
    ) {
      client.close(1000, "map_deleted");
    }
  }

  session.clients.clear();
  sessionsByMapId.delete(mapId);
}
