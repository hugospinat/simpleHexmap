export type ServerLimits = {
  allowedOrigins: string[];
  authRateLimitMaxAttempts: number;
  authRateLimitWindowMs: number;
  headersTimeoutMs: number;
  inviteJoinRateLimitMaxAttempts: number;
  inviteJoinRateLimitWindowMs: number;
  keepAliveTimeoutMs: number;
  maxHttpBodySizeBytes: number;
  maxWebSocketConnections: number;
  maxWebSocketConnectionsPerMap: number;
  maxWebSocketPayloadBytes: number;
  port: number;
  requestTimeoutMs: number;
  sessionCleanupIntervalMs: number;
  sessionIdleTimeoutMs: number;
  sessionLifetimeMs: number;
  workspaceInviteDefaultExpiresDays: number;
  workspaceInviteDefaultMaxUses: number;
  workspaceInviteMaxExpiresDays: number;
  workspaceInviteMaxUses: number;
  wsUpgradeRateLimitMaxAttempts: number;
  wsUpgradeRateLimitWindowMs: number;
};

const defaultServerLimits: ServerLimits = {
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

function readOriginAllowlist(
  env: NodeJS.ProcessEnv,
  key: string,
): string[] {
  const raw = env[key]?.trim();

  if (!raw) {
    return [];
  }

  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:"
          ? parsed.origin
          : null;
      } catch {
        return null;
      }
    })
    .filter((value): value is string => value !== null);

  return Array.from(new Set(origins));
}

export function resolveServerLimits(
  env: NodeJS.ProcessEnv = process.env,
): ServerLimits {
  return {
    allowedOrigins: readOriginAllowlist(env, "HEXMAP_ALLOWED_ORIGINS"),
    authRateLimitMaxAttempts: readPositiveInteger(
      env,
      "HEXMAP_AUTH_RATE_LIMIT_MAX_ATTEMPTS",
      defaultServerLimits.authRateLimitMaxAttempts,
    ),
    authRateLimitWindowMs: readPositiveInteger(
      env,
      "HEXMAP_AUTH_RATE_LIMIT_WINDOW_MS",
      defaultServerLimits.authRateLimitWindowMs,
    ),
    headersTimeoutMs: readPositiveInteger(
      env,
      "HEXMAP_HEADERS_TIMEOUT_MS",
      defaultServerLimits.headersTimeoutMs,
    ),
    inviteJoinRateLimitMaxAttempts: readPositiveInteger(
      env,
      "HEXMAP_INVITE_JOIN_RATE_LIMIT_MAX_ATTEMPTS",
      defaultServerLimits.inviteJoinRateLimitMaxAttempts,
    ),
    inviteJoinRateLimitWindowMs: readPositiveInteger(
      env,
      "HEXMAP_INVITE_JOIN_RATE_LIMIT_WINDOW_MS",
      defaultServerLimits.inviteJoinRateLimitWindowMs,
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
    sessionCleanupIntervalMs: readPositiveInteger(
      env,
      "HEXMAP_SESSION_CLEANUP_INTERVAL_MS",
      defaultServerLimits.sessionCleanupIntervalMs,
    ),
    sessionIdleTimeoutMs: readPositiveInteger(
      env,
      "HEXMAP_SESSION_IDLE_TIMEOUT_MS",
      defaultServerLimits.sessionIdleTimeoutMs,
    ),
    sessionLifetimeMs: readPositiveInteger(
      env,
      "HEXMAP_SESSION_LIFETIME_MS",
      defaultServerLimits.sessionLifetimeMs,
    ),
    workspaceInviteDefaultExpiresDays: readPositiveInteger(
      env,
      "HEXMAP_INVITE_DEFAULT_EXPIRES_DAYS",
      defaultServerLimits.workspaceInviteDefaultExpiresDays,
    ),
    workspaceInviteDefaultMaxUses: readPositiveInteger(
      env,
      "HEXMAP_INVITE_DEFAULT_MAX_USES",
      defaultServerLimits.workspaceInviteDefaultMaxUses,
    ),
    workspaceInviteMaxExpiresDays: readPositiveInteger(
      env,
      "HEXMAP_INVITE_MAX_EXPIRES_DAYS",
      defaultServerLimits.workspaceInviteMaxExpiresDays,
    ),
    workspaceInviteMaxUses: readPositiveInteger(
      env,
      "HEXMAP_INVITE_MAX_USES",
      defaultServerLimits.workspaceInviteMaxUses,
    ),
    wsUpgradeRateLimitMaxAttempts: readPositiveInteger(
      env,
      "HEXMAP_WS_UPGRADE_RATE_LIMIT_MAX_ATTEMPTS",
      defaultServerLimits.wsUpgradeRateLimitMaxAttempts,
    ),
    wsUpgradeRateLimitWindowMs: readPositiveInteger(
      env,
      "HEXMAP_WS_UPGRADE_RATE_LIMIT_WINDOW_MS",
      defaultServerLimits.wsUpgradeRateLimitWindowMs,
    ),
  };
}

export const serverLimits = resolveServerLimits();
