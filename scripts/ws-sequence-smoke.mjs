import {
  closeSocket,
  connectMapSocket,
  createSmokeAccount,
  createWorkspace,
  createWorkspaceMap,
  deleteWorkspace,
  waitForClose,
} from "./ws-smoke-helpers.mjs";

const base = process.env.BASE_URL ?? "http://localhost:8787";

async function main() {
  const account = await createSmokeAccount(base, "seq-smoke");
  const workspace = await createWorkspace(
    base,
    account.cookie,
    "Sequence Smoke Workspace",
  );
  const map = await createWorkspaceMap(
    base,
    account.cookie,
    workspace.id,
    "Sequence Smoke Map",
  );
  const ws = await connectMapSocket(base, account.cookie, map.id);
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
            type: "set_cells_hidden",
            cells: [{ q: 0, r: 0 }],
            hidden: true,
          },
        }),
      );
      ws.send(
        JSON.stringify({
          type: "map_operation",
          clientId,
          operationId: operationId2,
          operation: {
            type: "set_cells_hidden",
            cells: [{ q: 0, r: 0 }],
            hidden: false,
          },
        }),
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
          mapId: map.id,
          lastSequence: snapshot.lastSequence,
          sequences: applied.map((entry) => entry.sequence),
          okOrder,
          operationIds: applied.map((entry) => entry.operationId),
        },
        null,
        2,
      ),
    );

    ws.close(1000, "done");
  });

  try {
    await waitForClose(ws);
  } finally {
    await closeSocket(ws);
    await deleteWorkspace(base, account.cookie, workspace.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
