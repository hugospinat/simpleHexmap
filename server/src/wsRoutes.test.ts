import { describe, expect, it } from "vitest";
import {
  resolveWebSocketAccessRejection,
  resolveWebSocketUpgradeRejection,
} from "./wsRoutes.js";

describe("wsRoutes", () => {
  it("rejects unauthenticated websocket upgrades with an HTTP 401 response", () => {
    expect(resolveWebSocketAccessRejection({
      hasAuthenticatedUser: false,
      hasMapAccess: false,
    })).toEqual({
      reason: "Authentication required.",
      statusCode: 401,
    });
  });

  it("rejects websocket upgrades for inaccessible maps with an HTTP 404 response", () => {
    expect(resolveWebSocketAccessRejection({
      hasAuthenticatedUser: true,
      hasMapAccess: false,
    })).toEqual({
      reason: "Map not found.",
      statusCode: 404,
    });
  });

  it("allows websocket upgrades that pass access checks", () => {
    expect(resolveWebSocketAccessRejection({
      hasAuthenticatedUser: true,
      hasMapAccess: true,
    })).toBeNull();
  });

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
