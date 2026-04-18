import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import {
  createMapId,
  createOperationId,
  createDefaultMapPermissions,
  defaultMapContent,
  isObject,
  mapIdPatternSource,
  nowIso,
  normalizeMapContent,
  sanitizeName,
  writeMapToFile
} from "./mapStorage.js";
import { ensureProfile, listProfiles } from "./profileStorage.js";
import { canOpenMapAsGM } from "../../src/core/profile/profileTypes.js";
import {
  applyOperationToSession,
} from "./operationService.js";
import {
  deleteMap,
  getMap,
  getOrCreateSession,
  listMaps
} from "./sessionStore.js";

const maxRequestBodySizeBytes = 5 * 1024 * 1024;
const mapPathPattern = new RegExp(`^/api/maps/(${mapIdPatternSource})$`);
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

function getRequestProfileId(request): string | null {
  const header = request.headers["x-profile-id"];
  return typeof header === "string" && header.trim() ? header : null;
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
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

    request.on("data", (chunk) => {
      data += chunk;

      if (data.length > maxRequestBodySizeBytes) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      if (!data.trim()) {
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(data);
        resolve(parsed);
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

async function handleMapCollectionRequest(request, response) {
  if (request.method === "GET") {
    const maps = await listMaps();
    sendJson(response, 200, { maps });
    return true;
  }

  if (request.method === "POST") {
    const body = await readBody(request);
    const profileId = getRequestProfileId(request);

    if (!profileId) {
      sendJson(response, 400, { error: "Missing profile id." });
      return true;
    }

    await ensureProfile({ profileId });
    let content = defaultMapContent;

    try {
      content = normalizeMapContent(body.content);
    } catch {
      content = defaultMapContent;
    }

    const map = {
      id: createMapId(),
      name: sanitizeName(body.name),
      updatedAt: nowIso(),
      permissions: createDefaultMapPermissions(profileId),
      content
    };

    await writeMapToFile(map);
    sendJson(response, 201, { map });
    return true;
  }

  return false;
}

async function handleMapResourceRequest(request, response, mapId) {
  if (request.method === "GET") {
    const profileId = getRequestProfileId(request);
    const map = await getMap(mapId, profileId ?? undefined);

    if (!map) {
      sendJson(response, 404, { error: "Map not found." });
      return true;
    }

    const url = new URL(request.url ?? "", "http://localhost");

    if (url.searchParams.get("role") === "gm" && (!profileId || !canOpenMapAsGM(profileId, map.permissions))) {
      sendJson(response, 403, { error: "GM access denied." });
      return true;
    }

    sendJson(response, 200, { map });
    return true;
  }

  if (request.method === "PATCH") {
    const body = await readBody(request);
    const profileId = getRequestProfileId(request);
    const session = await getOrCreateSession(mapId, profileId ?? undefined);

    if (!session) {
      sendJson(response, 404, { error: "Map not found." });
      return true;
    }

    if (!profileId || !canOpenMapAsGM(profileId, session.map.permissions)) {
      sendJson(response, 403, { error: "GM access denied." });
      return true;
    }

    const operation = {
      type: "rename_map",
      name: sanitizeName(body.name)
    } as const;
    const updated = await applyOperationToSession(mapId, operation, "http", createOperationId(), null, profileId);
    await writeMapToFile(updated);
    sendJson(response, 200, { map: updated });
    return true;
  }

  if (request.method === "DELETE") {
    const profileId = getRequestProfileId(request);
    const map = await getMap(mapId, profileId ?? undefined);

    if (!map) {
      sendJson(response, 404, { error: "Map not found." });
      return true;
    }

    if (!profileId || map.permissions.ownerProfileId !== profileId) {
      sendJson(response, 403, { error: "Owner access denied." });
      return true;
    }

    const deleted = await deleteMap(mapId);

    if (!deleted) {
      sendJson(response, 404, { error: "Map not found." });
      return true;
    }

    sendJson(response, 200, { deleted: true });
    return true;
  }

  return false;
}

export function createHttpHandler() {
  return async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Profile-Id");

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
      if (url.pathname === "/api/profiles" && request.method === "GET") {
        const profiles = await listProfiles();
        sendJson(response, 200, { profiles });
        return;
      }

      if (url.pathname === "/api/profiles" && request.method === "POST") {
        const body = await readBody(request);
        const profile = await ensureProfile({
          profileId: isObject(body) ? body.profileId : undefined,
          username: isObject(body) ? body.username : undefined
        });
        sendJson(response, 200, { profile });
        return;
      }

      if (url.pathname === "/api/maps" && await handleMapCollectionRequest(request, response)) {
        return;
      }

      const mapMatch = url.pathname.match(mapPathPattern);

      if (mapMatch && await handleMapResourceRequest(request, response, mapMatch[1])) {
        return;
      }

      if (await handleStaticRequest(request, response, url)) {
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      sendJson(response, 500, { error: message });
    }
  };
}

