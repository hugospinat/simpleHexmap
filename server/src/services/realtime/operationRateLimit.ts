import { WebSocket } from "ws";
import { serverLimits } from "../../serverConfig.js";
import type { MapSession } from "../../types.js";

export function consumeSessionOperationAllowance(
  session: MapSession,
  userId: string,
): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  return session.operationRateLimiter.consume(
    userId,
    serverLimits.wsOperationRateLimitMaxAttempts,
    serverLimits.wsOperationRateLimitWindowMs,
  );
}

export function sendRateLimitedOperationError(
  client: WebSocket,
  type: "map_token_error" | "sync_error",
): void {
  if (client.readyState !== WebSocket.OPEN) {
    return;
  }

  client.send(JSON.stringify({
    type,
    error: "Too many operations.",
  }));
}
