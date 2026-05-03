import { WebSocket } from "ws";
import { sendSyncSnapshot } from "../syncSnapshotService.js";
import {
  getOrCreateSession,
  removeClientFromSession,
} from "../sessionStore.js";
import { handleClientMessage } from "./messageHandler.js";

export async function attachClientHandlers(
  mapId: string,
  client: WebSocket,
  userId: string,
  visibilityMode: "gm" | "player",
): Promise<void> {
  const session = getOrCreateSession(mapId);
  session.clients.set(client, { userId, visibilityMode });
  await sendSyncSnapshot(client, mapId, userId);

  client.on("close", () => {
    removeClientFromSession(mapId, client);
  });

  client.on("message", async (raw) => {
    try {
      await handleClientMessage(mapId, client, raw, userId);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Invalid map operation.";
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "sync_error", error: detail }));
      }
    }
  });
}
