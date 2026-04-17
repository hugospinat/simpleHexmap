import { WebSocket, WebSocketServer } from "ws";
import { isObject, mapIdPatternSource } from "./mapStorage.js";
import {
  applyOperationBatchToSession,
  applyOperationToSession
} from "./operationService.js";
import {
  getOrCreateSession
} from "./sessionStore.js";

const maxOperationsPerBatch = 500;
const mapSocketPattern = new RegExp(`^/api/maps/(${mapIdPatternSource})/ws$`);

function isValidOperationEnvelope(value) {
  return isObject(value)
    && typeof value.operationId === "string"
    && value.operationId.trim().length > 0
    && isObject(value.operation);
}

function sendSnapshot(client, session) {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }

  client.send(JSON.stringify({
    type: "sync_snapshot",
    lastSequence: session.nextSequence - 1,
    updatedAt: session.map.updatedAt,
    content: session.map.content
  }));
}

async function handleClientMessage(mapId, client, raw) {
  const message = JSON.parse(raw.toString("utf8"));

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

    await applyOperationBatchToSession(mapId, message.operations, message.clientId, client);
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

  await applyOperationToSession(mapId, message.operation, message.clientId, message.operationId, client);
}

function attachClientHandlers(mapId, session, client) {
  session.clients.add(client);
  sendSnapshot(client, session);

  client.on("close", () => {
    session.clients.delete(client);
  });

  client.on("message", async (raw) => {
    try {
      await handleClientMessage(mapId, client, raw);
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

      const mapId = match[1];
      const session = await getOrCreateSession(mapId);

      if (!session) {
        socket.destroy();
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (client) => {
        attachClientHandlers(mapId, session, client);
      });
    } catch {
      socket.destroy();
    }
  });

  return webSocketServer;
}

