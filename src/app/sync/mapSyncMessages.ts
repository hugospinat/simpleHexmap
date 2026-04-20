import { z } from "zod";
import type {
  MapOperationMessage,
  MapSyncSnapshotMessage,
  MapTokenErrorMessage,
  MapTokenUpdatedMessage,
} from "@/app/api/mapApi";

export type ParsedMapSyncMessage =
  | { type: "invalid_json" }
  | { type: "invalid_message"; error: string }
  | { type: "unknown" }
  | { type: "sync_error"; payload: Record<string, unknown> }
  | { type: "sync_snapshot"; payload: MapSyncSnapshotMessage }
  | { type: "map_operation_applied"; payload: MapOperationMessage }
  | { type: "map_token_error"; payload: MapTokenErrorMessage }
  | { type: "map_token_updated"; payload: MapTokenUpdatedMessage };

// Structural schemas. Domain payloads (MapOperation, MapTokenOperation,
// MapDocument) are intentionally accepted as `unknown` / passthrough here
// because their content is validated by dedicated domain validators before
// being applied to the session. The goal of this module is only to enforce
// that the transport envelope has the right shape and types, so we never cast
// an unrelated message into a domain type.
const operationPayloadSchema = z.object({ type: z.string() }).passthrough();

const syncErrorSchema = z
  .object({ type: z.literal("sync_error") })
  .passthrough();

const syncSnapshotSchema = z
  .object({
    type: z.literal("sync_snapshot"),
    lastSequence: z.number().int().nonnegative(),
    workspaceMembers: z.array(z.unknown()),
    updatedAt: z.string(),
    document: z.object({}).passthrough(),
    tokenPlacements: z.array(z.unknown()),
  })
  .passthrough();

const mapOperationAppliedSchema = z
  .object({
    type: z.literal("map_operation_applied"),
    sequence: z.number().int().nonnegative(),
    operationId: z.string(),
    operation: operationPayloadSchema,
    sourceClientId: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

const mapTokenErrorSchema = z
  .object({
    type: z.literal("map_token_error"),
    error: z.string(),
  })
  .passthrough();

const mapTokenUpdatedSchema = z
  .object({
    type: z.literal("map_token_updated"),
    operation: operationPayloadSchema,
    sourceUserId: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type EnvelopeSchema = z.ZodType<unknown>;

function matchEnvelope<TPayload>(
  schema: EnvelopeSchema,
  message: unknown,
  onSuccess: (payload: unknown) => TPayload,
): TPayload | { type: "invalid_message"; error: string } {
  const result = schema.safeParse(message);
  if (!result.success) {
    return { type: "invalid_message", error: result.error.message };
  }
  return onSuccess(result.data);
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
      return matchEnvelope(syncErrorSchema, message, (data) => ({
        type: "sync_error",
        payload: data as Record<string, unknown>,
      }));
    case "sync_snapshot":
      return matchEnvelope(syncSnapshotSchema, message, (data) => ({
        type: "sync_snapshot",
        payload: data as unknown as MapSyncSnapshotMessage,
      }));
    case "map_operation_applied":
      return matchEnvelope(mapOperationAppliedSchema, message, (data) => ({
        type: "map_operation_applied",
        payload: data as unknown as MapOperationMessage,
      }));
    case "map_token_error":
      return matchEnvelope(mapTokenErrorSchema, message, (data) => ({
        type: "map_token_error",
        payload: data as unknown as MapTokenErrorMessage,
      }));
    case "map_token_updated":
      return matchEnvelope(mapTokenUpdatedSchema, message, (data) => ({
        type: "map_token_updated",
        payload: data as unknown as MapTokenUpdatedMessage,
      }));
    default:
      return { type: "unknown" };
  }
}
