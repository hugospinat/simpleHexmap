import type { MapTokenOperation, MapTokenPlacement } from "./types.js";
import { isHexColor, isInteger, isObject } from "./recordHelpers.js";

export function validateMapTokenOperation(operation: unknown): string | null {
  if (!isObject(operation) || typeof operation.type !== "string") {
    return "Invalid token operation payload.";
  }

  if (operation.type === "set_map_token") {
    const placement = operation.placement;

    if (
      !isObject(placement) ||
      typeof placement.userId !== "string" ||
      !placement.userId.trim() ||
      !isInteger(placement.q) ||
      !isInteger(placement.r)
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

export function applyMapTokenOperation(
  placements: readonly MapTokenPlacement[],
  operation: MapTokenOperation,
): MapTokenPlacement[] {
  switch (operation.type) {
    case "set_map_token": {
      const placement: MapTokenPlacement = {
        userId: operation.placement.userId,
        q: operation.placement.q,
        r: operation.placement.r,
      };
      return [
        ...placements.filter(
          (existing) => existing.userId !== placement.userId,
        ),
        placement,
      ];
    }
    case "remove_map_token":
      return placements.filter(
        (placement) => placement.userId !== operation.userId,
      );
    case "set_map_token_color":
      return [...placements];
    default: {
      const exhaustive: never = operation;
      void exhaustive;
      return [...placements];
    }
  }
}

export function applyMapTokenOperations(
  placements: readonly MapTokenPlacement[],
  operations: readonly MapTokenOperation[],
): MapTokenPlacement[] {
  return operations.reduce(
    (current, operation) => applyMapTokenOperation(current, operation),
    [...placements],
  );
}
