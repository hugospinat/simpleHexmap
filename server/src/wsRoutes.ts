import { WebSocket, WebSocketServer } from "ws";
import {
  applyOperationBatchToSession,
  applyOperationToSession,
  applyTokenOperationToSession
} from "./operationService.js";
import { getOrCreateSession } from "./sessionStore.js";
import { getMapRecordForUser } from "./repositories/workspaceRepository.js";
import { getAuthContext } from "./services/authService.js";
import type { MapOperation, MapTokenOperation } from "../../src/core/protocol/index.js";

const maxOperationsPerBatch = 500;
const idPatternSource = "[a-zA-Z0-9_-]{1,80}";
const mapSocketPattern = new RegExp(`^/api/maps/(${idPatternSource})/ws$`);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidOperationEnvelope(value) {
  return isObject(value)
    && typeof value.operationId === "string"
    && value.operationId.trim().length > 0
    && isObject(value.operation);
}

async function sendSnapshot(client, mapId: string, userId: string): Promise<void> {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }

  const map = await getMapRecordForUser(mapId, userId);

  if (!map) {
    client.close(1008, "map_not_found");
    return;
  }

  client.send(JSON.stringify({
    type: "sync_snapshot",
    lastSequence: map.nextSequence - 1,
    updatedAt: map.updatedAt,
    content: map.content
  }));
}

async function handleClientMessage(mapId: string, client: WebSocket, raw, userId: string) {
  const message = JSON.parse(raw.toString("utf8"));

  if (
    isObject(message)
    && message.type === "map_token_update"
    && isObject(message.operation)
  ) {
    try {
      await applyTokenOperationToSession(mapId, message.operation as MapTokenOperation, userId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid token operation.";

      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "map_token_error", error: detail }));
      }
    }
    return;
  }

  if (
    isObject(message)
    && message.type === "map_operation_batch"
    && typeof message.clientId === "string"
    && Array.isArray(message.operations)
  ) {
    if (message.operations.length === 0 || message.operations.length > maxOperationsPerBatch) {
      console.warn("[MapSyncServer] invalid_operation_batch_size", {
        mapId,
        operations: message.operations.length
      });
      return;
    }

    if (!message.operations.every(isValidOperationEnvelope)) {
      console.warn("[MapSyncServer] invalid_operation_batch_payload", {
        mapId,
        raw: raw.toString("utf8")
      });
      return;
    }

    await applyOperationBatchToSession(mapId, message.operations, message.clientId, client, userId);
    return;
  }

  if (
    !isObject(message)
    || message.type !== "map_operation"
    || !isObject(message.operation)
    || typeof message.clientId !== "string"
    || typeof message.operationId !== "string"
    || !message.operationId.trim()
  ) {
    console.warn("[MapSyncServer] invalid_operation_message", {
      mapId,
      raw: raw.toString("utf8")
    });
    return;
  }

  await applyOperationToSession(mapId, message.operation as MapOperation, message.clientId, message.operationId, client, userId);
}

async function attachClientHandlers(mapId: string, client: WebSocket, userId: string) {
  const session = getOrCreateSession(mapId);
  session.clients.add(client);
  await sendSnapshot(client, mapId, userId);

  client.on("close", () => {
    session.clients.delete(client);
  });

  client.on("message", async (raw) => {
    try {
      await handleClientMessage(mapId, client, raw, userId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Invalid map operation.";
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "sync_error", error: detail }));
      }
    }
  });
}

export function attachWebSocketRoutes(server) {
  const webSocketServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    try {
      if (!request.url) {
        socket.destroy();
        return;
      }

      const url = new URL(request.url, "http://localhost");
      const match = url.pathname.match(mapSocketPattern);

      if (!match) {
        socket.destroy();
        return;
      }

      const auth = await getAuthContext(request);

      if (!auth) {
        socket.destroy();
        return;
      }

      const mapId = match[1];
      const map = await getMapRecordForUser(mapId, auth.user.id);

      if (!map) {
        socket.destroy();
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (client) => {
        void attachClientHandlers(mapId, client, auth.user.id);
      });
    } catch {
      socket.destroy();
    }
  });

  return webSocketServer;
}
