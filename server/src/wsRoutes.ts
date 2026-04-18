import { WebSocket, WebSocketServer } from "ws";
import { isObject, mapIdPatternSource } from "./mapStorage.js";
import {
  applyOperationBatchToSession,
  applyOperationToSession,
  applyTokenOperationToSession
} from "./operationService.js";
import {
  getOrCreateSession,
  getSessionMapRecord
} from "./sessionStore.js";
import type { MapOperation, MapTokenOperation } from "../../src/core/protocol/index.js";

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

  const map = getSessionMapRecord(session);

  client.send(JSON.stringify({
    type: "sync_snapshot",
    lastSequence: session.nextSequence - 1,
    updatedAt: map.updatedAt,
    content: map.content
  }));
}

async function handleClientMessage(mapId, client, raw, profileId) {
  const message = JSON.parse(raw.toString("utf8"));

  if (
    isObject(message)
    && message.type === "map_token_update"
    && isObject(message.operation)
  ) {
    try {
      await applyTokenOperationToSession(mapId, message.operation as MapTokenOperation, profileId);
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

    await applyOperationBatchToSession(mapId, message.operations, message.clientId, client, profileId);
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

  await applyOperationToSession(mapId, message.operation as MapOperation, message.clientId, message.operationId, client, profileId);
}

function attachClientHandlers(mapId, session, client, profileId) {
  session.clients.add(client);
  sendSnapshot(client, session);

  client.on("close", () => {
    session.clients.delete(client);
  });

  client.on("message", async (raw) => {
    try {
      await handleClientMessage(mapId, client, raw, profileId);
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
      const profileId = url.searchParams.get("profileId");

      if (!profileId) {
        socket.destroy();
        return;
      }

      const session = await getOrCreateSession(mapId, profileId);

      if (!session) {
        socket.destroy();
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (client) => {
        attachClientHandlers(mapId, session, client, profileId);
      });
    } catch {
      socket.destroy();
    }
  });

  return webSocketServer;
}

