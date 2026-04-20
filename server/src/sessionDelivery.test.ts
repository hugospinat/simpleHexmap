import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { broadcastRoleAwareSessionPayloads } from "./sessionDelivery.js";
import type { MapSession } from "./types.js";

function createClient(readyState = WebSocket.OPEN) {
  return {
    close: vi.fn(),
    readyState,
    send: vi.fn(),
  };
}

describe("sessionDelivery", () => {
  it("sends raw payloads only to GM clients and resnapshots player clients", async () => {
    const gmClient = createClient();
    const playerClient = createClient();
    const sendSnapshot = vi.fn(async () => true);
    const session: MapSession = {
      clients: new Map([
        [
          gmClient as unknown as WebSocket,
          { userId: "gm-user", visibilityMode: "gm" },
        ],
        [
          playerClient as unknown as WebSocket,
          { userId: "player-user", visibilityMode: "player" },
        ],
      ]),
      mapId: "map-1",
    };

    await broadcastRoleAwareSessionPayloads(
      session,
      ['{"type":"map_operation_applied"}', '{"type":"map_token_updated"}'],
      sendSnapshot,
    );

    expect(gmClient.send).toHaveBeenCalledTimes(2);
    expect(gmClient.send).toHaveBeenNthCalledWith(
      1,
      '{"type":"map_operation_applied"}',
    );
    expect(gmClient.send).toHaveBeenNthCalledWith(
      2,
      '{"type":"map_token_updated"}',
    );
    expect(playerClient.send).not.toHaveBeenCalled();
    expect(sendSnapshot).toHaveBeenCalledTimes(1);
    expect(sendSnapshot).toHaveBeenCalledWith(
      playerClient as unknown as WebSocket,
      "map-1",
      "player-user",
    );
  });

  it("skips closed clients", async () => {
    const closedClient = createClient(WebSocket.CLOSED);
    const sendSnapshot = vi.fn(async () => true);
    const session: MapSession = {
      clients: new Map([
        [
          closedClient as unknown as WebSocket,
          { userId: "player-user", visibilityMode: "player" },
        ],
      ]),
      mapId: "map-1",
    };

    await broadcastRoleAwareSessionPayloads(
      session,
      ['{"type":"map_token_updated"}'],
      sendSnapshot,
    );

    expect(closedClient.send).not.toHaveBeenCalled();
    expect(sendSnapshot).not.toHaveBeenCalled();
  });
});
