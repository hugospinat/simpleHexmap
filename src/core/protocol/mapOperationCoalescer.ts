import type { MapOperation } from "./types.js";
import { riverKey, roadKey } from "./recordHelpers.js";

function mergeTilesByLastWrite(
  left: Extract<MapOperation, { type: "set_tiles" }>["tiles"],
  right: Extract<MapOperation, { type: "set_tiles" }>["tiles"],
): Extract<MapOperation, { type: "set_tiles" }> {
  const byKey = new Map<
    string,
    Extract<MapOperation, { type: "set_tiles" }>["tiles"][number]
  >();

  for (const tile of [...left, ...right]) {
    byKey.set(`${tile.q},${tile.r}`, tile);
  }

  return {
    type: "set_tiles",
    tiles: Array.from(byKey.values()),
  };
}

function mergeTerritoriesByLastWrite(
  left: Extract<
    MapOperation,
    { type: "set_faction_territories" }
  >["territories"],
  right: Extract<
    MapOperation,
    { type: "set_faction_territories" }
  >["territories"],
): Extract<MapOperation, { type: "set_faction_territories" }> {
  const byKey = new Map<
    string,
    Extract<
      MapOperation,
      { type: "set_faction_territories" }
    >["territories"][number]
  >();

  for (const territory of [...left, ...right]) {
    byKey.set(`${territory.q},${territory.r}`, territory);
  }

  return {
    type: "set_faction_territories",
    territories: Array.from(byKey.values()),
  };
}

function coalesceAdjacentOperation(
  previous: MapOperation,
  next: MapOperation,
): MapOperation | null {
  if (previous.type !== next.type) {
    return null;
  }

  switch (next.type) {
    case "set_tiles":
      return previous.type === "set_tiles"
        ? mergeTilesByLastWrite(previous.tiles, next.tiles)
        : null;
    case "set_faction_territories":
      return previous.type === "set_faction_territories"
        ? mergeTerritoriesByLastWrite(previous.territories, next.territories)
        : null;
    case "set_note":
      return previous.type === "set_note" &&
        `${previous.note.q},${previous.note.r}` === `${next.note.q},${next.note.r}`
        ? next
        : null;
    case "update_feature":
      return previous.type === "update_feature" &&
        previous.featureId === next.featureId
        ? {
            ...next,
            patch: {
              ...previous.patch,
              ...next.patch,
            },
          }
        : null;
    case "remove_feature":
      return previous.type === "remove_feature" &&
        previous.featureId === next.featureId
        ? previous
        : null;
    case "add_river_data":
      return previous.type === "add_river_data" &&
        riverKey(previous.river) === riverKey(next.river)
        ? previous
        : null;
    case "remove_river_data":
      return previous.type === "remove_river_data" &&
        riverKey(previous.river) === riverKey(next.river)
        ? previous
        : null;
    case "set_road_edges":
      return previous.type === "set_road_edges" &&
        roadKey(previous.cell) === roadKey(next.cell)
        ? next
        : null;
    case "update_faction":
      return previous.type === "update_faction" &&
        previous.factionId === next.factionId
        ? {
            ...next,
            patch: {
              ...previous.patch,
              ...next.patch,
            },
          }
        : null;
    case "remove_faction":
      return previous.type === "remove_faction" &&
        previous.factionId === next.factionId
        ? previous
        : null;
    case "add_feature":
    case "add_faction":
      return null;
    default: {
      const exhaustive: never = next;
      void exhaustive;
      return null;
    }
  }
}

export function coalesceMapOperations(
  operations: readonly MapOperation[],
): MapOperation[] {
  const coalesced: MapOperation[] = [];

  for (const operation of operations) {
    const previous = coalesced.at(-1);
    const merged = previous
      ? coalesceAdjacentOperation(previous, operation)
      : null;

    if (merged) {
      coalesced[coalesced.length - 1] = merged;
    } else {
      coalesced.push(operation);
    }
  }

  return coalesced;
}
