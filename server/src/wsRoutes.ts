import { WebSocketServer } from "ws";
import { getVisibilityModeForMapRole } from "./repositories/mapVisibility.js";
import { getMapRecordForUser } from "./repositories/mapRepository.js";
import { getAuthContext } from "./services/authService.js";
import { serverLimits } from "./serverConfig.js";
import { getClientIp, isOriginAllowed } from "./security/requestSecurity.js";
import { MemoryRateLimiter } from "./security/rateLimiter.js";
import { getSession } from "./sessionStore.js";
import { attachClientHandlers } from "./ws/clientSession.js";
import {
  mapSocketPattern,
  rejectUpgrade,
  resolveWebSocketUpgradeRejection,
} from "./ws/upgradePolicy.js";

const wsUpgradeRateLimiter = new MemoryRateLimiter();

export { resolveWebSocketUpgradeRejection } from "./ws/upgradePolicy.js";

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

      const origin =
        typeof request.headers.origin === "string" ? request.headers.origin : null;

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
