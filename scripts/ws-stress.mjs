import {
  closeSocket,
  connectMapSocket,
  createSmokeAccount,
  createWorkspace,
  createWorkspaceMap,
  deleteWorkspace,
  loadMap,
  sleep,
} from "./ws-smoke-helpers.mjs";

const base = process.env.BASE_URL ?? "http://localhost:8787";

async function main() {
  const account = await createSmokeAccount(base, "ws-stress");
  const workspace = await createWorkspace(base, account.cookie, "WS Stress Workspace");
  const map = await createWorkspaceMap(base, account.cookie, workspace.id, "WS Stress Map");
  const clientAId = "stress-client-a";
  const operationId = `${clientAId}-${Date.now()}-1`;
  const operation = {
    type: "set_tiles",
    tiles: [{ q: 321, r: 654, terrain: "plain", hidden: false }],
  };
  const events = [];
  const clientA = await connectMapSocket(base, account.cookie, map.id);
  const clientB = await connectMapSocket(base, account.cookie, map.id);

  const attachListener = (clientName, socket) => {
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString("utf8"));

      if (message.type === "map_operation_applied") {
        events.push({
          client: clientName,
          operationId: message.operationId,
          sourceClientId: message.sourceClientId,
          operationType: message.operation?.type,
        });
      }
    });
  };

  try {
    attachListener("A", clientA);
    attachListener("B", clientB);

    const outbound = {
      type: "map_operation",
      operationId,
      clientId: clientAId,
      operation,
    };

    clientA.send(JSON.stringify(outbound));
    await sleep(250);
    clientA.send(JSON.stringify(outbound));
    await sleep(900);

    const afterPayload = await loadMap(base, account.cookie, map.id, "gm");
    const tileExists =
      Array.isArray(afterPayload?.content?.tiles) &&
      afterPayload.content.tiles.some(
        (tile) => tile.q === 321 && tile.r === 654 && tile.terrain === "plain",
      );

    const byClient = events.reduce((accumulator, event) => {
      accumulator[event.client] = (accumulator[event.client] ?? 0) + 1;
      return accumulator;
    }, {});

    console.log(
      JSON.stringify(
        {
          mapId: map.id,
          operationId,
          totalEvents: events.length,
          byClient,
          firstEvents: events.slice(0, 8),
          tileExists,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all([closeSocket(clientA), closeSocket(clientB)]);
    await deleteWorkspace(base, account.cookie, workspace.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
