import { WebSocket } from "ws";
import type { MapSession } from "../../types.js";

type SendSnapshot = (
  client: WebSocket,
  mapId: string,
  userId: string,
) => Promise<boolean>;

export async function broadcastRoleAwareSessionPayloads(
  session: MapSession,
  gmPayloads: readonly string[],
  sendSnapshot: SendSnapshot,
): Promise<void> {
  const playerSnapshotUpdates: Promise<boolean>[] = [];

  for (const [client, sessionClient] of session.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    if (sessionClient.visibilityMode === "player") {
      playerSnapshotUpdates.push(
        sendSnapshot(client, session.mapId, sessionClient.userId),
      );
      continue;
    }

    for (const payload of gmPayloads) {
      client.send(payload);
    }
  }

  await Promise.all(playerSnapshotUpdates);
}
