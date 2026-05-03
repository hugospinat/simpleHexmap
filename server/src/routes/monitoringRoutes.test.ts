import { describe, expect, it } from "vitest";
import {
  handleMonitoringRequest,
} from "./monitoringRoutes.js";

function createResponse() {
  const headers = new Map<string, string>();

  return {
    body: "",
    headers,
    statusCode: 0,
    end(chunk = "") {
      this.body += chunk;
    },
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  };
}

describe("monitoringRoutes", () => {
  it("serves a health snapshot from /healthz", async () => {
    const response = createResponse();

    await expect(
      handleMonitoringRequest(
        { method: "GET" },
        response,
        new URL("http://localhost/healthz"),
      ),
    ).resolves.toBe(true);

    expect(response.statusCode).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(JSON.parse(response.body)).toMatchObject({
      status: "ok",
    });
  });

  it("serves aggregate deployment metrics from /metrics", async () => {
    const response = createResponse();

    await expect(
      handleMonitoringRequest(
        { method: "GET" },
        response,
        new URL("http://localhost/metrics"),
      ),
    ).resolves.toBe(true);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      http: {
        headersTimeoutMs: expect.any(Number),
        keepAliveTimeoutMs: expect.any(Number),
        maxBodySizeBytes: expect.any(Number),
        requestTimeoutMs: expect.any(Number),
      },
      process: {
        arrayBuffersBytes: expect.any(Number),
        externalBytes: expect.any(Number),
        heapTotalBytes: expect.any(Number),
        heapUsedBytes: expect.any(Number),
        rssBytes: expect.any(Number),
      },
      startedAt: expect.any(String),
      timestamp: expect.any(String),
      uptimeMs: expect.any(Number),
      websocket: {
        activeClients: expect.any(Number),
        activeSessions: expect.any(Number),
        maxConnections: expect.any(Number),
        maxConnectionsPerMap: expect.any(Number),
        maxPayloadBytes: expect.any(Number),
        operationRateLimitMaxAttempts: expect.any(Number),
        operationRateLimitWindowMs: expect.any(Number),
      },
    });
  });

  it("ignores unrelated routes", async () => {
    await expect(
      handleMonitoringRequest(
        { method: "GET" },
        createResponse(),
        new URL("http://localhost/nope"),
      ),
    ).resolves.toBe(false);
  });
});
