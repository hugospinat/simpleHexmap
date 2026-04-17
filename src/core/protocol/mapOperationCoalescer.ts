import type { MapOperation } from "./types.js";
import { riverKey, tileKey } from "./recordHelpers.js";

function sameTile(left: { q: number; r: number }, right: { q: number; r: number }): boolean {
  return left.q === right.q && left.r === right.r;
}

function sameRoadConnection(
  left: Extract<MapOperation, { type: "add_road_connection" }>,
  right: Extract<MapOperation, { type: "add_road_connection" }>
): boolean {
  return sameTile(left.from, right.from) && sameTile(left.to, right.to);
}

function coalesceAdjacentOperation(previous: MapOperation, next: MapOperation): MapOperation | null {
  if (previous.type !== next.type) {
    return null;
  }

  switch (next.type) {
    case "set_tile":
      return previous.type === "set_tile" && tileKey(previous.tile) === tileKey(next.tile) ? next : null;
    case "set_cell_hidden":
      return previous.type === "set_cell_hidden" && sameTile(previous.cell, next.cell) ? next : null;
    case "set_feature_hidden":
      return previous.type === "set_feature_hidden" && previous.featureId === next.featureId ? next : null;
    case "update_feature":
      return previous.type === "update_feature" && previous.featureId === next.featureId
        ? {
            ...next,
            patch: {
              ...previous.patch,
              ...next.patch
            }
          }
        : null;
    case "remove_feature":
      return previous.type === "remove_feature" && previous.featureId === next.featureId ? previous : null;
    case "add_river_data":
      return previous.type === "add_river_data" && riverKey(previous.river) === riverKey(next.river) ? previous : null;
    case "remove_river_data":
      return previous.type === "remove_river_data" && riverKey(previous.river) === riverKey(next.river) ? previous : null;
    case "add_road_connection":
      return previous.type === "add_road_connection" && sameRoadConnection(previous, next) ? previous : null;
    case "remove_road_connections_at":
      return previous.type === "remove_road_connections_at" && sameTile(previous.cell, next.cell) ? previous : null;
    case "update_faction":
      return previous.type === "update_faction" && previous.factionId === next.factionId
        ? {
            ...next,
            patch: {
              ...previous.patch,
              ...next.patch
            }
          }
        : null;
    case "remove_faction":
      return previous.type === "remove_faction" && previous.factionId === next.factionId ? previous : null;
    case "set_faction_territory":
      return previous.type === "set_faction_territory" && sameTile(previous.territory, next.territory) ? next : null;
    case "add_feature":
    case "add_faction":
    case "add_road_data":
    case "update_road_data":
    case "remove_road_data":
    case "rename_map":
      return null;
    default: {
      const exhaustive: never = next;
      void exhaustive;
      return null;
    }
  }
}

export function coalesceMapOperations(operations: readonly MapOperation[]): MapOperation[] {
  const coalesced: MapOperation[] = [];

  for (const operation of operations) {
    const previous = coalesced.at(-1);
    const merged = previous ? coalesceAdjacentOperation(previous, operation) : null;

    if (merged) {
      coalesced[coalesced.length - 1] = merged;
    } else {
      coalesced.push(operation);
    }
  }

  return coalesced;
}
