import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { canOpenWorkspaceAsGM } from "../../src/core/auth/authTypes.js";
import { parseSavedMapContent } from "../../src/core/document/savedMapCodec.js";
import {
  addWorkspaceMemberByUsername,
  canOpenAsGm,
  createMapInWorkspace,
  createWorkspace,
  deleteWorkspace,
  deleteWorkspaceMap,
  getMapRecordForUser,
  getWorkspaceSummary,
  listWorkspaceMaps,
  listWorkspaceMembers,
  listWorkspacesForUser,
  renameWorkspace,
  renameWorkspaceMap,
  removeWorkspaceMember,
  updateWorkspaceMemberRole
} from "./repositories/workspaceRepository.js";
import {
  getAuthContext,
  loginUser,
  logoutUser,
  requireAuth,
  signupUser
} from "./services/authService.js";
import { closeSession } from "./sessionStore.js";

const maxRequestBodySizeBytes = 50 * 1024 * 1024;
const idPatternSource = "[a-zA-Z0-9_-]{1,80}";
const workspacePathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})$`);
const workspaceMembersPathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})/members$`);
const workspaceMemberPathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})/members/(${idPatternSource})$`);
const workspaceMapsPathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})/maps$`);
const workspaceMapsImportPathPattern = new RegExp(`^/api/workspaces/(${idPatternSource})/maps/import$`);
const mapPathPattern = new RegExp(`^/api/maps/(${idPatternSource})$`);
const mapExportPathPattern = new RegExp(`^/api/maps/(${idPatternSource})/export$`);
const staticRoot = path.resolve(process.cwd(), "dist");
const staticContentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"]
]);

const defaultMapContent = {
  version: 1,
  tiles: [{ q: 0, r: 0, terrain: "plain", hidden: true }],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: [],
  tokens: []
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeName(value: unknown, fallback = "Untitled map"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : fallback;
}

function setCors(request, response): void {
  const origin = request.headers.origin;
  response.setHeader("Access-Control-Allow-Origin", typeof origin === "string" ? origin : "*");
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendStaticFile(response, filePath, method) {
  const extension = path.extname(filePath).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", staticContentTypes.get(extension) ?? "application/octet-stream");

  if (extension !== ".html") {
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    response.setHeader("Cache-Control", "no-cache");
  }

  if (method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}

async function resolveStaticFile(pathname) {
  const decodedPathname = decodeURIComponent(pathname);
  const normalizedPathname = decodedPathname === "/" ? "/index.html" : decodedPathname;
  const candidate = path.resolve(staticRoot, `.${normalizedPathname}`);

  if (candidate.startsWith(staticRoot)) {
    try {
      const stats = await fs.stat(candidate);

      if (stats.isFile()) {
        return candidate;
      }
    } catch {
      // Fall back to the SPA entry below.
    }
  }

  const indexPath = path.join(staticRoot, "index.html");

  try {
    const stats = await fs.stat(indexPath);
    return stats.isFile() ? indexPath : null;
  } catch {
    return null;
  }
}

async function handleStaticRequest(request, response, url) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  if (url.pathname.startsWith("/api/")) {
    return false;
  }

  const filePath = await resolveStaticFile(url.pathname);

  if (!filePath) {
    return false;
  }

  sendStaticFile(response, filePath, request.method);
  return true;
}

async function readBody(request): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = "";
    let rejected = false;

    request.on("data", (chunk) => {
      if (rejected) {
        return;
      }

      data += chunk;

      if (data.length > maxRequestBodySizeBytes) {
        rejected = true;
        reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
      }
    });

    request.on("end", () => {
      if (rejected) {
        return;
      }

      if (!data.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }));
      }
    });

    request.on("error", (error) => {
      if (!rejected) {
        reject(error);
      }
    });
  });
}

function parseContentInput(value: unknown) {
  try {
    return parseSavedMapContent(value);
  } catch {
    return defaultMapContent;
  }
}

function parseWorkspaceMemberRole(value: unknown): "gm" | "player" | null {
  if (value === "gm" || value === "player") {
    return value;
  }

  return null;
}

async function handleAuthRequest(request, response, url): Promise<boolean> {
  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const context = await getAuthContext(request);

    if (!context) {
      sendJson(response, 401, { error: "Authentication required." });
      return true;
    }

    sendJson(response, 200, {
      user: {
        id: context.user.id,
        username: context.user.username,
        createdAt: context.user.createdAt.toISOString(),
        updatedAt: context.user.updatedAt.toISOString()
      }
    });
    return true;
  }

  if (url.pathname === "/api/auth/signup" && request.method === "POST") {
    const user = await signupUser(await readBody(request), response);
    sendJson(response, 201, { user });
    return true;
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const user = await loginUser(await readBody(request), response);
    sendJson(response, 200, { user });
    return true;
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    await logoutUser(request, response);
    sendJson(response, 200, { ok: true });
    return true;
  }

  return false;
}

async function handleWorkspaceCollectionRequest(request, response, url): Promise<boolean> {
  if (url.pathname !== "/api/workspaces") {
    return false;
  }

  const auth = await requireAuth(request);

  if (request.method === "GET") {
    sendJson(response, 200, { workspaces: await listWorkspacesForUser(auth.user.id) });
    return true;
  }

  if (request.method === "POST") {
    const body = await readBody(request);
    const workspace = await createWorkspace({
      name: sanitizeName(isObject(body) ? body.name : null, "Untitled workspace"),
      ownerUserId: auth.user.id
    });
    sendJson(response, 201, { workspace });
    return true;
  }

  return false;
}

async function handleWorkspaceResourceRequest(request, response, match): Promise<boolean> {
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

    const body = await readBody(request);
    await renameWorkspace(workspaceId, sanitizeName(isObject(body) ? body.name : null, "Untitled workspace"));
    const updated = await getWorkspaceSummary(workspaceId, auth.user.id);
    sendJson(response, 200, { workspace: updated });
    return true;
  }

  if (request.method === "DELETE") {
    if (summary.currentUserRole !== "owner") {
      sendJson(response, 403, { error: "Owner access denied." });
      return true;
    }

    const maps = await listWorkspaceMaps({
      userId: auth.user.id,
      workspaceId
    });
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

async function handleWorkspaceMembersCollectionRequest(request, response, match): Promise<boolean> {
  const auth = await requireAuth(request);
  const workspaceId = match[1];

  if (request.method === "GET") {
    const view = await listWorkspaceMembers({
      actorUserId: auth.user.id,
      workspaceId
    });
    sendJson(response, 200, {
      members: view.members,
      workspace: {
        currentUserRole: view.currentUserRole,
        id: view.workspaceId,
        name: view.workspaceName,
        ownerUserId: view.ownerUserId,
        updatedAt: view.updatedAt
      }
    });
    return true;
  }

  if (request.method === "POST") {
    const body = await readBody(request);

    if (!isObject(body)) {
      sendJson(response, 400, { error: "Invalid JSON body." });
      return true;
    }

    const role = parseWorkspaceMemberRole(body.role) ?? "player";

    await addWorkspaceMemberByUsername({
      actorUserId: auth.user.id,
      role,
      username: body.username,
      workspaceId
    });
    const view = await listWorkspaceMembers({
      actorUserId: auth.user.id,
      workspaceId
    });
    sendJson(response, 201, {
      members: view.members,
      workspace: {
        currentUserRole: view.currentUserRole,
        id: view.workspaceId,
        name: view.workspaceName,
        ownerUserId: view.ownerUserId,
        updatedAt: view.updatedAt
      }
    });
    return true;
  }

  return false;
}

async function handleWorkspaceMemberResourceRequest(request, response, match): Promise<boolean> {
  const auth = await requireAuth(request);
  const workspaceId = match[1];
  const targetUserId = match[2];

  if (request.method === "PATCH") {
    const body = await readBody(request);
    const role = isObject(body) ? parseWorkspaceMemberRole(body.role) : null;

    if (!role) {
      sendJson(response, 400, { error: "Invalid JSON body." });
      return true;
    }

    await updateWorkspaceMemberRole({
      actorUserId: auth.user.id,
      role,
      targetUserId,
      workspaceId
    });
    const view = await listWorkspaceMembers({
      actorUserId: auth.user.id,
      workspaceId
    });
    sendJson(response, 200, {
      members: view.members,
      workspace: {
        currentUserRole: view.currentUserRole,
        id: view.workspaceId,
        name: view.workspaceName,
        ownerUserId: view.ownerUserId,
        updatedAt: view.updatedAt
      }
    });
    return true;
  }

  if (request.method === "DELETE") {
    await removeWorkspaceMember({
      actorUserId: auth.user.id,
      targetUserId,
      workspaceId
    });
    const view = await listWorkspaceMembers({
      actorUserId: auth.user.id,
      workspaceId
    });
    sendJson(response, 200, {
      members: view.members,
      workspace: {
        currentUserRole: view.currentUserRole,
        id: view.workspaceId,
        name: view.workspaceName,
        ownerUserId: view.ownerUserId,
        updatedAt: view.updatedAt
      }
    });
    return true;
  }

  return false;
}

async function handleWorkspaceMapsCollectionRequest(request, response, match): Promise<boolean> {
  const auth = await requireAuth(request);
  const workspaceId = match[1];

  if (request.method === "GET") {
    const payload = await listWorkspaceMaps({
      userId: auth.user.id,
      workspaceId
    });
    sendJson(response, 200, {
      currentUserRole: payload.currentUserRole,
      maps: payload.maps,
      workspace: payload.workspace
    });
    return true;
  }

  if (request.method === "POST") {
    const body = await readBody(request);
    const map = await createMapInWorkspace({
      actorUserId: auth.user.id,
      content: isObject(body) && "content" in body ? parseContentInput(body.content) : defaultMapContent,
      name: sanitizeName(isObject(body) ? body.name : null),
      workspaceId
    });
    sendJson(response, 201, { map });
    return true;
  }

  return false;
}

async function handleWorkspaceMapImportRequest(request, response, match): Promise<boolean> {
  if (request.method !== "POST") {
    return false;
  }

  const auth = await requireAuth(request);
  const workspaceId = match[1];
  const body = await readBody(request);
  const map = await createMapInWorkspace({
    actorUserId: auth.user.id,
    content: parseContentInput(isObject(body) ? body.content : null),
    name: sanitizeName(isObject(body) ? body.name : null),
    workspaceId
  });
  sendJson(response, 201, { map });
  return true;
}

async function handleMapExportRequest(request, response, match): Promise<boolean> {
  if (request.method !== "GET") {
    return false;
  }

  const auth = await requireAuth(request);
  const map = await getMapRecordForUser(match[1], auth.user.id);

  if (!map) {
    sendJson(response, 404, { error: "Map not found." });
    return true;
  }

  sendJson(response, 200, { content: map.content, name: map.name });
  return true;
}

async function handleMapResourceRequest(request, response, url, match): Promise<boolean> {
  const auth = await requireAuth(request);
  const mapId = match[1];

  if (request.method === "GET") {
    const map = await getMapRecordForUser(mapId, auth.user.id);

    if (!map) {
      sendJson(response, 404, { error: "Map not found." });
      return true;
    }

    if (url.searchParams.get("role") === "gm" && !canOpenWorkspaceAsGM(map)) {
      sendJson(response, 403, { error: "GM access denied." });
      return true;
    }

    sendJson(response, 200, { map });
    return true;
  }

  if (request.method === "PATCH") {
    const body = await readBody(request);
    const map = await renameWorkspaceMap({
      actorUserId: auth.user.id,
      mapId,
      name: sanitizeName(isObject(body) ? body.name : null)
    });
    sendJson(response, 200, { map });
    return true;
  }

  if (request.method === "DELETE") {
    const deleted = await deleteWorkspaceMap({
      actorUserId: auth.user.id,
      mapId
    });

    if (deleted) {
      closeSession(mapId);
    }

    sendJson(response, deleted ? 200 : 404, deleted ? { deleted: true } : { error: "Map not found." });
    return true;
  }

  return false;
}

export function createHttpHandler() {
  return async (request, response) => {
    setCors(request, response);

    if (request.method === "OPTIONS") {
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
      if (await handleAuthRequest(request, response, url)) {
        return;
      }

      if (await handleWorkspaceCollectionRequest(request, response, url)) {
        return;
      }

      const membersMatch = url.pathname.match(workspaceMembersPathPattern);

      if (membersMatch && await handleWorkspaceMembersCollectionRequest(request, response, membersMatch)) {
        return;
      }

      const memberMatch = url.pathname.match(workspaceMemberPathPattern);

      if (memberMatch && await handleWorkspaceMemberResourceRequest(request, response, memberMatch)) {
        return;
      }

      const workspaceMapsImportMatch = url.pathname.match(workspaceMapsImportPathPattern);

      if (workspaceMapsImportMatch && await handleWorkspaceMapImportRequest(request, response, workspaceMapsImportMatch)) {
        return;
      }

      const workspaceMapsMatch = url.pathname.match(workspaceMapsPathPattern);

      if (workspaceMapsMatch && await handleWorkspaceMapsCollectionRequest(request, response, workspaceMapsMatch)) {
        return;
      }

      const mapExportMatch = url.pathname.match(mapExportPathPattern);

      if (mapExportMatch && await handleMapExportRequest(request, response, mapExportMatch)) {
        return;
      }

      const mapMatch = url.pathname.match(mapPathPattern);

      if (mapMatch && await handleMapResourceRequest(request, response, url, mapMatch)) {
        return;
      }

      const workspaceMatch = url.pathname.match(workspacePathPattern);

      if (workspaceMatch && await handleWorkspaceResourceRequest(request, response, workspaceMatch)) {
        return;
      }

      if (await handleStaticRequest(request, response, url)) {
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      const explicitStatus =
        error
        && typeof error === "object"
        && "statusCode" in error
        && Number.isInteger((error as { statusCode?: number }).statusCode)
        ? Number((error as { statusCode: number }).statusCode)
        : null;
      const statusCode = explicitStatus
        ?? (message === "Authentication required." ? 401 : null)
        ?? (message === "Invalid username or password." ? 401 : null)
        ?? (message === "Username is already taken." ? 409 : null)
        ?? (message === "Workspace not found." ? 404 : null)
        ?? (message === "Map not found." ? 404 : null)
        ?? (message === "GM access denied." ? 403 : null)
        ?? (message === "Owner access denied." ? 403 : null)
        ?? (message === "Cannot remove the workspace owner." ? 409 : null)
        ?? (message === "Cannot change the workspace owner role." ? 409 : null)
        ?? (message === "Workspace member not found." ? 404 : null)
        ?? (message === "User not found." ? 404 : null)
        ?? (message === "User is already in this workspace." ? 409 : null)
        ?? (message === "Invalid workspace role." ? 400 : null)
        ?? (message === "Username is required." ? 400 : null)
        ?? (message === "Invalid JSON body." ? 400 : null)
        ?? (message === "Request body too large." ? 413 : null)
        ?? 500;
      sendJson(response, statusCode, { error: message });
    }
  };
}
