import { opLog } from "../db/schema.js";
import type { AppliedOperationMessage, OperationEnvelope } from "../types.js";

export function operationLogRowToMessage(
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

export function buildAppliedOperationMessage(
  envelope: OperationEnvelope,
  sourceClientId: string,
  sequence: number,
  updatedAt: Date,
): AppliedOperationMessage {
  return {
    type: "map_operation_applied",
    operation: envelope.operation,
    operationId: envelope.operationId,
    sequence,
    sourceClientId,
    updatedAt: updatedAt.toISOString(),
  };
}
