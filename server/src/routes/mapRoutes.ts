import { canOpenWorkspaceAsGM } from "../../../src/core/auth/authTypes.js";
import { requireAuth } from "../services/authService.js";
import {
  createMapInWorkspace,
  deleteWorkspaceMap,
  getMapRecordForUser,
  renameWorkspaceMap,
} from "../repositories/mapRepository.js";
import { filterMapRecordForVisibilityMode } from "../repositories/mapVisibility.js";
import { listWorkspaceMaps } from "../repositories/workspaceRepository.js";
import { closeSession } from "../sessionStore.js";
import {
  defaultMapContent,
  parseContentInput,
  readBody,
  sendJson,
} from "./httpHelpers.js";
import {
  createMapBodySchema,
  renameMapBodySchema,
} from "../validation/httpSchemas.js";

const idPatternSource = "[a-zA-Z0-9_-]{1,80}";
export const workspaceMapsPathPattern = new RegExp(
  `^/api/workspaces/(${idPatternSource})/maps$`,
);
export const workspaceMapsImportPathPattern = new RegExp(
  `^/api/workspaces/(${idPatternSource})/maps/import$`,
);
export const mapPathPattern = new RegExp(`^/api/maps/(${idPatternSource})$`);
export const mapExportPathPattern = new RegExp(
  `^/api/maps/(${idPatternSource})/export$`,
);

export async function handleWorkspaceMapsCollectionRequest(
  request,
  response,
  match,
): Promise<boolean> {
  const auth = await requireAuth(request);
  const workspaceId = match[1];

  if (request.method === "GET") {
    const payload = await listWorkspaceMaps({
      userId: auth.user.id,
      workspaceId,
    });
    sendJson(response, 200, {
      currentUserRole: payload.currentUserRole,
      maps: payload.maps,
      workspace: payload.workspace,
    });
    return true;
  }

  if (request.method === "POST") {
    const body = createMapBodySchema.parse(await readBody(request));
    const map = await createMapInWorkspace({
      actorUserId: auth.user.id,
      content:
        body.content !== undefined
          ? parseContentInput(body.content)
          : defaultMapContent,
      name: body.name ?? "Untitled map",
      workspaceId,
    });
    sendJson(response, 201, { map });
    return true;
  }

  return false;
}

export async function handleWorkspaceMapImportRequest(
  request,
  response,
  match,
): Promise<boolean> {
  if (request.method !== "POST") {
    return false;
  }

  const auth = await requireAuth(request);
  const workspaceId = match[1];
  const body = createMapBodySchema.parse(await readBody(request));
  const map = await createMapInWorkspace({
    actorUserId: auth.user.id,
    content: parseContentInput(body.content),
    name: body.name ?? "Untitled map",
    workspaceId,
  });
  sendJson(response, 201, { map });
  return true;
}

export async function handleMapExportRequest(
  request,
  response,
  match,
): Promise<boolean> {
  if (request.method !== "GET") {
    return false;
  }

  const auth = await requireAuth(request);
  const map = await getMapRecordForUser(match[1], auth.user.id);

  if (!map) {
    sendJson(response, 404, { error: "Map not found." });
    return true;
  }

  const visibilityMode = canOpenWorkspaceAsGM(map) ? "gm" : "player";
  const visibleMap = filterMapRecordForVisibilityMode(map, visibilityMode);

  sendJson(response, 200, {
    content: visibleMap.content,
    name: visibleMap.name,
  });
  return true;
}

export async function handleMapResourceRequest(
  request,
  response,
  url,
  match,
): Promise<boolean> {
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

    const visibilityMode =
      url.searchParams.get("role") === "gm" ? "gm" : "player";

    sendJson(response, 200, {
      map: filterMapRecordForVisibilityMode(map, visibilityMode),
    });
    return true;
  }

  if (request.method === "PATCH") {
    const body = renameMapBodySchema.parse(await readBody(request));
    const map = await renameWorkspaceMap({
      actorUserId: auth.user.id,
      mapId,
      name: body.name ?? "Untitled map",
    });
    sendJson(response, 200, { map });
    return true;
  }

  if (request.method === "DELETE") {
    const deleted = await deleteWorkspaceMap({
      actorUserId: auth.user.id,
      mapId,
    });

    if (deleted) {
      closeSession(mapId);
    }

    sendJson(
      response,
      deleted ? 200 : 404,
      deleted ? { deleted: true } : { error: "Map not found." },
    );
    return true;
  }

  return false;
}
