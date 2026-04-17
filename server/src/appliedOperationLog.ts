import type { AppliedOperationMessage, MapSession } from "./types.js";

export const maxRememberedOperationIds = 5000;

export function rememberAppliedOperation(session: MapSession, operationId: string, payload: string): void {
  if (session.appliedOperationPayloads.has(operationId)) {
    return;
  }

  session.appliedOperationPayloads.set(operationId, payload);
  session.appliedOperationOrder.push(operationId);

  if (session.appliedOperationOrder.length > maxRememberedOperationIds) {
    const removed = session.appliedOperationOrder.shift();

    if (removed) {
      session.appliedOperationPayloads.delete(removed);
    }
  }
}

export function parseAppliedOperationPayload(payload: string): AppliedOperationMessage | null {
  try {
    const parsed = JSON.parse(payload);

    if (typeof parsed !== "object" || parsed === null || parsed.type !== "map_operation_applied") {
      return null;
    }

    if (
      !Number.isInteger(parsed.sequence)
      || typeof parsed.operationId !== "string"
      || typeof parsed.operation !== "object"
      || parsed.operation === null
      || typeof parsed.sourceClientId !== "string"
      || typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }

    return parsed as AppliedOperationMessage;
  } catch {
    return null;
  }
}
