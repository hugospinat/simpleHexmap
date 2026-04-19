import { WebSocket } from "ws";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { hexCells, mapTokens, opLog, workspaces } from "./db/schema.js";
import { materializeWorkspaceContent, replaceWorkspaceContent } from "./repositories/mapContentRepository.js";
import { canOpenAsGm, getMapRecordForUser, getMapRoleForUser, getWorkspaceIdForMap, touchWorkspaceUpdatedAt } from "./repositories/workspaceRepository.js";
import { broadcastPayload } from "./broadcastService.js";
import { getOrCreateSession } from "./sessionStore.js";
import {
  applyOperationToSavedMapContentIndex,
  indexSavedMapContent,
  materializeSavedMapContent,
  validateMapOperation,
  validateMapTokenOperation,
  type MapOperation,
  type MapTokenOperation
} from "../../src/core/protocol/index.js";
import type {
  AppliedOperationMessage,
  MapRecord,
  MapTokenUpdatedMessage,
  OperationEnvelope
} from "./types.js";

function operationLogRowToMessage(row: typeof opLog.$inferSelect): AppliedOperationMessage {
  return {
    type: "map_operation_applied",
    operation: row.operation,
    operationId: row.operationId,
    sequence: row.sequence,
    sourceClientId: row.sourceClientId,
    updatedAt: row.createdAt.toISOString()
  };
}

async function getWorkspaceRecordForActor(workspaceId: string, actorUserId: string): Promise<MapRecord> {
  const map = await getMapRecordForUser(workspaceId, actorUserId);

  if (!map) {
    throw new Error("Map not found.");
  }

  return {
    content: map.content,
    currentUserRole: map.currentUserRole,
    id: map.id,
    name: map.name,
    ownerUserId: map.ownerUserId,
    updatedAt: map.updatedAt,
    workspaceId: map.workspaceId
  };
}

function shouldLogServerPerf(durationMs: number): boolean {
  return process.env.HEXMAP_PERF_DEBUG === "1" || durationMs >= 16;
}

function logServerPerf(event: string, startedAtMs: number, details: Record<string, unknown>): void {
  const durationMs = performance.now() - startedAtMs;

  if (!shouldLogServerPerf(durationMs)) {
    return;
  }

  console.info("[MapSyncServer] perf", {
    event,
    durationMs: Number(durationMs.toFixed(2)),
    ...details
  });
}

export async function applyOperationToSession(
  mapId: string,
  operation: MapOperation,
  sourceClientId: string,
  operationId: string,
  sourceSocket: WebSocket | null = null,
  actorUserId: string
): Promise<MapRecord> {
  return applyOperationBatchToSession(
    mapId,
    [{ operation, operationId }],
    sourceClientId,
    sourceSocket,
    actorUserId
  );
}

export async function applyTokenOperationToSession(
  mapId: string,
  operation: MapTokenOperation,
  sourceUserId: string
): Promise<MapRecord> {
  const validationError = validateMapTokenOperation(operation);

  if (validationError) {
    throw new Error(validationError);
  }

  const role = await getMapRoleForUser(mapId, sourceUserId);

  if (!role) {
    throw new Error("Map not found.");
  }

  const canManageOtherUserTokens = canOpenAsGm(role);

  if (
    operation.type === "set_map_token"
    && operation.token.profileId !== sourceUserId
    && !canManageOtherUserTokens
  ) {
    throw new Error("Cannot move another user token.");
  }

  if (
    operation.type === "remove_map_token"
    && operation.profileId !== sourceUserId
    && !canManageOtherUserTokens
  ) {
    throw new Error("Cannot remove another user token.");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${workspaces} where id = ${mapId} for update`);
    const now = new Date();

    if (operation.type === "set_map_token") {
      const tileRows = await tx.select()
        .from(hexCells)
        .where(and(
          eq(hexCells.workspaceId, mapId),
          eq(hexCells.q, operation.token.q),
          eq(hexCells.r, operation.token.r)
        ))
        .limit(1);
      const tile = tileRows[0];

      if (!tile || tile.hidden === 1) {
        throw new Error("Token can only be placed on visible terrain.");
      }

      await tx.insert(mapTokens).values({
        color: operation.token.color,
        q: operation.token.q,
        r: operation.token.r,
        userId: operation.token.profileId,
        workspaceId: mapId
      }).onConflictDoUpdate({
        target: [mapTokens.workspaceId, mapTokens.userId],
        set: {
          color: operation.token.color,
          q: operation.token.q,
          r: operation.token.r
        }
      });
    } else {
      await tx.delete(mapTokens)
        .where(and(eq(mapTokens.workspaceId, mapId), eq(mapTokens.userId, operation.profileId)));
    }

    await tx.update(workspaces).set({ updatedAt: now }).where(eq(workspaces.id, mapId));
  });

  const workspaceId = await getWorkspaceIdForMap(mapId);

  if (workspaceId) {
    await touchWorkspaceUpdatedAt(workspaceId);
  }

  const updated = await getWorkspaceRecordForActor(mapId, sourceUserId);
  const message: MapTokenUpdatedMessage = {
    type: "map_token_updated",
    operation,
    sourceProfileId: sourceUserId,
    updatedAt: updated.updatedAt
  };
  broadcastPayload(getOrCreateSession(mapId), JSON.stringify(message));
  return updated;
}

export async function applyOperationBatchToSession(
  mapId: string,
  envelopes: OperationEnvelope[],
  sourceClientId: string,
  sourceSocket: WebSocket | null = null,
  actorUserId: string
): Promise<MapRecord> {
  const role = await getMapRoleForUser(mapId, actorUserId);

  if (!role) {
    throw new Error("Map not found.");
  }

  if (!canOpenAsGm(role)) {
    throw new Error("GM access denied.");
  }

  const applyStartedAt = performance.now();
  const result = await db.transaction(async (tx) => {
    const workspaceRows = await tx.select().from(workspaces).where(eq(workspaces.id, mapId)).limit(1);
    const workspace = workspaceRows[0];

    if (!workspace) {
      throw new Error("Map not found.");
    }

    await tx.execute(sql`select id from ${workspaces} where id = ${mapId} for update`);

    const operationIds = envelopes.map((envelope) => envelope.operationId);
    const duplicateRows = operationIds.length === 0
      ? []
      : await tx.select().from(opLog).where(and(
        eq(opLog.workspaceId, mapId),
        inArray(opLog.operationId, operationIds)
      ));
    const duplicateByOperationId = new Map(duplicateRows.map((row) => [row.operationId, row]));
    const resolvedMessages: AppliedOperationMessage[] = [];
    const newMessages: AppliedOperationMessage[] = [];
    const content = await materializeWorkspaceContent(mapId, tx);
    const index = indexSavedMapContent(content);
    let nextName = workspace.name;
    let nextSequence = workspace.nextSequence;
    let mutated = false;
    let updatedAt = workspace.updatedAt;

    for (const envelope of envelopes) {
      if (typeof envelope.operationId !== "string" || !envelope.operationId.trim()) {
        throw new Error("Invalid operation id.");
      }

      const validationError = validateMapOperation(envelope.operation);

      if (validationError) {
        throw new Error(validationError);
      }

      const duplicate = duplicateByOperationId.get(envelope.operationId);

      if (duplicate) {
        resolvedMessages.push(operationLogRowToMessage(duplicate));
        continue;
      }

      if (!mutated) {
        updatedAt = new Date();
        mutated = true;
      }

      if (envelope.operation.type === "rename_map") {
        nextName = envelope.operation.name.trim().slice(0, 120) || "Untitled map";
      } else {
        applyOperationToSavedMapContentIndex(index, envelope.operation);
      }

      const message: AppliedOperationMessage = {
        type: "map_operation_applied",
        operation: envelope.operation,
        operationId: envelope.operationId,
        sequence: nextSequence,
        sourceClientId,
        updatedAt: updatedAt.toISOString()
      };
      nextSequence += 1;
      resolvedMessages.push(message);
      newMessages.push(message);

      await tx.insert(opLog).values({
        actorUserId,
        createdAt: updatedAt,
        operation: envelope.operation,
        operationId: envelope.operationId,
        sequence: message.sequence,
        sourceClientId,
        workspaceId: mapId
      });
    }

    if (mutated) {
      await replaceWorkspaceContent(mapId, materializeSavedMapContent(content, index), tx);
      await tx.update(workspaces)
        .set({
          name: nextName,
          nextSequence,
          updatedAt
        })
        .where(eq(workspaces.id, mapId));
    }

    return {
      newMessages,
      resolvedMessages,
      updatedAt
    };
  });

  if (result.newMessages.length > 0) {
    const workspaceId = await getWorkspaceIdForMap(mapId);

    if (workspaceId) {
      await touchWorkspaceUpdatedAt(workspaceId);
    }
  }

  if (result.newMessages.length === 1) {
    broadcastPayload(getOrCreateSession(mapId), JSON.stringify(result.newMessages[0]));
  } else if (result.newMessages.length > 1) {
    broadcastPayload(getOrCreateSession(mapId), JSON.stringify({
      type: "map_operation_batch_applied",
      operations: result.newMessages.map(({ type, ...entry }) => entry),
      updatedAt: result.updatedAt.toISOString()
    }));
  }

  if (sourceSocket && sourceSocket.readyState === WebSocket.OPEN) {
    const newIds = new Set(result.newMessages.map((message) => message.operationId));
    const duplicates = result.resolvedMessages.filter((message) => !newIds.has(message.operationId));

    if (duplicates.length === 1) {
      sourceSocket.send(JSON.stringify(duplicates[0]));
    } else if (duplicates.length > 1) {
      sourceSocket.send(JSON.stringify({
        type: "map_operation_batch_applied",
        operations: duplicates.map(({ type, ...entry }) => entry),
        updatedAt: result.updatedAt.toISOString()
      }));
    }
  }

  logServerPerf("operation_batch_apply", applyStartedAt, {
    mapId,
    operationCount: result.newMessages.length,
    totalEnvelopeCount: envelopes.length
  });

  return getWorkspaceRecordForActor(mapId, actorUserId);
}
