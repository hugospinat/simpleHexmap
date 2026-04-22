import { describe, expect, it } from "vitest";
import { resolveServerLimits } from "./serverConfig.js";

describe("serverConfig", () => {
  it("returns the low-resource defaults", () => {
    const limits = resolveServerLimits({});

    expect(limits).toEqual({
      headersTimeoutMs: 20_000,
      keepAliveTimeoutMs: 5_000,
      maxHttpBodySizeBytes: 5 * 1024 * 1024,
      maxWebSocketConnections: 100,
      maxWebSocketConnectionsPerMap: 24,
      maxWebSocketPayloadBytes: 256 * 1024,
      port: 8787,
      requestTimeoutMs: 15_000,
    });
  });

  it("uses environment overrides only when they are valid positive integers", () => {
    const limits = resolveServerLimits({
      HEXMAP_HEADERS_TIMEOUT_MS: "25000",
      HEXMAP_KEEP_ALIVE_TIMEOUT_MS: "7000",
      HEXMAP_MAX_HTTP_BODY_BYTES: "1234",
      HEXMAP_MAX_WS_CONNECTIONS: "88",
      HEXMAP_MAX_WS_CONNECTIONS_PER_MAP: "12",
      HEXMAP_MAX_WS_PAYLOAD_BYTES: "4096",
      HEXMAP_REQUEST_TIMEOUT_MS: "17500",
      PORT: "9999",
    });

    expect(limits).toEqual({
      headersTimeoutMs: 25_000,
      keepAliveTimeoutMs: 7_000,
      maxHttpBodySizeBytes: 1234,
      maxWebSocketConnections: 88,
      maxWebSocketConnectionsPerMap: 12,
      maxWebSocketPayloadBytes: 4096,
      port: 9999,
      requestTimeoutMs: 17_500,
    });
  });

  it("falls back to defaults for invalid overrides", () => {
    const limits = resolveServerLimits({
      HEXMAP_HEADERS_TIMEOUT_MS: "0",
      HEXMAP_KEEP_ALIVE_TIMEOUT_MS: "-1",
      HEXMAP_MAX_HTTP_BODY_BYTES: "nope",
      HEXMAP_MAX_WS_CONNECTIONS: "1.5",
      HEXMAP_MAX_WS_CONNECTIONS_PER_MAP: "",
      HEXMAP_MAX_WS_PAYLOAD_BYTES: " ",
      HEXMAP_REQUEST_TIMEOUT_MS: "NaN",
      PORT: "abc",
    });

    expect(limits).toEqual(resolveServerLimits({}));
  });
});
