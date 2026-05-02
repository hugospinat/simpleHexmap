import { ZodError } from "zod";
import { AppError } from "./errors.js";
import { handleAuthRequest } from "./routes/authRoutes.js";
import {
  handleInviteJoinRequest,
  handleInviteResourceRequest,
  inviteJoinPathPattern,
  invitePathPattern,
} from "./routes/inviteRoutes.js";
import { handleStaticRequest, sendJson } from "./routes/httpHelpers.js";
import {
  handleMapExportRequest,
  handleMapResourceRequest,
  handleWorkspaceMapImportRequest,
  handleWorkspaceMapsCollectionRequest,
  mapExportPathPattern,
  mapPathPattern,
  workspaceMapsImportPathPattern,
  workspaceMapsPathPattern,
} from "./routes/mapRoutes.js";
import {
  handleWorkspaceCollectionRequest,
  handleWorkspaceInviteResourceRequest,
  handleWorkspaceInvitesCollectionRequest,
  handleWorkspaceMemberResourceRequest,
  handleWorkspaceMembersCollectionRequest,
  handleWorkspaceResourceRequest,
  workspaceInvitePathPattern,
  workspaceInvitesPathPattern,
  workspaceMemberPathPattern,
  workspaceMembersPathPattern,
  workspacePathPattern,
} from "./routes/workspaceRoutes.js";
import {
  applySecurityHeaders,
  assertRequestOriginAllowed,
  isCorsPreflightAllowed,
  setCors,
} from "./security/requestSecurity.js";

const errorStatusMap: Record<string, number> = {
  "Authentication required.": 401,
  "Invalid username or password.": 401,
  "Username is already taken.": 409,
  "Workspace not found.": 404,
  "Map not found.": 404,
  "GM access denied.": 403,
  "Owner access denied.": 403,
  "Cannot remove the workspace owner.": 409,
  "Cannot change the workspace owner role.": 409,
  "Workspace member not found.": 404,
  "User not found.": 404,
  "User is already in this workspace.": 409,
  "Invalid workspace role.": 400,
  "Invalid workspace invite role.": 400,
  "Invalid workspace invite max uses.": 400,
  "Invalid workspace invite expiration.": 400,
  "Username is required.": 400,
  "Invite link not found.": 404,
  "Invite link has expired.": 409,
  "Invite link has been revoked.": 409,
  "Invite link has reached its usage limit.": 409,
  "Workspace invite not found.": 404,
  "Invalid JSON body.": 400,
  "Request body too large.": 413,
  "Request origin denied.": 403,
  "Too many requests.": 429,
};

function resolveErrorStatus(error: unknown): number {
  if (error instanceof ZodError) {
    return 400;
  }

  if (error instanceof AppError) {
    return error.statusCode;
  }

  if (
    error &&
    typeof error === "object" &&
    "statusCode" in error &&
    Number.isInteger((error as { statusCode?: number }).statusCode)
  ) {
    return Number((error as { statusCode: number }).statusCode);
  }

  const message = error instanceof Error ? error.message : "";
  return errorStatusMap[message] ?? 500;
}

export function createHttpHandler() {
  return async (request, response) => {
    applySecurityHeaders(response);
    setCors(request, response);

    if (request.method === "OPTIONS") {
      if (!isCorsPreflightAllowed(request)) {
        sendJson(response, 403, { error: "Request origin denied." });
        return;
      }

      response.statusCode = 204;
      response.end();
      return;
    }

    if (!request.url) {
      sendJson(response, 400, { error: "Missing request URL." });
      return;
    }

    const url = new URL(request.url, "http://localhost");

    try {
      assertRequestOriginAllowed(request);
      if (await handleAuthRequest(request, response, url)) return;

      const inviteJoinMatch = url.pathname.match(inviteJoinPathPattern);
      if (inviteJoinMatch && await handleInviteJoinRequest(request, response, inviteJoinMatch)) return;

      const inviteMatch = url.pathname.match(invitePathPattern);
      if (inviteMatch && await handleInviteResourceRequest(request, response, inviteMatch)) return;

      if (await handleWorkspaceCollectionRequest(request, response, url)) return;

      const membersMatch = url.pathname.match(workspaceMembersPathPattern);
      if (membersMatch && await handleWorkspaceMembersCollectionRequest(request, response, membersMatch)) return;

      const memberMatch = url.pathname.match(workspaceMemberPathPattern);
      if (memberMatch && await handleWorkspaceMemberResourceRequest(request, response, memberMatch)) return;

      const invitesMatch = url.pathname.match(workspaceInvitesPathPattern);
      if (invitesMatch && await handleWorkspaceInvitesCollectionRequest(request, response, invitesMatch)) return;

      const inviteResourceMatch = url.pathname.match(workspaceInvitePathPattern);
      if (inviteResourceMatch && await handleWorkspaceInviteResourceRequest(request, response, inviteResourceMatch)) return;

      const workspaceMapsImportMatch = url.pathname.match(workspaceMapsImportPathPattern);
      if (workspaceMapsImportMatch && await handleWorkspaceMapImportRequest(request, response, workspaceMapsImportMatch)) return;

      const workspaceMapsMatch = url.pathname.match(workspaceMapsPathPattern);
      if (workspaceMapsMatch && await handleWorkspaceMapsCollectionRequest(request, response, workspaceMapsMatch)) return;

      const mapExportMatch = url.pathname.match(mapExportPathPattern);
      if (mapExportMatch && await handleMapExportRequest(request, response, mapExportMatch)) return;

      const mapMatch = url.pathname.match(mapPathPattern);
      if (mapMatch && await handleMapResourceRequest(request, response, url, mapMatch)) return;

      const workspaceMatch = url.pathname.match(workspacePathPattern);
      if (workspaceMatch && await handleWorkspaceResourceRequest(request, response, workspaceMatch)) return;

      if (await handleStaticRequest(request, response, url)) return;

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof ZodError
        ? error.issues[0]?.message ?? "Invalid input."
        : error instanceof Error ? error.message : "Unexpected error.";
      sendJson(response, resolveErrorStatus(error), { error: message });
    }
  };
}
