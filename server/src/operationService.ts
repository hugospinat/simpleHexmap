import { performance } from "node:perf_hooks";
import { WebSocket } from "ws";
import { broadcastRoleAwareSessionPayloads } from "./sessionDelivery.js";
import { sendSyncSnapshot } from "./syncSnapshotService.js";
import { getOrCreateSession } from "./sessionStore.js";
import { assertActorCanEditMap, getWorkspaceRecordForActor } from "./services/mapAccessService.js";
import { persistOperationBatch } from "./services/operationBatchPersistence.js";
import type { MapRecord, OperationEnvelope } from "./types.js";
import type { MapOperation } from "../../src/core/protocol/index.js";

function shouldLogServerPerf(durationMs: number): boolean {
  return process.env.HEXMAP_PERF_DEBUG === "1" || durationMs >= 16;
}

function logServerPerf(
  event: string,
  startedAtMs: number,
  details: Record<string, unknown>,
): void {
  const durationMs = performance.now() - startedAtMs;

  if (!shouldLogServerPerf(durationMs)) {
    return;
  }

  console.info("[MapSyncServer] perf", {
    event,
    durationMs: Number(durationMs.toFixed(2)),
    ...details,
  });
}

export async function applyOperationToSession(
  mapId: string,
  operation: MapOperation,
  sourceClientId: string,
  operationId: string,
  sourceSocket: WebSocket | null = null,
  actorUserId: string,
  options: { includeMapRecord?: boolean } = {},
): Promise<MapRecord | null> {
  return applyOperationBatchToSession(
    mapId,
    [{ operation, operationId }],
    sourceClientId,
    sourceSocket,
    actorUserId,
    options,
  );
}

export async function applyOperationBatchToSession(
  mapId: string,
  envelopes: OperationEnvelope[],
  sourceClientId: string,
  sourceSocket: WebSocket | null = null,
  actorUserId: string,
  options: { includeMapRecord?: boolean } = {},
): Promise<MapRecord | null> {
  const includeMapRecord = options.includeMapRecord ?? true;
  const applyStartedAt = performance.now();

  await assertActorCanEditMap(mapId, actorUserId);
  const result = await persistOperationBatch(
    mapId,
    envelopes,
    sourceClientId,
    actorUserId,
  );

  if (result.newMessages.length > 0) {
    await broadcastRoleAwareSessionPayloads(
      getOrCreateSession(mapId),
      result.newMessages.map((message) => JSON.stringify(message)),
      sendSyncSnapshot,
    );
  }

  if (sourceSocket && sourceSocket.readyState === WebSocket.OPEN) {
    const newIds = new Set(result.newMessages.map((message) => message.operationId));
    const duplicates = result.resolvedMessages.filter(
      (message) => !newIds.has(message.operationId),
    );

    for (const duplicate of duplicates) {
      sourceSocket.send(JSON.stringify(duplicate));
    }
  }

  logServerPerf("operation_batch_apply", applyStartedAt, {
    mapId,
    operationCount: result.newMessages.length,
    totalEnvelopeCount: envelopes.length,
  });

  if (!includeMapRecord) {
    return null;
  }

  return getWorkspaceRecordForActor(mapId, actorUserId);
}
