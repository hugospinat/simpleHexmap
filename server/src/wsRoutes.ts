import type { Socket } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import { applyOperationToSession } from "./operationService.js";
import { applyTokenOperationToSession } from "./tokenOperationService.js";
import {
  getOrCreateSession,
  getSession,
  removeClientFromSession,
} from "./sessionStore.js";
import { getVisibilityModeForMapRole } from "./repositories/mapVisibility.js";
import { getMapRecordForUser } from "./repositories/mapRepository.js";
import { getAuthContext } from "./services/authService.js";
import { sendSyncSnapshot } from "./syncSnapshotService.js";
import { serverLimits } from "./serverConfig.js";
import { getClientIp, isOriginAllowed } from "./security/requestSecurity.js";
import { MemoryRateLimiter } from "./security/rateLimiter.js";
import type {
  MapOperation,
  MapTokenOperation,
} from "../../src/core/protocol/index.js";
import {
  wsMapOperationMessageSchema,
  wsTokenUpdateMessageSchema,
} from "./validation/httpSchemas.js";

const idPatternSource = "[a-zA-Z0-9_-]{1,80}";
const mapSocketPattern = new RegExp(`^/api/maps/(${idPatternSource})/ws$`);
const wsUpgradeRateLimiter = new MemoryRateLimiter();

type UpgradeRejection = {
  reason: string;
  statusCode: number;
};

export function resolveWebSocketUpgradeRejection(input: {
  currentConnections: number;
  currentMapConnections: number;
  maxConnections: number;
  maxConnectionsPerMap: number;
}): UpgradeRejection | null {
  if (input.currentConnections >= input.maxConnections) {
    return {
      reason: "Server is at WebSocket capacity.",
      statusCode: 503,
    };
  }

  if (input.currentMapConnections >= input.maxConnectionsPerMap) {
    return {
      reason: "Map is at WebSocket capacity.",
      statusCode: 503,
    };
  }

  return null;
}

function rejectUpgrade(
  socket: Socket,
  statusCode: number,
  reason: string,
): void {
  if (socket.writable) {
    const body = `${reason}\n`;
    socket.write(
      `HTTP/1.1 ${statusCode} ${reason}\r\n` +
        "Connection: close\r\n" +
        "Content-Type: text/plain; charset=utf-8\r\n" +
        `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n` +
        body,
    );
  }

  socket.destroy();
}

async function handleClientMessage(
  mapId: string,
  client: WebSocket,
  raw,
  userId: string,
) {
  const message = JSON.parse(raw.toString("utf8"));

  const tokenResult = wsTokenUpdateMessageSchema.safeParse(message);

  if (tokenResult.success) {
    try {
      await applyTokenOperationToSession(
        mapId,
        tokenResult.data.operation as MapTokenOperation,
        userId,
      );
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Invalid token operation.";

      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "map_token_error", error: detail }));
      }
    }
    return;
  }

  const opResult = wsMapOperationMessageSchema.safeParse(message);

  if (!opResult.success) {
    console.warn("[MapSyncServer] invalid_operation_message", {
      mapId,
      raw: raw.toString("utf8"),
    });
    return;
  }

  await applyOperationToSession(
    mapId,
    opResult.data.operation as MapOperation,
    opResult.data.clientId,
    opResult.data.operationId,
    client,
    userId,
    {
      includeMapRecord: false,
    },
  );
}

async function attachClientHandlers(
  mapId: string,
  client: WebSocket,
  userId: string,
  visibilityMode: "gm" | "player",
) {
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

export function attachWebSocketRoutes(server) {
  const webSocketServer = new WebSocketServer({
    maxPayload: serverLimits.maxWebSocketPayloadBytes,
    noServer: true,
  });

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

      const origin = typeof request.headers.origin === "string"
        ? request.headers.origin
        : null;

      if (!origin || !isOriginAllowed(request, origin)) {
        console.warn("[ws] origin_denied", {
          ip: getClientIp(request),
          origin,
        });
        rejectUpgrade(socket, 403, "Request origin denied.");
        return;
      }

      const rateLimitResult = wsUpgradeRateLimiter.consume(
        `ws:${getClientIp(request)}`,
        serverLimits.wsUpgradeRateLimitMaxAttempts,
        serverLimits.wsUpgradeRateLimitWindowMs,
      );

      if (!rateLimitResult.allowed) {
        console.warn("[ws] upgrade_rate_limited", {
          ip: getClientIp(request),
          retryAfterMs: rateLimitResult.retryAfterMs,
        });
        rejectUpgrade(socket, 429, "Too many requests.");
        return;
      }

      const auth = await getAuthContext(request);

      if (!auth) {
        socket.destroy();
        return;
      }

      const mapId = match[1];
      const rejection = resolveWebSocketUpgradeRejection({
        currentConnections: webSocketServer.clients.size,
        currentMapConnections: getSession(mapId)?.clients.size ?? 0,
        maxConnections: serverLimits.maxWebSocketConnections,
        maxConnectionsPerMap: serverLimits.maxWebSocketConnectionsPerMap,
      });

      if (rejection) {
        rejectUpgrade(socket, rejection.statusCode, rejection.reason);
        return;
      }

      const map = await getMapRecordForUser(mapId, auth.user.id);

      if (!map) {
        socket.destroy();
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (client) => {
        void attachClientHandlers(
          mapId,
          client,
          auth.user.id,
          getVisibilityModeForMapRole(map),
        );
      });
    } catch {
      socket.destroy();
    }
  });

  return webSocketServer;
}
