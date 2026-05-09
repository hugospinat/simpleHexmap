import { describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { MemoryRateLimiter } from "../security/rateLimiter.js";
import {
  consumeSessionOperationAllowance,
  sendRateLimitedOperationError,
} from "./operationRateLimit.js";

describe("operationRateLimit", () => {
  it("tracks WebSocket operation budgets per user within a map session", () => {
    let now = 1_000;
    const session = {
      clients: new Map(),
      mapId: "map-1",
      operationRateLimiter: new MemoryRateLimiter(() => now),
    };

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      expect(consumeSessionOperationAllowance(session, "user-1")).toMatchObject({
        allowed: true,
      });
    }

    expect(consumeSessionOperationAllowance(session, "user-1")).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterMs: 1000,
    });
    expect(consumeSessionOperationAllowance(session, "user-2")).toMatchObject({
      allowed: true,
    });

    now += 1_001;

    expect(consumeSessionOperationAllowance(session, "user-1")).toMatchObject({
      allowed: true,
    });
  });

  it("sends a generic rate-limit error only to open sockets", () => {
    const openClient = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;
    const closedClient = {
      readyState: WebSocket.CLOSED,
      send: vi.fn(),
    } as unknown as WebSocket;

    sendRateLimitedOperationError(openClient, "map_operation_error", 250);
    sendRateLimitedOperationError(closedClient, "map_token_error", 250);

    expect(openClient.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: "map_operation_error",
        error: "Too many operations.",
        retryAfterMs: 250,
      }),
    );
    expect(closedClient.send).not.toHaveBeenCalled();
  });
});
