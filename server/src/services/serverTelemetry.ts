import { getSessionStoreMetrics } from "../sessionStore.js";
import { serverLimits } from "../serverConfig.js";

const serverStartedAt = Date.now();

export type ServerHealthSnapshot = {
  status: "ok";
  startedAt: string;
  timestamp: string;
  uptimeMs: number;
};

export type ServerMetricsSnapshot = {
  http: {
    headersTimeoutMs: number;
    keepAliveTimeoutMs: number;
    maxBodySizeBytes: number;
    requestTimeoutMs: number;
  };
  process: {
    arrayBuffersBytes: number;
    externalBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    rssBytes: number;
  };
  startedAt: string;
  timestamp: string;
  uptimeMs: number;
  websocket: {
    activeClients: number;
    activeSessions: number;
    maxConnections: number;
    maxConnectionsPerMap: number;
    maxPayloadBytes: number;
  };
};

type TelemetrySnapshotOptions = {
  now?: number;
  startedAt?: number;
};

function resolveSnapshotTimes(options: TelemetrySnapshotOptions): {
  now: number;
  startedAt: number;
} {
  const now = options.now ?? Date.now();
  const startedAt = options.startedAt ?? serverStartedAt;

  return {
    now,
    startedAt,
  };
}

export function getServerHealthSnapshot(
  options: TelemetrySnapshotOptions = {},
): ServerHealthSnapshot {
  const { now, startedAt } = resolveSnapshotTimes(options);

  return {
    status: "ok",
    startedAt: new Date(startedAt).toISOString(),
    timestamp: new Date(now).toISOString(),
    uptimeMs: Math.max(now - startedAt, 0),
  };
}

export function getServerMetricsSnapshot(
  options: TelemetrySnapshotOptions = {},
): ServerMetricsSnapshot {
  const { now, startedAt } = resolveSnapshotTimes(options);
  const memoryUsage = process.memoryUsage();
  const sessionMetrics = getSessionStoreMetrics();

  return {
    startedAt: new Date(startedAt).toISOString(),
    timestamp: new Date(now).toISOString(),
    uptimeMs: Math.max(now - startedAt, 0),
    process: {
      rssBytes: memoryUsage.rss,
      heapTotalBytes: memoryUsage.heapTotal,
      heapUsedBytes: memoryUsage.heapUsed,
      externalBytes: memoryUsage.external,
      arrayBuffersBytes: memoryUsage.arrayBuffers,
    },
    websocket: {
      activeSessions: sessionMetrics.activeSessions,
      activeClients: sessionMetrics.activeClients,
      maxConnections: serverLimits.maxWebSocketConnections,
      maxConnectionsPerMap: serverLimits.maxWebSocketConnectionsPerMap,
      maxPayloadBytes: serverLimits.maxWebSocketPayloadBytes,
    },
    http: {
      headersTimeoutMs: serverLimits.headersTimeoutMs,
      keepAliveTimeoutMs: serverLimits.keepAliveTimeoutMs,
      maxBodySizeBytes: serverLimits.maxHttpBodySizeBytes,
      requestTimeoutMs: serverLimits.requestTimeoutMs,
    },
  };
}
