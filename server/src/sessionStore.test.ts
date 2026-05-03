import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import {
  closeSession,
  getOrCreateSession,
  getSession,
  getSessionStoreMetrics,
  removeClientFromSession,
} from "./sessionStore.js";

function createClient() {
  return {
    close: vi.fn(),
    readyState: WebSocket.OPEN,
    send: vi.fn(),
  } as unknown as WebSocket;
}

describe("sessionStore", () => {
  it("removes empty sessions when the last client disconnects", () => {
    const mapId = "cleanup-map";
    const client = createClient();
    const session = getOrCreateSession(mapId);
    session.clients.set(client, { userId: "user-1", visibilityMode: "gm" });

    removeClientFromSession(mapId, client);

    expect(getSession(mapId)).toBeNull();
  });

  it("reports aggregate active session and client counts", () => {
    const firstMapId = "metrics-map-1";
    const secondMapId = "metrics-map-2";
    const firstClient = createClient();
    const secondClient = createClient();
    const thirdClient = createClient();

    getOrCreateSession(firstMapId).clients.set(firstClient, {
      userId: "user-1",
      visibilityMode: "gm",
    });
    getOrCreateSession(firstMapId).clients.set(secondClient, {
      userId: "user-2",
      visibilityMode: "player",
    });
    getOrCreateSession(secondMapId).clients.set(thirdClient, {
      userId: "user-3",
      visibilityMode: "player",
    });

    expect(getSessionStoreMetrics()).toEqual({
      activeSessions: 2,
      activeClients: 3,
    });

    closeSession(firstMapId);
    closeSession(secondMapId);
  });
});
