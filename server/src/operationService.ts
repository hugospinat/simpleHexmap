import { WebSocket } from "ws";
import {
  nowIso,
  sanitizeName
} from "./mapStorage.js";
import { applyOperationToRuntime } from "./mapDocumentRuntime.js";
import { broadcastPayload } from "./broadcastService.js";
import { parseAppliedOperationPayload, rememberAppliedOperation } from "./appliedOperationLog.js";
import { schedulePersist } from "./persistenceScheduler.js";
import { getOrCreateSession, getSessionMapRecord } from "./sessionStore.js";
import { canOpenMapAsGM } from "../../src/core/profile/profileTypes.js";
import {
  validateMapOperation,
  validateMapTokenOperation,
  type MapOperation,
  type MapTokenOperation
} from "../../src/core/protocol/index.js";
import type {
  AppliedOperationMessage,
  MapTokenUpdatedMessage,
  MapRecord,
  OperationEnvelope
} from "./types.js";

function applyOperationToMap(map: MapRecord, operation: MapOperation, updatedAt: string): MapRecord {
  if (operation.type === "rename_map") {
    return {
      ...map,
      name: sanitizeName(operation.name),
      updatedAt
    };
  }

  return { ...map, updatedAt };
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
  actorProfileId?: string
): Promise<MapRecord> {
  if (typeof operationId !== "string" || !operationId.trim()) {
    throw new Error("Invalid operation id.");
  }

  const validationError = validateMapOperation(operation);

  if (validationError) {
    throw new Error(validationError);
  }

  const session = await getOrCreateSession(mapId, actorProfileId);

  if (!session) {
    throw new Error("Map not found.");
  }

  if (actorProfileId && !canOpenMapAsGM(actorProfileId, session.map.permissions)) {
    throw new Error("GM access denied.");
  }

  const existingPayload = session.appliedOperationPayloads.get(operationId);

  if (existingPayload) {
    console.info("[MapSyncServer] operation_duplicate", {
      mapId,
      operationId,
      sourceClientId,
      operationType: operation.type
    });

    if (sourceSocket && sourceSocket.readyState === WebSocket.OPEN) {
      sourceSocket.send(existingPayload);
    } else {
      broadcastPayload(session, existingPayload);
    }

    return getSessionMapRecord(session);
  }

  console.info("[MapSyncServer] operation_received", {
    mapId,
    operationId,
    sourceClientId,
    operationType: operation.type
  });

  const applyStartedAt = performance.now();
  session.map = applyOperationToMap(session.map, operation, nowIso());
  if (operation.type !== "rename_map") {
    applyOperationToRuntime(session.runtime, operation);
  }
  logServerPerf("operation_apply", applyStartedAt, {
    mapId,
    operationType: operation.type,
    operationCount: 1,
    tileCount: session.runtime.contentIndex.tilesByHex.size
  });
  schedulePersist(session);

  const payload = JSON.stringify({
    type: "map_operation_applied",
    sequence: session.nextSequence,
    operationId,
    operation,
    sourceClientId,
    updatedAt: session.map.updatedAt
  });

  session.nextSequence += 1;

  rememberAppliedOperation(session, operationId, payload);
  broadcastPayload(session, payload);

  console.info("[MapSyncServer] operation_broadcast", {
    mapId,
    operationId,
    sourceClientId,
    operationType: operation.type,
    clients: session.clients.size,
    updatedAt: session.map.updatedAt
  });

  return getSessionMapRecord(session);
}

export async function applyTokenOperationToSession(
  mapId: string,
  operation: MapTokenOperation,
  sourceProfileId: string
): Promise<MapRecord> {
  const validationError = validateMapTokenOperation(operation);

  if (validationError) {
    throw new Error(validationError);
  }

  const session = await getOrCreateSession(mapId, sourceProfileId);

  if (!session) {
    throw new Error("Map not found.");
  }

  const canManageOtherProfileTokens = canOpenMapAsGM(sourceProfileId, session.map.permissions);

  if (
    operation.type === "set_map_token"
    && operation.token.profileId !== sourceProfileId
    && !canManageOtherProfileTokens
  ) {
    throw new Error("Cannot move another profile token.");
  }

  if (
    operation.type === "remove_map_token"
    && operation.profileId !== sourceProfileId
    && !canManageOtherProfileTokens
  ) {
    throw new Error("Cannot remove another profile token.");
  }

  if (operation.type === "set_map_token") {
    const tile = session.runtime.contentIndex.tilesByHex.get(`${operation.token.q},${operation.token.r}`);

    if (!tile || tile.hidden) {
      throw new Error("Token can only be placed on visible terrain.");
    }
  }

  const updatedAt = nowIso();

  if (operation.type === "set_map_token") {
    session.runtime.contentIndex.tokensByProfileId.set(operation.token.profileId, operation.token);
  } else {
    session.runtime.contentIndex.tokensByProfileId.delete(operation.profileId);
  }

  session.map = {
    ...session.map,
    updatedAt
  };
  schedulePersist(session);

  const message: MapTokenUpdatedMessage = {
    type: "map_token_updated",
    operation,
    sourceProfileId,
    updatedAt
  };
  broadcastPayload(session, JSON.stringify(message));
  return getSessionMapRecord(session);
}

export async function applyOperationBatchToSession(
  mapId: string,
  envelopes: OperationEnvelope[],
  sourceClientId: string,
  sourceSocket: WebSocket | null = null,
  actorProfileId?: string
): Promise<MapRecord> {
  const session = await getOrCreateSession(mapId, actorProfileId);

  if (!session) {
    throw new Error("Map not found.");
  }

  if (actorProfileId && !canOpenMapAsGM(actorProfileId, session.map.permissions)) {
    throw new Error("GM access denied.");
  }

  const resolvedMessages: AppliedOperationMessage[] = [];
  const newMessages: AppliedOperationMessage[] = [];
  let mutated = false;
  let batchUpdatedAt = session.map.updatedAt;
  let nextName = session.map.name;
  const applyStartedAt = performance.now();

  for (const envelope of envelopes) {
    const operationId = envelope.operationId;
    const operation = envelope.operation;

    if (typeof operationId !== "string" || !operationId.trim()) {
      throw new Error("Invalid operation id.");
    }

    const validationError = validateMapOperation(operation);

    if (validationError) {
      throw new Error(validationError);
    }

    const existingPayload = session.appliedOperationPayloads.get(operationId);

    if (existingPayload) {
      const existingMessage = parseAppliedOperationPayload(existingPayload);

      if (existingMessage) {
        resolvedMessages.push(existingMessage);
      }

      continue;
    }

    if (!mutated) {
      batchUpdatedAt = nowIso();
      mutated = true;
    }

    if (operation.type === "rename_map") {
      nextName = sanitizeName(operation.name);
    } else {
      applyOperationToRuntime(session.runtime, operation);
    }

    const appliedMessage: AppliedOperationMessage = {
      type: "map_operation_applied",
      sequence: session.nextSequence,
      operationId,
      operation,
      sourceClientId,
      updatedAt: batchUpdatedAt
    };

    session.nextSequence += 1;

    const payload = JSON.stringify(appliedMessage);
    rememberAppliedOperation(session, operationId, payload);
    resolvedMessages.push(appliedMessage);
    newMessages.push(appliedMessage);
  }

  if (mutated) {
    session.map = {
      ...session.map,
      name: nextName,
      updatedAt: batchUpdatedAt
    };
    logServerPerf("operation_batch_apply", applyStartedAt, {
      mapId,
      operationCount: newMessages.length,
      totalEnvelopeCount: envelopes.length,
      tileCount: session.runtime.contentIndex.tilesByHex.size
    });
    schedulePersist(session);
  }

  if (newMessages.length === 1) {
    broadcastPayload(session, JSON.stringify(newMessages[0]));
  } else if (newMessages.length > 1) {
    const payload = JSON.stringify({
      type: "map_operation_batch_applied",
      operations: newMessages.map(({ type, ...entry }) => entry),
      updatedAt: session.map.updatedAt
    });

    broadcastPayload(session, payload);
  }

  // Duplicates are not rebroadcast to every client. Return them only to the source so
  // it can clear local pending state after reconnect/retry.
  if (sourceSocket && sourceSocket.readyState === WebSocket.OPEN) {
    const newIds = new Set(newMessages.map((message) => message.operationId));
    const duplicateMessages = resolvedMessages.filter((message) => !newIds.has(message.operationId));

    if (duplicateMessages.length === 1) {
      sourceSocket.send(JSON.stringify(duplicateMessages[0]));
    } else if (duplicateMessages.length > 1) {
      sourceSocket.send(JSON.stringify({
        type: "map_operation_batch_applied",
        operations: duplicateMessages.map(({ type, ...entry }) => entry),
        updatedAt: session.map.updatedAt
      }));
    }
  }

  return getSessionMapRecord(session);
}

