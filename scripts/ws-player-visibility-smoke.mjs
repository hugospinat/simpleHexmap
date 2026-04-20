import {
  addWorkspaceMember,
  closeSocket,
  connectMapSocket,
  createSmokeAccount,
  createWorkspace,
  createWorkspaceMap,
  deleteWorkspace,
  loadMap,
  sleep,
  withTimeout,
} from "./ws-smoke-helpers.mjs";

const base = process.env.BASE_URL ?? "http://localhost:8787";

function createMessageCollector(socket) {
  const messages = [];

  socket.on("message", (raw) => {
    messages.push(JSON.parse(raw.toString("utf8")));
  });

  return { messages };
}

async function waitForMessages(collector, predicate, label, timeoutMs = 5000) {
  return withTimeout(
    (async () => {
      while (true) {
        if (predicate(collector.messages)) {
          return collector.messages;
        }

        await sleep(50);
      }
    })(),
    timeoutMs,
    label,
  );
}

function findFeature(content, featureId) {
  return Array.isArray(content?.features)
    ? content.features.find((feature) => feature.id === featureId)
    : null;
}

function hasTile(content, q, r, hidden) {
  return Array.isArray(content?.tiles)
    ? content.tiles.some(
        (tile) => tile.q === q && tile.r === r && tile.hidden === hidden,
      )
    : false;
}

async function main() {
  const gmAccount = await createSmokeAccount(base, "player-vis-gm");
  const playerAccount = await createSmokeAccount(base, "player-vis-player");
  const workspace = await createWorkspace(
    base,
    gmAccount.cookie,
    "Player Visibility Workspace",
  );
  const map = await createWorkspaceMap(
    base,
    gmAccount.cookie,
    workspace.id,
    "Player Visibility Map",
  );

  await addWorkspaceMember(
    base,
    gmAccount.cookie,
    workspace.id,
    playerAccount.username,
    "player",
  );

  const gmSocket = await connectMapSocket(base, gmAccount.cookie, map.id);
  const playerSocket = await connectMapSocket(base, playerAccount.cookie, map.id);
  const gmMessages = createMessageCollector(gmSocket);
  const playerMessages = createMessageCollector(playerSocket);
  const now = Date.now();
  const visibleCell = { q: 12, r: 8 };
  const hiddenCell = { q: 13, r: 8 };
  const visibleFeatureId = `player-visible-feature-${now}`;
  const hiddenFeatureId = `player-hidden-feature-${now}`;
  const hiddenTileFeatureId = `player-hidden-tile-feature-${now}`;
  const factionId = `player-visible-faction-${now}`;
  const gmClientId = `player-vis-gm-${now}`;

  try {
    const initialPlayerLoad = await loadMap(
      base,
      playerAccount.cookie,
      map.id,
      "player",
    );

    await sleep(150);

    const operations = [
      {
        operationId: `${gmClientId}-1`,
        operation: {
          type: "set_tiles",
          tiles: [
            {
              q: visibleCell.q,
              r: visibleCell.r,
              terrain: "plain",
              hidden: false,
            },
            {
              q: hiddenCell.q,
              r: hiddenCell.r,
              terrain: "forest",
              hidden: true,
            },
          ],
        },
      },
      {
        operationId: `${gmClientId}-2`,
        operation: {
          type: "add_feature",
          feature: {
            id: visibleFeatureId,
            kind: "city",
            q: visibleCell.q,
            r: visibleCell.r,
            visibility: "visible",
            overrideTerrainTile: false,
            gmLabel: "GM Secret",
            playerLabel: "Visible Town",
            labelRevealed: true,
          },
        },
      },
      {
        operationId: `${gmClientId}-3`,
        operation: {
          type: "add_feature",
          feature: {
            id: hiddenFeatureId,
            kind: "ruin",
            q: visibleCell.q,
            r: visibleCell.r,
            visibility: "hidden",
            overrideTerrainTile: false,
            gmLabel: "Hidden Ruin",
            playerLabel: null,
            labelRevealed: false,
          },
        },
      },
      {
        operationId: `${gmClientId}-4`,
        operation: {
          type: "add_feature",
          feature: {
            id: hiddenTileFeatureId,
            kind: "fort",
            q: hiddenCell.q,
            r: hiddenCell.r,
            visibility: "visible",
            overrideTerrainTile: false,
            gmLabel: "Hidden Tile Fort",
            playerLabel: "Should Not Leak",
            labelRevealed: true,
          },
        },
      },
      {
        operationId: `${gmClientId}-5`,
        operation: {
          type: "add_faction",
          faction: {
            id: factionId,
            name: "Visible Faction",
            color: "#228833",
          },
        },
      },
      {
        operationId: `${gmClientId}-6`,
        operation: {
          type: "assign_faction_cells",
          cells: [{ q: visibleCell.q, r: visibleCell.r }],
          factionId,
        },
      },
    ];

    for (const entry of operations) {
      gmSocket.send(
        JSON.stringify({
          type: "map_operation",
          clientId: gmClientId,
          operationId: entry.operationId,
          operation: entry.operation,
        }),
      );

      await sleep(180);
    }

    gmSocket.send(
      JSON.stringify({
        type: "map_token_update",
        operation: {
          type: "set_map_token",
          token: {
            userId: playerAccount.user.id,
            q: visibleCell.q,
            r: visibleCell.r,
            color: "#ff8800",
          },
        },
      }),
    );

    await waitForMessages(
      gmMessages,
      (messages) =>
        messages.filter((message) => message.type === "map_operation_applied").length
          >= operations.length,
      "gm operation events",
    );
    await waitForMessages(
      gmMessages,
      (messages) => messages.some((message) => message.type === "map_token_updated"),
      "gm token event",
    );
    await waitForMessages(
      playerMessages,
      (messages) =>
        messages.filter((message) => message.type === "sync_snapshot").length >= 7,
      "player refresh snapshots",
      8000,
    );

    await sleep(500);

    const playerSnapshots = playerMessages.messages.filter(
      (message) => message.type === "sync_snapshot",
    );
    const finalPlayerSnapshot = playerSnapshots[playerSnapshots.length - 1];
    const playerUnexpectedTypes = playerMessages.messages
      .map((message) => message.type)
      .filter((type) => type !== "sync_snapshot");
    const gmAppliedCount = gmMessages.messages.filter(
      (message) => message.type === "map_operation_applied",
    ).length;
    const gmTokenEventCount = gmMessages.messages.filter(
      (message) => message.type === "map_token_updated",
    ).length;
    const finalPlayerContent = finalPlayerSnapshot?.content;
    const visibleFeature = findFeature(finalPlayerContent, visibleFeatureId);
    const hiddenFeature = findFeature(finalPlayerContent, hiddenFeatureId);
    const hiddenTileFeature = findFeature(finalPlayerContent, hiddenTileFeatureId);
    const playerLoad = await loadMap(base, playerAccount.cookie, map.id, "player");
    const gmLoad = await loadMap(base, gmAccount.cookie, map.id, "gm");

    const validation = {
      initialHiddenDefaultTileFiltered:
        Array.isArray(initialPlayerLoad?.content?.tiles) &&
        initialPlayerLoad.content.tiles.length === 0,
      gmReceivedOrderedOperations: gmAppliedCount >= operations.length,
      gmReceivedTokenUpdate: gmTokenEventCount >= 1,
      playerReceivedOnlySnapshots: playerUnexpectedTypes.length === 0,
      playerReceivedRefreshSnapshots: playerSnapshots.length >= 2,
      visibleTilePresent: hasTile(finalPlayerContent, visibleCell.q, visibleCell.r, false),
      hiddenTileFiltered: !hasTile(finalPlayerContent, hiddenCell.q, hiddenCell.r, true),
      visibleFeaturePresent: Boolean(visibleFeature),
      visibleFeatureGmLabelStripped: visibleFeature?.gmLabel === null,
      visibleFeaturePlayerLabelVisible:
        visibleFeature?.playerLabel === "Visible Town",
      hiddenFeatureFiltered: !hiddenFeature,
      hiddenTileFeatureFiltered: !hiddenTileFeature,
      visibleFactionPresent:
        Array.isArray(finalPlayerContent?.factions) &&
        finalPlayerContent.factions.some((faction) => faction.id === factionId),
      visibleFactionTerritoryPresent:
        Array.isArray(finalPlayerContent?.factionTerritories) &&
        finalPlayerContent.factionTerritories.some(
          (territory) =>
            territory.q === visibleCell.q &&
            territory.r === visibleCell.r &&
            territory.factionId === factionId,
        ),
      visiblePlayerTokenPresent:
        Array.isArray(finalPlayerContent?.tokens) &&
        finalPlayerContent.tokens.some(
          (token) =>
            token.userId === playerAccount.user.id &&
            token.q === visibleCell.q &&
            token.r === visibleCell.r,
        ),
      snapshotTokenMembersPresent:
        Array.isArray(finalPlayerSnapshot?.tokenMembers) &&
        finalPlayerSnapshot.tokenMembers.some(
          (member) => member.userId === playerAccount.user.id,
        ),
      httpPlayerLoadMatchesSnapshot:
        JSON.stringify(playerLoad.content) === JSON.stringify(finalPlayerContent),
      gmStillSeesHiddenContent:
        hasTile(gmLoad.content, hiddenCell.q, hiddenCell.r, true) &&
        Boolean(findFeature(gmLoad.content, hiddenFeatureId)) &&
        Boolean(findFeature(gmLoad.content, hiddenTileFeatureId)),
    };

    const failed = Object.values(validation).some((value) => value !== true);

    console.log(
      JSON.stringify(
        {
          base,
          mapId: map.id,
          playerSnapshotCount: playerSnapshots.length,
          gmAppliedCount,
          gmTokenEventCount,
          playerUnexpectedTypes,
          validation,
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
    await Promise.all([closeSocket(gmSocket), closeSocket(playerSocket)]);
    await deleteWorkspace(base, gmAccount.cookie, workspace.id);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});