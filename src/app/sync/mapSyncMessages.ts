import type {
  MapOperationBatchAppliedMessage,
  MapOperationMessage,
  MapSyncSnapshotMessage,
  MapTokenErrorMessage,
  MapTokenUpdatedMessage
} from "@/app/api/mapApi";

export type ParsedMapSyncMessage =
  | { type: "invalid_json" }
  | { type: "unknown" }
  | { type: "sync_error"; payload: Record<string, unknown> }
  | { type: "sync_snapshot"; payload: MapSyncSnapshotMessage }
  | { type: "map_operation_applied"; payload: MapOperationMessage }
  | { type: "map_operation_batch_applied"; payload: MapOperationBatchAppliedMessage }
  | { type: "map_token_error"; payload: MapTokenErrorMessage }
  | { type: "map_token_updated"; payload: MapTokenUpdatedMessage };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseMapSyncSocketMessage(raw: unknown): ParsedMapSyncMessage {
  let message: unknown;

  try {
    message = JSON.parse(String(raw)) as unknown;
  } catch {
    return { type: "invalid_json" };
  }

  if (!isObject(message) || typeof message.type !== "string") {
    return { type: "unknown" };
  }

  switch (message.type) {
    case "sync_error":
      return { type: "sync_error", payload: message };
    case "sync_snapshot":
      return { type: "sync_snapshot", payload: message as MapSyncSnapshotMessage };
    case "map_operation_applied":
      return { type: "map_operation_applied", payload: message as MapOperationMessage };
    case "map_operation_batch_applied":
      return { type: "map_operation_batch_applied", payload: message as MapOperationBatchAppliedMessage };
    case "map_token_error":
      return { type: "map_token_error", payload: message as MapTokenErrorMessage };
    case "map_token_updated":
      return { type: "map_token_updated", payload: message as MapTokenUpdatedMessage };
    default:
      return { type: "unknown" };
  }
}
