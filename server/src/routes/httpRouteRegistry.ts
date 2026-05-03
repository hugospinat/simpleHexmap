import { handleAuthRequest } from "./authRoutes.js";
import {
  handleInviteJoinRequest,
  handleInviteResourceRequest,
  inviteJoinPathPattern,
  invitePathPattern,
} from "./inviteRoutes.js";
import {
  handleMapExportRequest,
  handleMapResourceRequest,
  handleWorkspaceMapImportRequest,
  handleWorkspaceMapsCollectionRequest,
  mapExportPathPattern,
  mapPathPattern,
  workspaceMapsImportPathPattern,
  workspaceMapsPathPattern,
} from "./mapRoutes.js";
import { handleStaticRequest } from "./httpHelpers.js";
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
} from "./workspaceRoutes.js";
import { handleMonitoringRequest } from "./monitoringRoutes.js";

type RouteHandler = (
  request: unknown,
  response: unknown,
  url: URL,
) => Promise<boolean>;

function createRegexRoute(
  pattern: RegExp,
  handler: (request: unknown, response: unknown, match: RegExpMatchArray, url: URL) => Promise<boolean>,
): RouteHandler {
  return async (request, response, url) => {
    const match = url.pathname.match(pattern);

    if (!match) {
      return false;
    }

    return handler(request, response, match, url);
  };
}

const httpRouteHandlers: RouteHandler[] = [
  (request, response, url) => handleMonitoringRequest(request, response, url),
  (request, response, url) => handleAuthRequest(request, response, url),
  createRegexRoute(inviteJoinPathPattern, (request, response, match) =>
    handleInviteJoinRequest(request, response, match),
  ),
  createRegexRoute(invitePathPattern, (request, response, match) =>
    handleInviteResourceRequest(request, response, match),
  ),
  (request, response, url) => handleWorkspaceCollectionRequest(request, response, url),
  createRegexRoute(workspaceMembersPathPattern, (request, response, match) =>
    handleWorkspaceMembersCollectionRequest(request, response, match),
  ),
  createRegexRoute(workspaceMemberPathPattern, (request, response, match) =>
    handleWorkspaceMemberResourceRequest(request, response, match),
  ),
  createRegexRoute(workspaceInvitesPathPattern, (request, response, match) =>
    handleWorkspaceInvitesCollectionRequest(request, response, match),
  ),
  createRegexRoute(workspaceInvitePathPattern, (request, response, match) =>
    handleWorkspaceInviteResourceRequest(request, response, match),
  ),
  createRegexRoute(workspaceMapsImportPathPattern, (request, response, match) =>
    handleWorkspaceMapImportRequest(request, response, match),
  ),
  createRegexRoute(workspaceMapsPathPattern, (request, response, match) =>
    handleWorkspaceMapsCollectionRequest(request, response, match),
  ),
  createRegexRoute(mapExportPathPattern, (request, response, match) =>
    handleMapExportRequest(request, response, match),
  ),
  createRegexRoute(mapPathPattern, (request, response, match, url) =>
    handleMapResourceRequest(request, response, url, match),
  ),
  createRegexRoute(workspacePathPattern, (request, response, match) =>
    handleWorkspaceResourceRequest(request, response, match),
  ),
  (request, response, url) => handleStaticRequest(request, response, url),
];

export async function handleRegisteredHttpRoute(
  request: unknown,
  response: unknown,
  url: URL,
): Promise<boolean> {
  for (const route of httpRouteHandlers) {
    if (await route(request, response, url)) {
      return true;
    }
  }

  return false;
}
