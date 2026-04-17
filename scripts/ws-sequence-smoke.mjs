import { WebSocket } from "ws";

const base = process.env.BASE_URL ?? "http://localhost:8790";

function waitForClose(socket, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("WebSocket close timeout"));
    }, timeoutMs);

    socket.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

async function main() {
  const mapsPayload = await fetch(`${base}/api/maps`).then((response) => response.json());
  const mapId = mapsPayload?.maps?.[0]?.id;

  if (!mapId) {
    throw new Error("No map found for smoke test");
  }

  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/api/maps/${mapId}/ws`);
  const clientId = `seq-smoke-${Date.now()}`;
  const operationId1 = `${clientId}-1`;
  const operationId2 = `${clientId}-2`;
  let snapshot = null;
  const applied = [];

  ws.on("message", (raw) => {
    const message = JSON.parse(raw.toString("utf8"));

    if (message.type === "sync_snapshot") {
      snapshot = message;
      ws.send(
        JSON.stringify({
          type: "map_operation",
          clientId,
          operationId: operationId1,
          operation: {
            type: "set_cell_hidden",
            cell: { q: 0, r: 0, hidden: true }
          }
        })
      );
      ws.send(
        JSON.stringify({
          type: "map_operation",
          clientId,
          operationId: operationId2,
          operation: {
            type: "set_cell_hidden",
            cell: { q: 0, r: 0, hidden: false }
          }
        })
      );
      return;
    }

    if (message.type !== "map_operation_applied") {
      return;
    }

    if (message.operationId !== operationId1 && message.operationId !== operationId2) {
      return;
    }

    applied.push(message);

    if (applied.length < 2 || !snapshot) {
      return;
    }

    const okOrder =
      applied[0].sequence === snapshot.lastSequence + 1
      && applied[1].sequence === applied[0].sequence + 1;

    console.log(
      JSON.stringify(
        {
          mapId,
          lastSequence: snapshot.lastSequence,
          sequences: applied.map((entry) => entry.sequence),
          okOrder,
          operationIds: applied.map((entry) => entry.operationId)
        },
        null,
        2
      )
    );

    ws.close(1000, "done");
  });

  await waitForClose(ws);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
