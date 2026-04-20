import { WebSocket } from "ws";
import type { MapSession } from "./types.js";

export function broadcastPayload(session: MapSession, payload: string): void {
  for (const client of session.clients.keys()) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(payload);
  }
}
