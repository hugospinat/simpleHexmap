import { requireAuth } from "../services/authService.js";
import {
  addWorkspaceMemberByUsername,
  canOpenAsGm,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceSummary,
  listWorkspaceMaps,
  listWorkspaceMembers,
  listWorkspacesForUser,
  removeWorkspaceMember,
  renameWorkspace,
  updateWorkspaceMemberRole,
} from "../repositories/workspaceRepository.js";
import { closeSession } from "../sessionStore.js";
import {
  readBody,
  sendJson,
} from "./httpHelpers.js";
import {
  addWorkspaceMemberBodySchema,
  createWorkspaceBodySchema,
  renameWorkspaceBodySchema,
  updateWorkspaceMemberRoleBodySchema,
} from "../validation/httpSchemas.js";

const idPatternSource = "[a-zA-Z0-9_-]{1,80}";
export const workspacePathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})$`);
export const workspaceMembersPathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})/members$`);
export const workspaceMemberPathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})/members/(${idPatternSource})$`);

function sendMembersView(response, statusCode: number, view) {
  sendJson(response, statusCode, {
    members: view.members,
    workspace: {
      currentUserRole: view.currentUserRole,
      id: view.workspaceId,
      name: view.workspaceName,
      ownerUserId: view.ownerUserId,
      updatedAt: view.updatedAt,
    },
  });
}

export async function handleWorkspaceCollectionRequest(request, response, url): Promise<boolean> {
  if (url.pathname !== "/api/workspaces") {
    return false;
  }

  const auth = await requireAuth(request);

  if (request.method === "GET") {
    sendJson(response, 200, { workspaces: await listWorkspacesForUser(auth.user.id) });
    return true;
  }

  if (request.method === "POST") {
    const body = createWorkspaceBodySchema.parse(await readBody(request));
    const workspace = await createWorkspace({
      name: body.name ?? "Untitled workspace",
      ownerUserId: auth.user.id,
    });
    sendJson(response, 201, { workspace });
    return true;
  }

  return false;
}

export async function handleWorkspaceResourceRequest(request, response, match): Promise<boolean> {
  const auth = await requireAuth(request);
  const workspaceId = match[1];

  if (request.method === "GET") {
    const workspace = await getWorkspaceSummary(workspaceId, auth.user.id);

    if (!workspace) {
      sendJson(response, 404, { error: "Workspace not found." });
      return true;
    }

    sendJson(response, 200, { workspace });
    return true;
  }

  const summary = await getWorkspaceSummary(workspaceId, auth.user.id);

  if (!summary) {
    sendJson(response, 404, { error: "Workspace not found." });
    return true;
  }

  if (request.method === "PATCH") {
    if (!canOpenAsGm(summary.currentUserRole)) {
      sendJson(response, 403, { error: "GM access denied." });
      return true;
    }

    const body = renameWorkspaceBodySchema.parse(await readBody(request));
    await renameWorkspace(workspaceId, body.name ?? "Untitled workspace");
    const updated = await getWorkspaceSummary(workspaceId, auth.user.id);
    sendJson(response, 200, { workspace: updated });
    return true;
  }

  if (request.method === "DELETE") {
    if (summary.currentUserRole !== "owner") {
      sendJson(response, 403, { error: "Owner access denied." });
      return true;
    }

    const maps = await listWorkspaceMaps({ userId: auth.user.id, workspaceId });
    const deleted = await deleteWorkspace(workspaceId);

    if (deleted) {
      for (const map of maps.maps) {
        closeSession(map.id);
      }
    }

    sendJson(response, deleted ? 200 : 404, deleted ? { deleted: true } : { error: "Workspace not found." });
    return true;
  }

  return false;
}

export async function handleWorkspaceMembersCollectionRequest(request, response, match): Promise<boolean> {
  const auth = await requireAuth(request);
  const workspaceId = match[1];

  if (request.method === "GET") {
    const view = await listWorkspaceMembers({ actorUserId: auth.user.id, workspaceId });
    sendMembersView(response, 200, view);
    return true;
  }

  if (request.method === "POST") {
    const body = addWorkspaceMemberBodySchema.parse(await readBody(request));

    await addWorkspaceMemberByUsername({
      actorUserId: auth.user.id,
      role: body.role,
      username: body.username,
      workspaceId,
    });
    const view = await listWorkspaceMembers({ actorUserId: auth.user.id, workspaceId });
    sendMembersView(response, 201, view);
    return true;
  }

  return false;
}

export async function handleWorkspaceMemberResourceRequest(request, response, match): Promise<boolean> {
  const auth = await requireAuth(request);
  const workspaceId = match[1];
  const targetUserId = match[2];

  if (request.method === "PATCH") {
    const body = updateWorkspaceMemberRoleBodySchema.parse(await readBody(request));

    await updateWorkspaceMemberRole({
      actorUserId: auth.user.id,
      role: body.role,
      targetUserId,
      workspaceId,
    });
    const view = await listWorkspaceMembers({ actorUserId: auth.user.id, workspaceId });
    sendMembersView(response, 200, view);
    return true;
  }

  if (request.method === "DELETE") {
    await removeWorkspaceMember({
      actorUserId: auth.user.id,
      targetUserId,
      workspaceId,
    });
    const view = await listWorkspaceMembers({ actorUserId: auth.user.id, workspaceId });
    sendMembersView(response, 200, view);
    return true;
  }

  return false;
}
