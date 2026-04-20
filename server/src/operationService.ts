import { WebSocket } from "ws";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { opLog, maps } from "./db/schema.js";
import {
  applyIncrementalContentMutations,
  isIncrementalContentOperation,
} from "./repositories/incrementalContentMutations.js";
import {
  getMapRecordForUser,
  getMapRoleForUser,
} from "./repositories/mapRepository.js";
import { canOpenAsGm } from "./repositories/workspaceRepository.js";
import { getOrCreateSession } from "./sessionStore.js";
import { broadcastRoleAwareSessionPayloads } from "./sessionDelivery.js";
import { sendSyncSnapshot } from "./syncSnapshotService.js";
import {
  validateMapOperation,
  type MapOperation,
} from "../../src/core/protocol/index.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "./errors.js";
import type {
  AppliedOperationMessage,
  MapRecord,
  OperationEnvelope,
} from "./types.js";

function operationLogRowToMessage(
  row: typeof opLog.$inferSelect,
): AppliedOperationMessage {
  return {
    type: "map_operation_applied",
    operation: row.operation,
    operationId: row.operationId,
    sequence: row.sequence,
    sourceClientId: row.sourceClientId,
    updatedAt: row.createdAt.toISOString(),
  };
}

async function getWorkspaceRecordForActor(
  workspaceId: string,
  actorUserId: string,
): Promise<MapRecord> {
  const map = await getMapRecordForUser(workspaceId, actorUserId);

  if (!map) {
    throw new NotFoundError("Map not found.");
  }

  return {
    document: map.document,
    currentUserRole: map.currentUserRole,
    id: map.id,
    name: map.name,
    nextSequence: map.nextSequence,
    tokenPlacements: map.tokenPlacements,
    updatedAt: map.updatedAt,
    workspaceId: map.workspaceId,
    workspaceMembers: map.workspaceMembers,
  };
}

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
  const role = await getMapRoleForUser(mapId, actorUserId);

  if (!role) {
    throw new NotFoundError("Map not found.");
  }

  if (!canOpenAsGm(role)) {
    throw new ForbiddenError("GM access denied.");
  }

  const applyStartedAt = performance.now();
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select id from ${maps} where id = ${mapId} for update`,
    );

    const mapRows = await tx
      .select()
      .from(maps)
      .where(eq(maps.id, mapId))
      .limit(1);
    const map = mapRows[0];

    if (!map) {
      throw new NotFoundError("Map not found.");
    }

    const operationIds = envelopes.map((envelope) => envelope.operationId);
    const duplicateRows =
      operationIds.length === 0
        ? []
        : await tx
            .select()
            .from(opLog)
            .where(
              and(
                eq(opLog.mapId, mapId),
                inArray(opLog.operationId, operationIds),
              ),
            );
    const duplicateByOperationId = new Map(
      duplicateRows.map((row) => [row.operationId, row]),
    );
    const resolvedMessages: AppliedOperationMessage[] = [];
    const newEnvelopes: OperationEnvelope[] = [];

    for (const envelope of envelopes) {
      if (
        typeof envelope.operationId !== "string" ||
        !envelope.operationId.trim()
      ) {
        throw new BadRequestError("Invalid operation id.");
      }

      const validationError = validateMapOperation(envelope.operation);

      if (validationError) {
        throw new BadRequestError(validationError);
      }

      const duplicate = duplicateByOperationId.get(envelope.operationId);

      if (duplicate) {
        resolvedMessages.push(operationLogRowToMessage(duplicate));
        continue;
      }

      newEnvelopes.push(envelope);
    }

    if (newEnvelopes.length === 0) {
      return {
        newMessages: [],
        resolvedMessages,
        updatedAt: map.updatedAt,
      };
    }

    const newMessages: AppliedOperationMessage[] = [];
    const hasContentMutation = newEnvelopes.length > 0;
    let nextSequence = map.nextSequence;
    const updatedAt = new Date();
    const opLogRows: Array<typeof opLog.$inferInsert> = [];

    for (const envelope of newEnvelopes) {
      const message: AppliedOperationMessage = {
        type: "map_operation_applied",
        operation: envelope.operation,
        operationId: envelope.operationId,
        sequence: nextSequence,
        sourceClientId,
        updatedAt: updatedAt.toISOString(),
      };
      nextSequence += 1;
      resolvedMessages.push(message);
      newMessages.push(message);

      opLogRows.push({
        actorUserId,
        createdAt: updatedAt,
        operation: envelope.operation,
        operationId: envelope.operationId,
        sequence: message.sequence,
        sourceClientId,
        mapId,
      });
    }

    if (opLogRows.length > 0) {
      await tx.insert(opLog).values(opLogRows);
    }

    if (hasContentMutation) {
      const hasUnsupportedIncrementalOperation = newEnvelopes.some(
        (envelope) => !isIncrementalContentOperation(envelope.operation),
      );

      if (hasUnsupportedIncrementalOperation) {
        throw new BadRequestError("Unsupported non-incremental operation.");
      }

      await applyIncrementalContentMutations(
        tx,
        mapId,
        newEnvelopes,
        updatedAt,
      );
    }

    await tx
      .update(maps)
      .set({
        nextSequence,
        updatedAt,
      })
      .where(eq(maps.id, mapId));

    return {
      newMessages,
      resolvedMessages,
      updatedAt,
    };
  });
  if (result.newMessages.length > 0) {
    await broadcastRoleAwareSessionPayloads(
      getOrCreateSession(mapId),
      result.newMessages.map((message) => JSON.stringify(message)),
      sendSyncSnapshot,
    );
  }

  if (sourceSocket && sourceSocket.readyState === WebSocket.OPEN) {
    const newIds = new Set(
      result.newMessages.map((message) => message.operationId),
    );
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
