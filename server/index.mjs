import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

function resolvePort() {
  const raw = process.env.PORT;

  if (!raw) {
    return 8787;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 8787;
}

const port = resolvePort();
const mapsDir = path.resolve(process.cwd(), "data/maps");
const mapIdPatternSource = "[a-zA-Z0-9_-]{1,64}";
const mapIdPattern = new RegExp(`^${mapIdPatternSource}$`);
const maxRequestBodySizeBytes = 5 * 1024 * 1024;

const defaultMapContent = {
  version: 1,
  tiles: [{ q: 0, r: 0, tileId: "plain" }],
  features: [],
  rivers: [],
  factions: [],
  factionTerritories: []
};

function sanitizeName(value) {
  if (typeof value !== "string") {
    return "Untitled map";
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 120) : "Untitled map";
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function isValidMapContent(value) {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.version === "number"
    && Array.isArray(value.tiles)
    && Array.isArray(value.features)
    && Array.isArray(value.rivers)
    && Array.isArray(value.factions)
    && Array.isArray(value.factionTerritories)
  );
}

function mapPathFromId(mapId) {
  if (!mapIdPattern.test(mapId)) {
    return null;
  }

  return path.join(mapsDir, `${mapId}.json`);
}

function nowIso() {
  return new Date().toISOString();
}

function createMapId() {
  return randomUUID();
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readBody(request) {
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

async function ensureStorage() {
  await fs.mkdir(mapsDir, { recursive: true });
}

async function readMapFromFile(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(text);

  if (!isObject(parsed) || typeof parsed.id !== "string" || typeof parsed.name !== "string" || typeof parsed.updatedAt !== "string" || !isValidMapContent(parsed.content)) {
    throw new Error("Invalid map file format.");
  }

  return {
    id: parsed.id,
    name: parsed.name,
    updatedAt: parsed.updatedAt,
    content: parsed.content
  };
}

async function writeMapToFile(mapRecord) {
  const filePath = mapPathFromId(mapRecord.id);

  if (!filePath) {
    throw new Error("Invalid map id.");
  }

  const payload = `${JSON.stringify(mapRecord, null, 2)}\n`;
  await fs.writeFile(filePath, payload, "utf8");
}

async function listMaps() {
  await ensureStorage();

  const entries = await fs.readdir(mapsDir, { withFileTypes: true });
  const summaries = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const fullPath = path.join(mapsDir, entry.name);

    try {
      const map = await readMapFromFile(fullPath);
      summaries.push({ id: map.id, name: map.name, updatedAt: map.updatedAt });
    } catch {
      // Ignore malformed files.
    }
  }

  summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return summaries;
}

async function getMap(mapId) {
  const filePath = mapPathFromId(mapId);

  if (!filePath) {
    return null;
  }

  try {
    return await readMapFromFile(filePath);
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
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
    if (request.method === "GET" && url.pathname === "/api/maps") {
      const maps = await listMaps();
      sendJson(response, 200, { maps });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/maps") {
      const body = await readBody(request);
      const name = sanitizeName(body.name);
      const content = isValidMapContent(body.content) ? body.content : defaultMapContent;
      const map = {
        id: createMapId(),
        name,
        updatedAt: nowIso(),
        content
      };

      await ensureStorage();
      await writeMapToFile(map);
      sendJson(response, 201, { map });
      return;
    }

    const mapMatch = url.pathname.match(new RegExp(`^/api/maps/(${mapIdPatternSource})$`));

    if (mapMatch && request.method === "GET") {
      const map = await getMap(mapMatch[1]);

      if (!map) {
        sendJson(response, 404, { error: "Map not found." });
        return;
      }

      sendJson(response, 200, { map });
      return;
    }

    if (mapMatch && request.method === "PUT") {
      const mapId = mapMatch[1];
      const existing = await getMap(mapId);

      if (!existing) {
        sendJson(response, 404, { error: "Map not found." });
        return;
      }

      const body = await readBody(request);

      if (!isValidMapContent(body.content)) {
        sendJson(response, 400, { error: "Invalid map content." });
        return;
      }

      const map = {
        id: mapId,
        name: typeof body.name === "string" && body.name.trim()
          ? sanitizeName(body.name)
          : existing.name,
        updatedAt: nowIso(),
        content: body.content
      };

      await writeMapToFile(map);
      sendJson(response, 200, { map });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`Map server listening on http://localhost:${port}`);
});
