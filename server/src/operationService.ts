import { WebSocket } from "ws";
import { applyOperationToContent, applyOperationsToContent, validateMapOperation } from "./mapContent.js";
import {
  nowIso,
  sanitizeName
} from "./mapStorage.js";
import { broadcastPayload } from "./broadcastService.js";
import { parseAppliedOperationPayload, rememberAppliedOperation } from "./appliedOperationLog.js";
import { schedulePersist } from "./persistenceScheduler.js";
import { getOrCreateSession } from "./sessionStore.js";
import type {
  AppliedOperationMessage,
  MapRecord,
  OperationEnvelope
} from "./types.js";
import type { MapOperation } from "../../src/core/protocol/index.js";

function applyOperationToMap(map: MapRecord, operation: MapOperation, updatedAt: string): MapRecord {
  if (operation.type === "rename_map") {
    return {
      ...map,
      name: sanitizeName(operation.name),
      updatedAt
    };
  }

  return {
    ...map,
    updatedAt,
    content: applyOperationToContent(map.content, operation)
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
  sourceSocket: WebSocket | null = null
): Promise<MapRecord> {
  if (typeof operationId !== "string" || !operationId.trim()) {
    throw new Error("Invalid operation id.");
  }

  const validationError = validateMapOperation(operation);

  if (validationError) {
    throw new Error(validationError);
  }

  const session = await getOrCreateSession(mapId);

  if (!session) {
    throw new Error("Map not found.");
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

    return session.map;
  }

  console.info("[MapSyncServer] operation_received", {
    mapId,
    operationId,
    sourceClientId,
    operationType: operation.type
  });

  const applyStartedAt = performance.now();
  session.map = applyOperationToMap(session.map, operation, nowIso());
  logServerPerf("operation_apply", applyStartedAt, {
    mapId,
    operationType: operation.type,
    operationCount: 1,
    tileCount: session.map.content.tiles.length
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

  return session.map;
}

export async function applyOperationBatchToSession(
  mapId: string,
  envelopes: OperationEnvelope[],
  sourceClientId: string,
  sourceSocket: WebSocket | null = null
): Promise<MapRecord> {
  const session = await getOrCreateSession(mapId);

  if (!session) {
    throw new Error("Map not found.");
  }

  const resolvedMessages: AppliedOperationMessage[] = [];
  const newMessages: AppliedOperationMessage[] = [];
  const newOperations: MapOperation[] = [];
  let mutated = false;
  let batchUpdatedAt = session.map.updatedAt;
  let nextName = session.map.name;

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
      newOperations.push(operation);
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
    const applyStartedAt = performance.now();
    session.map = {
      ...session.map,
      name: nextName,
      updatedAt: batchUpdatedAt,
      content: newOperations.length > 0
        ? applyOperationsToContent(session.map.content, newOperations)
        : session.map.content
    };
    logServerPerf("operation_batch_apply", applyStartedAt, {
      mapId,
      operationCount: newOperations.length,
      totalEnvelopeCount: envelopes.length,
      tileCount: session.map.content.tiles.length
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

  return session.map;
}

