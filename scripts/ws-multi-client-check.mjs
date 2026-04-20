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
  const account = await createSmokeAccount(base, "multi-client");
  const workspace = await createWorkspace(
    base,
    account.cookie,
    "Multi Client Workspace",
  );
  const map = await createWorkspaceMap(
    base,
    account.cookie,
    workspace.id,
    "Multi Client Map",
  );
  const wsUrl = `${base.replace(/^http/, "ws")}/api/maps/${map.id}/ws`;
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
        type: "set_tiles",
        tiles: [{ q: tileQ, r: tileR, terrain: "plain", hidden: false }],
      },
    },
    {
      sender: "B",
      operationId: `${clientBId}-${now}-2`,
      operation: {
        type: "set_tiles",
        tiles: [{ q: tileQ, r: tileR, terrain: "plain", hidden: true }],
      },
    },
    {
      sender: "B",
      operationId: `${clientBId}-${now}-3`,
      operation: {
        type: "add_feature",
        feature: {
          id: featureId,
          kind: "city",
          q: tileQ,
          r: tileR,
          hidden: false,
          overrideTerrainTile: true,
          gmLabel: "Stress City",
          playerLabel: "Unknown City",
          labelRevealed: false,
        },
      },
    },
    {
      sender: "A",
      operationId: `${clientAId}-${now}-4`,
      operation: {
        type: "update_feature",
        featureId,
        patch: { hidden: true },
      },
    },
    {
      sender: "A",
      operationId: `${clientAId}-${now}-5`,
      operation: {
        type: "add_faction",
        faction: {
          id: factionId,
          name: "Stress Faction",
          color: "#3366cc",
        },
      },
    },
    {
      sender: "B",
      operationId: `${clientBId}-${now}-6`,
      operation: {
        type: "set_faction_territories",
        territories: [{ q: tileQ, r: tileR, factionId }],
      },
    },
    {
      sender: "B",
      operationId: `${clientBId}-${now}-7`,
      operation: {
        type: "set_tiles",
        tiles: [{ q: tileQ, r: tileR, terrain: "plain", hidden: false }],
      },
    },
  ];
  const events = [];
  const clientA = await connectMapSocket(base, account.cookie, map.id);
  const clientB = await connectMapSocket(base, account.cookie, map.id);
  const sockets = { A: clientA, B: clientB };

  const attachListener = (clientName, socket) => {
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString("utf8"));

      if (message.type === "map_operation_applied") {
        events.push({
          client: clientName,
          operationId: message.operationId,
          operationType: message.operation?.type,
          sourceClientId: message.sourceClientId,
        });
      }
    });
  };

  try {
    attachListener("A", clientA);
    attachListener("B", clientB);

    for (const item of operations) {
      const socket = sockets[item.sender];

      socket.send(
        JSON.stringify({
          type: "map_operation",
          operationId: item.operationId,
          operation: item.operation,
          clientId: item.sender === "A" ? clientAId : clientBId,
        }),
      );

      await sleep(220);
    }

    await sleep(1200);

    const afterPayload = await loadMap(base, account.cookie, map.id, "gm");
    const document = afterPayload?.document;
    const tile = Array.isArray(document?.tiles)
      ? document.tiles.find((entry) => entry.q === tileQ && entry.r === tileR)
      : null;
    const feature = Array.isArray(document?.features)
      ? document.features.find((entry) => entry.id === featureId)
      : null;
    const faction = Array.isArray(document?.factions)
      ? document.factions.find((entry) => entry.id === factionId)
      : null;
    const territory = Array.isArray(document?.factionTerritories)
      ? document.factionTerritories.find((entry) => entry.q === tileQ && entry.r === tileR)
      : null;

    const operationEventCounts = Object.fromEntries(
      operations.map((item) => {
        const count = events.filter((event) => event.operationId === item.operationId).length;
        return [item.operationId, count];
      }),
    );

    const validation = {
      mapId: map.id,
      tileExists: Boolean(tile),
      tileHiddenFalseAtEnd: tile?.hidden === false,
      featureExists: Boolean(feature),
      featureHiddenTrue: feature?.hidden === true,
      factionExists: Boolean(faction),
      territoryAssigned: territory?.factionId === factionId,
      eventCounts: operationEventCounts,
      wsUrl,
    };

    const hasEventCoverageGap = Object.values(operationEventCounts).some(
      (count) => count < 2,
    );
    const failed =
      !validation.tileExists ||
      !validation.tileHiddenFalseAtEnd ||
      !validation.featureExists ||
      !validation.featureHiddenTrue ||
      !validation.factionExists ||
      !validation.territoryAssigned ||
      hasEventCoverageGap;

    console.log(
      JSON.stringify(
        {
          base,
          operationsSent: operations.length,
          totalEvents: events.length,
          validation,
          sampleEvents: events.slice(0, 20),
          passed: !failed,
        },
        null,
        2,
      ),
    );

    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    await Promise.all([closeSocket(clientA), closeSocket(clientB)]);
    await deleteWorkspace(base, account.cookie, workspace.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
