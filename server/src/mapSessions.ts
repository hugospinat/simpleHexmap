import { WebSocket } from "ws";
import { applyOperationToContent, validateMapOperation } from "./mapContent.js";
import {
  listDiskMapSummaries,
  nowIso,
  readDiskMap,
  sanitizeName
} from "./mapStorage.js";
import { broadcastPayload } from "./broadcastService.js";
import { parseAppliedOperationPayload, rememberAppliedOperation } from "./appliedOperationLog.js";
import { schedulePersist } from "./persistenceScheduler.js";
import type {
  AppliedOperationMessage,
  MapRecord,
  MapSession,
  MapSummary,
  OperationEnvelope
} from "./types.js";
import type { MapOperation } from "../../src/shared/mapProtocol/index.js";

const mapSessions = new Map<string, MapSession>();

function toMapSummary(map: MapRecord): MapSummary {
  return {
    id: map.id,
    name: map.name,
    updatedAt: map.updatedAt
  };
}

export async function listMaps(): Promise<MapSummary[]> {
  const summariesById = new Map<string, MapSummary>();

  for (const summary of await listDiskMapSummaries()) {
    summariesById.set(summary.id, summary);
  }

  for (const session of mapSessions.values()) {
    summariesById.set(session.map.id, toMapSummary(session.map));
  }

  const summaries = Array.from(summariesById.values());
  summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return summaries;
}

export async function getMap(mapId: string): Promise<MapRecord | null> {
  const session = mapSessions.get(mapId);

  if (session) {
    return session.map;
  }

  return readDiskMap(mapId);
}

export async function getOrCreateSession(mapId: string): Promise<MapSession | null> {
  const existing = mapSessions.get(mapId);

  if (existing) {
    return existing;
  }

  const map = await getMap(mapId);

  if (!map) {
    return null;
  }

  const session: MapSession = {
    map,
    clients: new Set<WebSocket>(),
    persistTimer: null,
    appliedOperationPayloads: new Map<string, string>(),
    appliedOperationOrder: [],
    nextSequence: 1
  };
  mapSessions.set(mapId, session);
  return session;
}

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

  session.map = applyOperationToMap(session.map, operation, nowIso());
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
  let mutated = false;
  let batchUpdatedAt = session.map.updatedAt;

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

    session.map = applyOperationToMap(session.map, operation, batchUpdatedAt);

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

