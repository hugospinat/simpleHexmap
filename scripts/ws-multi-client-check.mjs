import { WebSocket } from "ws";

const base = process.env.BASE_URL ?? "http://localhost:8787";
const mapIdFromEnv = process.env.MAP_ID;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    reject(new Error(`${label} timed out after ${ms}ms`));
  }, ms);

  promise
    .then((value) => {
      clearTimeout(timer);
      resolve(value);
    })
    .catch((error) => {
      clearTimeout(timer);
      reject(error);
    });
});

const mapsResponse = await fetch(`${base}/api/maps`);
if (!mapsResponse.ok) {
  throw new Error(`Failed to list maps (${mapsResponse.status})`);
}

const mapsPayload = await mapsResponse.json();
const maps = Array.isArray(mapsPayload?.maps) ? mapsPayload.maps : [];
const mapId = mapIdFromEnv ?? maps[0]?.id;

if (!mapId) {
  throw new Error("No map available for multi-client check");
}

const wsUrl = `ws://localhost:8787/api/maps/${mapId}/ws`;
const clientAId = "stress-client-a";
const clientBId = "stress-client-b";
const now = Date.now();

const tileQ = 401;
const tileR = 601;
const featureId = `stress-feature-${now}`;
const factionId = `stress-faction-${now}`;

const operations = [
  {
    sender: "A",
    operationId: `${clientAId}-${now}-1`,
    operation: {
      type: "set_tile",
      tile: { q: tileQ, r: tileR, tileId: "plain", hidden: false }
    }
  },
  {
    sender: "B",
    operationId: `${clientBId}-${now}-2`,
    operation: {
      type: "set_cell_hidden",
      cell: { q: tileQ, r: tileR, hidden: true }
    }
  },
  {
    sender: "B",
    operationId: `${clientBId}-${now}-3`,
    operation: {
      type: "add_feature",
      feature: {
        id: featureId,
        type: "city",
        q: tileQ,
        r: tileR,
        visibility: "visible",
        overrideTerrainTile: true,
        gmLabel: "Stress City",
        playerLabel: "Unknown City",
        labelRevealed: false
      }
    }
  },
  {
    sender: "A",
    operationId: `${clientAId}-${now}-4`,
    operation: {
      type: "set_feature_hidden",
      featureId,
      hidden: true
    }
  },
  {
    sender: "A",
    operationId: `${clientAId}-${now}-5`,
    operation: {
      type: "add_faction",
      faction: {
        id: factionId,
        name: "Stress Faction",
        color: "#3366cc"
      }
    }
  },
  {
    sender: "B",
    operationId: `${clientBId}-${now}-6`,
    operation: {
      type: "set_faction_territory",
      territory: { q: tileQ, r: tileR, factionId }
    }
  },
  {
    sender: "B",
    operationId: `${clientBId}-${now}-7`,
    operation: {
      type: "set_cell_hidden",
      cell: { q: tileQ, r: tileR, hidden: false }
    }
  }
];

const events = [];

const connect = () => new Promise((resolve, reject) => {
  const ws = new WebSocket(wsUrl);
  ws.on("open", () => resolve(ws));
  ws.on("error", reject);
});

const [clientA, clientB] = await Promise.all([
  withTimeout(connect(), 5000, "clientA connect"),
  withTimeout(connect(), 5000, "clientB connect")
]);

const sockets = { A: clientA, B: clientB };

const attachListener = (clientName, socket) => {
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString("utf8"));

    if (message.type === "map_operation_applied") {
      events.push({
        client: clientName,
        operationId: message.operationId,
        operationType: message.operation?.type,
        sourceClientId: message.sourceClientId
      });
    }
  });
};

attachListener("A", clientA);
attachListener("B", clientB);

for (const item of operations) {
  const socket = sockets[item.sender];

  socket.send(JSON.stringify({
    type: "map_operation",
    operationId: item.operationId,
    operation: item.operation,
    clientId: item.sender === "A" ? clientAId : clientBId
  }));

  await sleep(220);
}

await sleep(1200);

const closeSocket = async (socket) => {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }

  const closePromise = new Promise((resolve) => {
    socket.once("close", () => resolve());
  });

  socket.close(1000, "done");

  try {
    await withTimeout(closePromise, 1500, "socket close");
  } catch {
    socket.terminate();
  }
};

await Promise.all([closeSocket(clientA), closeSocket(clientB)]);

const afterResponse = await fetch(`${base}/api/maps/${encodeURIComponent(mapId)}`);
const afterPayload = await afterResponse.json();
const content = afterPayload?.map?.content;

const tile = Array.isArray(content?.tiles)
  ? content.tiles.find((entry) => entry.q === tileQ && entry.r === tileR)
  : null;

const feature = Array.isArray(content?.features)
  ? content.features.find((entry) => entry.id === featureId)
  : null;

const faction = Array.isArray(content?.factions)
  ? content.factions.find((entry) => entry.id === factionId)
  : null;

const territory = Array.isArray(content?.factionTerritories)
  ? content.factionTerritories.find((entry) => entry.q === tileQ && entry.r === tileR)
  : null;

const operationEventCounts = Object.fromEntries(
  operations.map((item) => {
    const count = events.filter((event) => event.operationId === item.operationId).length;
    return [item.operationId, count];
  })
);

const validation = {
  mapId,
  tileExists: Boolean(tile),
  tileHiddenFalseAtEnd: tile?.hidden === false,
  featureExists: Boolean(feature),
  featureHiddenTrue: feature?.visibility === "hidden",
  factionExists: Boolean(faction),
  territoryAssigned: territory?.factionId === factionId,
  eventCounts: operationEventCounts
};

const hasEventCoverageGap = Object.values(operationEventCounts).some((count) => count < 2);
const failed = !validation.tileExists
  || !validation.tileHiddenFalseAtEnd
  || !validation.featureExists
  || !validation.featureHiddenTrue
  || !validation.factionExists
  || !validation.territoryAssigned
  || hasEventCoverageGap;

console.log(JSON.stringify({
  base,
  wsUrl,
  operationsSent: operations.length,
  totalEvents: events.length,
  validation,
  sampleEvents: events.slice(0, 20),
  passed: !failed
}, null, 2));

if (failed) {
  process.exitCode = 1;
}
