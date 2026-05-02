import { describe, expect, it } from "vitest";
import { resolveWebSocketUpgradeRejection } from "./wsRoutes.js";

describe("wsRoutes", () => {
  it("rejects upgrades when the server-wide connection budget is exhausted", () => {
    expect(
      resolveWebSocketUpgradeRejection({
        currentConnections: 100,
        currentMapConnections: 2,
        maxConnections: 100,
        maxConnectionsPerMap: 24,
      }),
    ).toEqual({
      reason: "Server is at WebSocket capacity.",
      statusCode: 503,
    });
  });

  it("rejects upgrades when a map already reached its connection budget", () => {
    expect(
      resolveWebSocketUpgradeRejection({
        currentConnections: 10,
        currentMapConnections: 24,
        maxConnections: 100,
        maxConnectionsPerMap: 24,
      }),
    ).toEqual({
      reason: "Map is at WebSocket capacity.",
      statusCode: 503,
    });
  });

  it("allows upgrades while budgets remain available", () => {
    expect(
      resolveWebSocketUpgradeRejection({
        currentConnections: 10,
        currentMapConnections: 8,
        maxConnections: 100,
        maxConnectionsPerMap: 24,
      }),
    ).toBeNull();
  });
});
