import {
  createMapId,
  createOperationId,
  defaultMapContent,
  isValidMapContent,
  mapIdPatternSource,
  nowIso,
  sanitizeName,
  writeMapToFile
} from "./mapStorage.js";
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

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.end(`${JSON.stringify(payload)}\n`);
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
    const map = {
      id: createMapId(),
      name: sanitizeName(body.name),
      updatedAt: nowIso(),
      content: isValidMapContent(body.content) ? body.content : defaultMapContent
    };

    await writeMapToFile(map);
    sendJson(response, 201, { map });
    return true;
  }

  return false;
}

async function handleMapResourceRequest(request, response, mapId) {
  if (request.method === "GET") {
    const map = await getMap(mapId);

    if (!map) {
      sendJson(response, 404, { error: "Map not found." });
      return true;
    }

    sendJson(response, 200, { map });
    return true;
  }

  if (request.method === "PATCH") {
    const body = await readBody(request);
    const session = await getOrCreateSession(mapId);

    if (!session) {
      sendJson(response, 404, { error: "Map not found." });
      return true;
    }

    const operation = {
      type: "rename_map",
      name: sanitizeName(body.name)
    } as const;
    const updated = await applyOperationToSession(mapId, operation, "http", createOperationId());
    await writeMapToFile(updated);
    sendJson(response, 200, { map: updated });
    return true;
  }

  if (request.method === "DELETE") {
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
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
      if (url.pathname === "/api/maps" && await handleMapCollectionRequest(request, response)) {
        return;
      }

      const mapMatch = url.pathname.match(mapPathPattern);

      if (mapMatch && await handleMapResourceRequest(request, response, mapMatch[1])) {
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      sendJson(response, 500, { error: message });
    }
  };
}

