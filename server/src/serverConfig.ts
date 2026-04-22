export type ServerLimits = {
  headersTimeoutMs: number;
  keepAliveTimeoutMs: number;
  maxHttpBodySizeBytes: number;
  maxWebSocketConnections: number;
  maxWebSocketConnectionsPerMap: number;
  maxWebSocketPayloadBytes: number;
  port: number;
  requestTimeoutMs: number;
};

const defaultServerLimits: ServerLimits = {
  headersTimeoutMs: 20_000,
  keepAliveTimeoutMs: 5_000,
  maxHttpBodySizeBytes: 5 * 1024 * 1024,
  maxWebSocketConnections: 100,
  maxWebSocketConnectionsPerMap: 24,
  maxWebSocketPayloadBytes: 256 * 1024,
  port: 8787,
  requestTimeoutMs: 15_000,
};

function readPositiveInteger(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const raw = env[key]?.trim();

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveServerLimits(
  env: NodeJS.ProcessEnv = process.env,
): ServerLimits {
  return {
    headersTimeoutMs: readPositiveInteger(
      env,
      "HEXMAP_HEADERS_TIMEOUT_MS",
      defaultServerLimits.headersTimeoutMs,
    ),
    keepAliveTimeoutMs: readPositiveInteger(
      env,
      "HEXMAP_KEEP_ALIVE_TIMEOUT_MS",
      defaultServerLimits.keepAliveTimeoutMs,
    ),
    maxHttpBodySizeBytes: readPositiveInteger(
      env,
      "HEXMAP_MAX_HTTP_BODY_BYTES",
      defaultServerLimits.maxHttpBodySizeBytes,
    ),
    maxWebSocketConnections: readPositiveInteger(
      env,
      "HEXMAP_MAX_WS_CONNECTIONS",
      defaultServerLimits.maxWebSocketConnections,
    ),
    maxWebSocketConnectionsPerMap: readPositiveInteger(
      env,
      "HEXMAP_MAX_WS_CONNECTIONS_PER_MAP",
      defaultServerLimits.maxWebSocketConnectionsPerMap,
    ),
    maxWebSocketPayloadBytes: readPositiveInteger(
      env,
      "HEXMAP_MAX_WS_PAYLOAD_BYTES",
      defaultServerLimits.maxWebSocketPayloadBytes,
    ),
    port: readPositiveInteger(env, "PORT", defaultServerLimits.port),
    requestTimeoutMs: readPositiveInteger(
      env,
      "HEXMAP_REQUEST_TIMEOUT_MS",
      defaultServerLimits.requestTimeoutMs,
    ),
  };
}

export const serverLimits = resolveServerLimits();
