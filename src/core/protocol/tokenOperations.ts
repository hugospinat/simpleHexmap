import type {
  MapTokenOperation,
  MapTokenRecord,
  SavedMapContent,
} from "./types.js";
import { isHexColor, isInteger, isObject } from "./recordHelpers.js";

export function validateMapTokenOperation(operation: unknown): string | null {
  if (!isObject(operation) || typeof operation.type !== "string") {
    return "Invalid token operation payload.";
  }

  if (operation.type === "set_map_token") {
    const token = operation.token;

    if (
      !isObject(token) ||
      typeof token.userId !== "string" ||
      !token.userId.trim() ||
      !isInteger(token.q) ||
      !isInteger(token.r) ||
      typeof token.color !== "string" ||
      !isHexColor(token.color)
    ) {
      return "Invalid set_map_token operation.";
    }

    return null;
  }

  if (operation.type === "remove_map_token") {
    return typeof operation.userId === "string" && operation.userId.trim()
      ? null
      : "Invalid remove_map_token operation.";
  }

  if (operation.type === "set_map_token_color") {
    return typeof operation.userId === "string" &&
      operation.userId.trim() &&
      typeof operation.color === "string" &&
      isHexColor(operation.color)
      ? null
      : "Invalid set_map_token_color operation.";
  }

  return "Unknown token operation.";
}

export function applyMapTokenOperation<TSnapshot extends SavedMapContent>(
  snapshot: TSnapshot,
  operation: MapTokenOperation,
): TSnapshot {
  switch (operation.type) {
    case "set_map_token": {
      const token: MapTokenRecord = {
        userId: operation.token.userId,
        q: operation.token.q,
        r: operation.token.r,
        color: operation.token.color,
      };
      return {
        ...snapshot,
        tokens: [
          ...snapshot.tokens.filter(
            (existing) => existing.userId !== token.userId,
          ),
          token,
        ],
      };
    }
    case "remove_map_token":
      return {
        ...snapshot,
        tokens: snapshot.tokens.filter(
          (token) => token.userId !== operation.userId,
        ),
      };
    case "set_map_token_color":
      return {
        ...snapshot,
        tokens: snapshot.tokens.map((token) =>
          token.userId === operation.userId
            ? { ...token, color: operation.color }
            : token,
        ),
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
  operations: readonly MapTokenOperation[],
): TSnapshot {
  return operations.reduce(
    (current, operation) => applyMapTokenOperation(current, operation),
    snapshot,
  );
}
