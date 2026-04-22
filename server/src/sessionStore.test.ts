import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import {
  getOrCreateSession,
  getSession,
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
});
