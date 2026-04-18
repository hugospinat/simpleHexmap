import type { MapTokenOperation, MapTokenRecord, SavedMapContent } from "./types.js";
import { isHexColor, isInteger, isObject } from "./recordHelpers.js";

export function validateMapTokenOperation(operation: unknown): string | null {
  if (!isObject(operation) || typeof operation.type !== "string") {
    return "Invalid token operation payload.";
  }

  if (operation.type === "set_map_token") {
    const token = operation.token;

    if (
      !isObject(token)
      || typeof token.profileId !== "string"
      || !token.profileId.trim()
      || !isInteger(token.q)
      || !isInteger(token.r)
      || typeof token.color !== "string"
      || !isHexColor(token.color)
    ) {
      return "Invalid set_map_token operation.";
    }

    return null;
  }

  if (operation.type === "remove_map_token") {
    return typeof operation.profileId === "string" && operation.profileId.trim()
      ? null
      : "Invalid remove_map_token operation.";
  }

  return "Unknown token operation.";
}

export function applyMapTokenOperation<TSnapshot extends SavedMapContent>(
  snapshot: TSnapshot,
  operation: MapTokenOperation
): TSnapshot {
  switch (operation.type) {
    case "set_map_token": {
      const token: MapTokenRecord = {
        profileId: operation.token.profileId,
        q: operation.token.q,
        r: operation.token.r,
        color: operation.token.color
      };
      return {
        ...snapshot,
        tokens: [
          ...snapshot.tokens.filter((existing) => existing.profileId !== token.profileId),
          token
        ]
      };
    }
    case "remove_map_token":
      return {
        ...snapshot,
        tokens: snapshot.tokens.filter((token) => token.profileId !== operation.profileId)
      };
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return snapshot;
    }
  }
}

export function applyMapTokenOperations<TSnapshot extends SavedMapContent>(
  snapshot: TSnapshot,
  operations: readonly MapTokenOperation[]
): TSnapshot {
  return operations.reduce((current, operation) => applyMapTokenOperation(current, operation), snapshot);
}
