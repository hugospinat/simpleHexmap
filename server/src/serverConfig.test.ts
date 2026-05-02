import { describe, expect, it } from "vitest";
import { resolveServerLimits } from "./serverConfig.js";

describe("serverConfig", () => {
  it("returns the low-resource defaults", () => {
    const limits = resolveServerLimits({});

    expect(limits).toEqual({
      allowedOrigins: [],
      authRateLimitMaxAttempts: 10,
      authRateLimitWindowMs: 5 * 60_000,
      headersTimeoutMs: 20_000,
      inviteJoinRateLimitMaxAttempts: 20,
      inviteJoinRateLimitWindowMs: 10 * 60_000,
      keepAliveTimeoutMs: 5_000,
      maxHttpBodySizeBytes: 5 * 1024 * 1024,
      maxWebSocketConnections: 100,
      maxWebSocketConnectionsPerMap: 24,
      maxWebSocketPayloadBytes: 256 * 1024,
      port: 8787,
      requestTimeoutMs: 15_000,
      sessionCleanupIntervalMs: 5 * 60_000,
      sessionIdleTimeoutMs: 7 * 24 * 60 * 60_000,
      sessionLifetimeMs: 30 * 24 * 60 * 60_000,
      workspaceInviteDefaultExpiresDays: 7,
      workspaceInviteDefaultMaxUses: 1,
      workspaceInviteMaxExpiresDays: 30,
      workspaceInviteMaxUses: 100,
      wsUpgradeRateLimitMaxAttempts: 60,
      wsUpgradeRateLimitWindowMs: 60_000,
    });
  });

  it("uses environment overrides only when they are valid positive integers", () => {
    const limits = resolveServerLimits({
      HEXMAP_ALLOWED_ORIGINS: "https://app.example.com, http://localhost:5173",
      HEXMAP_AUTH_RATE_LIMIT_MAX_ATTEMPTS: "12",
      HEXMAP_AUTH_RATE_LIMIT_WINDOW_MS: "61000",
      HEXMAP_HEADERS_TIMEOUT_MS: "25000",
      HEXMAP_INVITE_JOIN_RATE_LIMIT_MAX_ATTEMPTS: "22",
      HEXMAP_INVITE_JOIN_RATE_LIMIT_WINDOW_MS: "62000",
      HEXMAP_KEEP_ALIVE_TIMEOUT_MS: "7000",
      HEXMAP_MAX_HTTP_BODY_BYTES: "1234",
      HEXMAP_MAX_WS_CONNECTIONS: "88",
      HEXMAP_MAX_WS_CONNECTIONS_PER_MAP: "12",
      HEXMAP_MAX_WS_PAYLOAD_BYTES: "4096",
      HEXMAP_REQUEST_TIMEOUT_MS: "17500",
      HEXMAP_SESSION_CLEANUP_INTERVAL_MS: "30000",
      HEXMAP_SESSION_IDLE_TIMEOUT_MS: "40000",
      HEXMAP_SESSION_LIFETIME_MS: "50000",
      HEXMAP_INVITE_DEFAULT_EXPIRES_DAYS: "9",
      HEXMAP_INVITE_DEFAULT_MAX_USES: "3",
      HEXMAP_INVITE_MAX_EXPIRES_DAYS: "44",
      HEXMAP_INVITE_MAX_USES: "55",
      HEXMAP_WS_UPGRADE_RATE_LIMIT_MAX_ATTEMPTS: "66",
      HEXMAP_WS_UPGRADE_RATE_LIMIT_WINDOW_MS: "77000",
      PORT: "9999",
    });

    expect(limits).toEqual({
      allowedOrigins: ["https://app.example.com", "http://localhost:5173"],
      authRateLimitMaxAttempts: 12,
      authRateLimitWindowMs: 61_000,
      headersTimeoutMs: 25_000,
      inviteJoinRateLimitMaxAttempts: 22,
      inviteJoinRateLimitWindowMs: 62_000,
      keepAliveTimeoutMs: 7_000,
      maxHttpBodySizeBytes: 1234,
      maxWebSocketConnections: 88,
      maxWebSocketConnectionsPerMap: 12,
      maxWebSocketPayloadBytes: 4096,
      port: 9999,
      requestTimeoutMs: 17_500,
      sessionCleanupIntervalMs: 30_000,
      sessionIdleTimeoutMs: 40_000,
      sessionLifetimeMs: 50_000,
      workspaceInviteDefaultExpiresDays: 9,
      workspaceInviteDefaultMaxUses: 3,
      workspaceInviteMaxExpiresDays: 44,
      workspaceInviteMaxUses: 55,
      wsUpgradeRateLimitMaxAttempts: 66,
      wsUpgradeRateLimitWindowMs: 77_000,
    });
  });

  it("falls back to defaults for invalid overrides", () => {
    const limits = resolveServerLimits({
      HEXMAP_ALLOWED_ORIGINS: "notaurl,ws://bad.example.com",
      HEXMAP_AUTH_RATE_LIMIT_MAX_ATTEMPTS: "0",
      HEXMAP_AUTH_RATE_LIMIT_WINDOW_MS: "-1",
      HEXMAP_HEADERS_TIMEOUT_MS: "0",
      HEXMAP_INVITE_JOIN_RATE_LIMIT_MAX_ATTEMPTS: "nope",
      HEXMAP_INVITE_JOIN_RATE_LIMIT_WINDOW_MS: " ",
      HEXMAP_KEEP_ALIVE_TIMEOUT_MS: "-1",
      HEXMAP_MAX_HTTP_BODY_BYTES: "nope",
      HEXMAP_MAX_WS_CONNECTIONS: "1.5",
      HEXMAP_MAX_WS_CONNECTIONS_PER_MAP: "",
      HEXMAP_MAX_WS_PAYLOAD_BYTES: " ",
      HEXMAP_REQUEST_TIMEOUT_MS: "NaN",
      HEXMAP_SESSION_CLEANUP_INTERVAL_MS: "0",
      HEXMAP_SESSION_IDLE_TIMEOUT_MS: "NaN",
      HEXMAP_SESSION_LIFETIME_MS: "bad",
      HEXMAP_INVITE_DEFAULT_EXPIRES_DAYS: "-5",
      HEXMAP_INVITE_DEFAULT_MAX_USES: "0",
      HEXMAP_INVITE_MAX_EXPIRES_DAYS: "",
      HEXMAP_INVITE_MAX_USES: "NaN",
      HEXMAP_WS_UPGRADE_RATE_LIMIT_MAX_ATTEMPTS: "0",
      HEXMAP_WS_UPGRADE_RATE_LIMIT_WINDOW_MS: "wat",
      PORT: "abc",
    });

    expect(limits).toEqual(resolveServerLimits({}));
  });
});
