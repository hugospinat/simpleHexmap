import { WebSocket } from "ws";

const base = "http://localhost:8787";
const mapsResponse = await fetch(base + "/api/maps");
const { maps } = await mapsResponse.json();

if (!Array.isArray(maps) || maps.length === 0) {
  throw new Error("No maps available for stress test");
}

const mapId = maps[0].id;
const wsUrl = `ws://localhost:8787/api/maps/${mapId}/ws`;
const clientAId = "stress-client-a";
const clientBId = "stress-client-b";
const operationId = `${clientAId}-${Date.now()}-1`;
const operation = { type: "set_tile", tile: { q: 321, r: 654, tileId: "plain", hidden: false } };
const events = [];

const connect = () => new Promise((resolve, reject) => {
  const ws = new WebSocket(wsUrl);
  ws.on("open", () => resolve(ws));
  ws.on("error", reject);
});

const [clientA, clientB] = await Promise.all([connect(), connect()]);

const attachListener = (clientName, socket) => {
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString("utf8"));

    if (message.type === "map_operation_applied") {
      events.push({
        client: clientName,
        operationId: message.operationId,
        sourceClientId: message.sourceClientId,
        operationType: message.operation?.type
      });
    }
  });
};

attachListener("A", clientA);
attachListener("B", clientB);

const outbound = {
  type: "map_operation",
  operationId,
  clientId: clientAId,
  operation
};

clientA.send(JSON.stringify(outbound));
await new Promise((resolve) => setTimeout(resolve, 250));
clientA.send(JSON.stringify(outbound));
await new Promise((resolve) => setTimeout(resolve, 900));

clientA.close(1000, "done");
clientB.close(1000, "done");

const afterResponse = await fetch(base + "/api/maps/" + encodeURIComponent(mapId));
const afterPayload = await afterResponse.json();
const tileExists = Array.isArray(afterPayload?.map?.content?.tiles)
  && afterPayload.map.content.tiles.some((tile) => tile.q === 321 && tile.r === 654 && tile.tileId === "plain");

const byClient = events.reduce((accumulator, event) => {
  accumulator[event.client] = (accumulator[event.client] ?? 0) + 1;
  return accumulator;
}, {});

console.log(JSON.stringify({
  mapId,
  wsUrl,
  operationId,
  totalEvents: events.length,
  byClient,
  firstEvents: events.slice(0, 8),
  tileExists
}, null, 2));
