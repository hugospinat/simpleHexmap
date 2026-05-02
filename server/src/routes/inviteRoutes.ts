import { requireAuth } from "../services/authService.js";
import { getClientIp } from "../security/requestSecurity.js";
import { MemoryRateLimiter } from "../security/rateLimiter.js";
import { serverLimits } from "../serverConfig.js";
import {
  getWorkspaceInviteByToken,
  joinWorkspaceByInviteToken,
} from "../repositories/workspaceInviteRepository.js";
import { sendJson } from "./httpHelpers.js";

const inviteRateLimiter = new MemoryRateLimiter();
const inviteTokenPattern = "[a-zA-Z0-9_-]{16,120}";

export const invitePathPattern = new RegExp(
  `^/api/invites/(${inviteTokenPattern})$`,
);
export const inviteJoinPathPattern = new RegExp(
  `^/api/invites/(${inviteTokenPattern})/join$`,
);

function assertInviteJoinRateLimit(request): void {
  const result = inviteRateLimiter.consume(
    `invite:${getClientIp(request)}`,
    serverLimits.inviteJoinRateLimitMaxAttempts,
    serverLimits.inviteJoinRateLimitWindowMs,
  );

  if (!result.allowed) {
    console.warn("[workspace_invites] join_rate_limited", {
      ip: getClientIp(request),
      retryAfterMs: result.retryAfterMs,
    });
    throw new Error("Too many requests.");
  }
}

export async function handleInviteResourceRequest(
  request,
  response,
  match,
): Promise<boolean> {
  if (request.method !== "GET") {
    return false;
  }

  sendJson(response, 200, {
    invite: await getWorkspaceInviteByToken(match[1]),
  });
  return true;
}

export async function handleInviteJoinRequest(
  request,
  response,
  match,
): Promise<boolean> {
  if (request.method !== "POST") {
    return false;
  }

  assertInviteJoinRateLimit(request);
  const auth = await requireAuth(request);
  const result = await joinWorkspaceByInviteToken({
    token: match[1],
    userId: auth.user.id,
  });
  sendJson(response, 200, result);
  return true;
}
