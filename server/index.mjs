import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";

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
const persistDebounceMs = 400;
const maxRememberedOperationIds = 5000;

const defaultMapContent = {
  version: 1,
  tiles: [{ q: 0, r: 0, tileId: "plain", hidden: false }],
  features: [],
  rivers: [],
  roads: [],
  factions: [],
  factionTerritories: []
};

const mapSessions = new Map();

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

function isInteger(value) {
  return typeof value === "number" && Number.isInteger(value);
}

function isRoadOrRiverEdge(value) {
  return isInteger(value) && value >= 0 && value <= 5;
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
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

function normalizeMapContent(content) {
  const roads = Array.isArray(content.roads) ? content.roads : [];

  return {
    version: content.version,
    tiles: Array.isArray(content.tiles)
      ? content.tiles.map((tile) => ({
          ...tile,
          hidden: typeof tile.hidden === "boolean" ? tile.hidden : false
        }))
      : [],
    features: Array.isArray(content.features)
      ? content.features.map((feature, index) => ({
          ...feature,
          id: typeof feature.id === "string" && feature.id.trim()
            ? feature.id
            : `loaded-feature-${index}-${feature.q}-${feature.r}`
        }))
      : [],
    rivers: Array.isArray(content.rivers) ? content.rivers : [],
    roads,
    factions: Array.isArray(content.factions) ? content.factions : [],
    factionTerritories: Array.isArray(content.factionTerritories) ? content.factionTerritories : []
  };
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

function createOperationId() {
  return `op-${randomUUID()}`;
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
    content: normalizeMapContent(parsed.content)
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
  const summariesById = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const fullPath = path.join(mapsDir, entry.name);

    try {
      const map = await readMapFromFile(fullPath);
      summariesById.set(map.id, { id: map.id, name: map.name, updatedAt: map.updatedAt });
    } catch {
      // Ignore malformed files.
    }
  }

  for (const session of mapSessions.values()) {
    summariesById.set(session.map.id, {
      id: session.map.id,
      name: session.map.name,
      updatedAt: session.map.updatedAt
    });
  }

  const summaries = Array.from(summariesById.values());
  summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return summaries;
}

async function getMap(mapId) {
  const session = mapSessions.get(mapId);

  if (session) {
    return session.map;
  }

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

function tileKey(q, r) {
  return `${q},${r}`;
}

function riverKey(river) {
  return `${river.q},${river.r},${river.edge}`;
}

function roadKey(road) {
  return `${road.q},${road.r}`;
}

function cloneContent(content) {
  return {
    version: content.version,
    tiles: [...content.tiles],
    features: [...content.features],
    rivers: [...content.rivers],
    roads: [...content.roads],
    factions: [...content.factions],
    factionTerritories: [...content.factionTerritories]
  };
}

function validateMapOperation(operation) {
  if (!isObject(operation) || typeof operation.type !== "string") {
    return "Invalid operation payload.";
  }

  if (operation.type === "set_tile") {
    const tile = operation.tile;

    if (
      !isObject(tile)
      || !isInteger(tile.q)
      || !isInteger(tile.r)
      || typeof tile.hidden !== "boolean"
      || (tile.tileId !== null && typeof tile.tileId !== "string")
    ) {
      return "Invalid set_tile operation.";
    }

    return null;
  }

  if (operation.type === "set_cell_hidden") {
    const cell = operation.cell;

    if (!isObject(cell) || !isInteger(cell.q) || !isInteger(cell.r) || typeof cell.hidden !== "boolean") {
      return "Invalid set_cell_hidden operation.";
    }

    return null;
  }

  if (operation.type === "add_feature") {
    const feature = operation.feature;

    if (!isObject(feature) || typeof feature.id !== "string" || !isInteger(feature.q) || !isInteger(feature.r) || typeof feature.type !== "string") {
      return "Invalid add_feature operation.";
    }

    return null;
  }

  if (operation.type === "update_feature") {
    if (typeof operation.featureId !== "string" || !isObject(operation.patch) || Object.keys(sanitizeFeaturePatch(operation.patch)).length === 0) {
      return "Invalid update_feature operation.";
    }

    return null;
  }

  if (operation.type === "set_feature_hidden") {
    if (typeof operation.featureId !== "string" || typeof operation.hidden !== "boolean") {
      return "Invalid set_feature_hidden operation.";
    }

    return null;
  }

  if (operation.type === "remove_feature") {
    return typeof operation.featureId === "string" ? null : "Invalid remove_feature operation.";
  }

  if (operation.type === "add_river_data" || operation.type === "remove_river_data") {
    const river = operation.river;

    if (!isObject(river) || !isInteger(river.q) || !isInteger(river.r) || !isRoadOrRiverEdge(river.edge)) {
      return `Invalid ${operation.type} operation.`;
    }

    return null;
  }

  if (operation.type === "update_river_data") {
    const from = operation.from;
    const to = operation.to;

    if (
      !isObject(from)
      || !isObject(to)
      || !isInteger(from.q)
      || !isInteger(from.r)
      || !isRoadOrRiverEdge(from.edge)
      || !isInteger(to.q)
      || !isInteger(to.r)
      || !isRoadOrRiverEdge(to.edge)
    ) {
      return "Invalid update_river_data operation.";
    }

    return null;
  }

  if (operation.type === "add_road_data" || operation.type === "update_road_data") {
    const road = operation.road;

    if (!isObject(road) || !isInteger(road.q) || !isInteger(road.r) || !Array.isArray(road.edges) || !road.edges.every(isRoadOrRiverEdge)) {
      return `Invalid ${operation.type} operation.`;
    }

    return null;
  }

  if (operation.type === "remove_road_data") {
    const road = operation.road;

    if (!isObject(road) || !isInteger(road.q) || !isInteger(road.r)) {
      return "Invalid remove_road_data operation.";
    }

    return null;
  }

  if (operation.type === "add_faction") {
    const faction = operation.faction;

    if (!isObject(faction) || typeof faction.id !== "string" || typeof faction.name !== "string" || typeof faction.color !== "string" || !isHexColor(faction.color)) {
      return "Invalid add_faction operation.";
    }

    return null;
  }

  if (operation.type === "update_faction") {
    if (typeof operation.factionId !== "string" || !isObject(operation.patch) || Object.keys(sanitizeFactionPatch(operation.patch)).length === 0) {
      return "Invalid update_faction operation.";
    }

    return null;
  }

  if (operation.type === "remove_faction") {
    return typeof operation.factionId === "string" ? null : "Invalid remove_faction operation.";
  }

  if (operation.type === "set_faction_territory") {
    const territory = operation.territory;

    if (!isObject(territory) || !isInteger(territory.q) || !isInteger(territory.r) || (territory.factionId !== null && typeof territory.factionId !== "string")) {
      return "Invalid set_faction_territory operation.";
    }

    return null;
  }

  if (operation.type === "rename_map") {
    return typeof operation.name === "string" ? null : "Invalid rename_map operation.";
  }

  return "Unknown operation type.";
}

function sanitizeFeaturePatch(patch) {
  const next = {};

  if (typeof patch.type === "string") {
    next.type = patch.type;
  }
  if (patch.visibility === "visible" || patch.visibility === "hidden") {
    next.visibility = patch.visibility;
  }
  if (typeof patch.overrideTerrainTile === "boolean") {
    next.overrideTerrainTile = patch.overrideTerrainTile;
  }
  if (typeof patch.gmLabel === "string" || patch.gmLabel === null) {
    next.gmLabel = patch.gmLabel;
  }
  if (typeof patch.playerLabel === "string" || patch.playerLabel === null) {
    next.playerLabel = patch.playerLabel;
  }
  if (typeof patch.labelRevealed === "boolean") {
    next.labelRevealed = patch.labelRevealed;
  }

  return next;
}

function sanitizeFactionPatch(patch) {
  const next = {};

  if (typeof patch.name === "string" && patch.name.trim()) {
    next.name = patch.name.trim();
  }
  if (typeof patch.color === "string" && isHexColor(patch.color)) {
    next.color = patch.color;
  }

  return next;
}

function applyOperationToContent(content, operation) {
  const next = cloneContent(content);

  if (operation.type === "set_tile") {
    const key = tileKey(operation.tile.q, operation.tile.r);
    next.tiles = next.tiles.filter((tile) => tileKey(tile.q, tile.r) !== key);

    if (operation.tile.tileId !== null) {
      next.tiles.push({
        hidden: operation.tile.hidden,
        q: operation.tile.q,
        r: operation.tile.r,
        tileId: operation.tile.tileId
      });
    } else {
      next.factionTerritories = next.factionTerritories.filter((territory) => tileKey(territory.q, territory.r) !== key);
    }

    return next;
  }

  if (operation.type === "set_cell_hidden") {
    next.tiles = next.tiles.map((tile) => (
      tile.q === operation.cell.q && tile.r === operation.cell.r
        ? { ...tile, hidden: operation.cell.hidden }
        : tile
    ));
    return next;
  }

  if (operation.type === "add_feature") {
    if (!next.features.some((feature) => feature.id === operation.feature.id)) {
      next.features.push(operation.feature);
    }

    return next;
  }

  if (operation.type === "update_feature") {
    const patch = sanitizeFeaturePatch(operation.patch);
    next.features = next.features.map((feature) => (
      feature.id === operation.featureId
        ? { ...feature, ...patch }
        : feature
    ));

    return next;
  }

  if (operation.type === "set_feature_hidden") {
    next.features = next.features.map((feature) => (
      feature.id === operation.featureId
        ? { ...feature, visibility: operation.hidden ? "hidden" : "visible" }
        : feature
    ));
    return next;
  }

  if (operation.type === "remove_feature") {
    next.features = next.features.filter((feature) => feature.id !== operation.featureId);
    return next;
  }

  if (operation.type === "add_river_data") {
    const key = riverKey(operation.river);

    if (!next.rivers.some((river) => riverKey(river) === key)) {
      next.rivers.push(operation.river);
    }

    return next;
  }

  if (operation.type === "update_river_data") {
    const fromKey = riverKey(operation.from);
    next.rivers = next.rivers.filter((river) => riverKey(river) !== fromKey);

    if (!next.rivers.some((river) => riverKey(river) === riverKey(operation.to))) {
      next.rivers.push(operation.to);
    }

    return next;
  }

  if (operation.type === "remove_river_data") {
    next.rivers = next.rivers.filter((river) => riverKey(river) !== riverKey(operation.river));
    return next;
  }

  if (operation.type === "add_road_data" || operation.type === "update_road_data") {
    const normalizedRoad = {
      q: operation.road.q,
      r: operation.road.r,
      edges: Array.from(new Set(operation.road.edges)).sort((left, right) => left - right)
    };
    const key = roadKey(normalizedRoad);
    next.roads = next.roads.filter((road) => roadKey(road) !== key);
    next.roads.push(normalizedRoad);
    return next;
  }

  if (operation.type === "remove_road_data") {
    next.roads = next.roads.filter((road) => roadKey(road) !== roadKey(operation.road));
    return next;
  }

  if (operation.type === "add_faction") {
    if (!next.factions.some((faction) => faction.id === operation.faction.id)) {
      next.factions.push(operation.faction);
    }

    return next;
  }

  if (operation.type === "update_faction") {
    const patch = sanitizeFactionPatch(operation.patch);
    next.factions = next.factions.map((faction) => (
      faction.id === operation.factionId
        ? { ...faction, ...patch }
        : faction
    ));

    return next;
  }

  if (operation.type === "remove_faction") {
    next.factions = next.factions.filter((faction) => faction.id !== operation.factionId);
    next.factionTerritories = next.factionTerritories.filter((territory) => territory.factionId !== operation.factionId);
    return next;
  }

  if (operation.type === "set_faction_territory") {
    const key = tileKey(operation.territory.q, operation.territory.r);
    next.factionTerritories = next.factionTerritories.filter((territory) => tileKey(territory.q, territory.r) !== key);

    if (operation.territory.factionId) {
      next.factionTerritories.push(operation.territory);
    }

    return next;
  }

  if (operation.type === "rename_map") {
    return next;
  }

  return next;
}

function schedulePersist(session) {
  if (session.persistTimer) {
    clearTimeout(session.persistTimer);
  }

  session.persistTimer = setTimeout(async () => {
    session.persistTimer = null;

    try {
      await writeMapToFile(session.map);
    } catch (error) {
      console.error("Failed to persist map", session.map.id, error);
    }
  }, persistDebounceMs);
}

function rememberAppliedOperation(session, operationId, payload) {
  if (session.appliedOperationPayloads.has(operationId)) {
    return;
  }

  session.appliedOperationPayloads.set(operationId, payload);
  session.appliedOperationOrder.push(operationId);

  if (session.appliedOperationOrder.length > maxRememberedOperationIds) {
    const removed = session.appliedOperationOrder.shift();

    if (removed) {
      session.appliedOperationPayloads.delete(removed);
    }
  }
}

function broadcastPayload(session, payload) {
  for (const client of session.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      continue;
    }

    client.send(payload);
  }
}

async function getOrCreateSession(mapId) {
  const existing = mapSessions.get(mapId);

  if (existing) {
    return existing;
  }

  const map = await getMap(mapId);

  if (!map) {
    return null;
  }

  const session = {
    map,
    clients: new Set(),
    persistTimer: null,
    appliedOperationPayloads: new Map(),
    appliedOperationOrder: []
  };
  mapSessions.set(mapId, session);
  return session;
}

async function applyOperationToSession(mapId, operation, sourceClientId, operationId, sourceSocket = null) {
  if (typeof operationId !== "string" || !operationId.trim()) {
    throw new Error("Invalid operation id.");
  }

  const validationError = validateMapOperation(operation);

  if (validationError) {
    throw new Error(validationError);
  }

  const session = await getOrCreateSession(mapId);

  if (!session) {
    throw new Error("Map not found.");
  }

  const existingPayload = session.appliedOperationPayloads.get(operationId);

  if (existingPayload) {
    console.info("[MapSyncServer] operation_duplicate", {
      mapId,
      operationId,
      sourceClientId,
      operationType: operation.type
    });

    if (sourceSocket && sourceSocket.readyState === WebSocket.OPEN) {
      sourceSocket.send(existingPayload);
    } else {
      broadcastPayload(session, existingPayload);
    }

    return session.map;
  }

  console.info("[MapSyncServer] operation_received", {
    mapId,
    operationId,
    sourceClientId,
    operationType: operation.type
  });

  if (operation.type === "rename_map") {
    session.map = {
      ...session.map,
      name: sanitizeName(operation.name),
      updatedAt: nowIso()
    };
  } else {
    session.map = {
      ...session.map,
      updatedAt: nowIso(),
      content: applyOperationToContent(session.map.content, operation)
    };
  }

  schedulePersist(session);

  const payload = JSON.stringify({
    type: "map_operation_applied",
    operationId,
    operation,
    sourceClientId,
    updatedAt: session.map.updatedAt
  });

  rememberAppliedOperation(session, operationId, payload);
  broadcastPayload(session, payload);

  console.info("[MapSyncServer] operation_broadcast", {
    mapId,
    operationId,
    sourceClientId,
    operationType: operation.type,
    clients: session.clients.size,
    updatedAt: session.map.updatedAt
  });

  return session.map;
}

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
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

    if (mapMatch && request.method === "PATCH") {
      const mapId = mapMatch[1];
      const body = await readBody(request);
      const session = await getOrCreateSession(mapId);

      if (!session) {
        sendJson(response, 404, { error: "Map not found." });
        return;
      }

      const operation = {
        type: "rename_map",
        name: sanitizeName(body.name)
      };
      const updated = await applyOperationToSession(mapId, operation, "http", createOperationId());
      await writeMapToFile(updated);
      sendJson(response, 200, { map: updated });
      return;
    }

    sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    sendJson(response, 500, { error: message });
  }
});

const webSocketServer = new WebSocketServer({ noServer: true });

server.on("upgrade", async (request, socket, head) => {
  try {
    if (!request.url) {
      socket.destroy();
      return;
    }

    const url = new URL(request.url, "http://localhost");
    const match = url.pathname.match(new RegExp(`^/api/maps/(${mapIdPatternSource})/ws$`));

    if (!match) {
      socket.destroy();
      return;
    }

    const mapId = match[1];
    const session = await getOrCreateSession(mapId);

    if (!session) {
      socket.destroy();
      return;
    }

    webSocketServer.handleUpgrade(request, socket, head, (client) => {
      session.clients.add(client);

      client.on("close", () => {
        session.clients.delete(client);
      });

      client.on("message", async (raw) => {
        try {
          const message = JSON.parse(raw.toString("utf8"));

          if (
            !isObject(message)
            || message.type !== "map_operation"
            || !isObject(message.operation)
            || typeof message.clientId !== "string"
            || typeof message.operationId !== "string"
            || !message.operationId.trim()
          ) {
            console.warn("[MapSyncServer] invalid_operation_message", {
              mapId,
              raw: raw.toString("utf8")
            });
            return;
          }

          await applyOperationToSession(mapId, message.operation, message.clientId, message.operationId, client);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Invalid map operation.";
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: "sync_error", error: detail }));
          }
        }
      });
    });
  } catch {
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`Map server listening on http://localhost:${port}`);
});
