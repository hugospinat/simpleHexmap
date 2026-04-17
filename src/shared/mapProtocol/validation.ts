import type { MapOperation } from "./types.js";
import {
  getRoadEdgeBetween,
  getTileOperationTerrain,
  isHexColor,
  isInteger,
  isObject,
  isRoadOrRiverEdge,
  sanitizeFactionPatch,
  sanitizeFeaturePatch
} from "./recordHelpers.js";

export function validateMapOperation(operation: unknown): string | null {
  if (!isObject(operation) || typeof operation.type !== "string") {
    return "Invalid operation payload.";
  }

  const candidate = operation as Partial<MapOperation> & Record<string, unknown>;

  if (candidate.type === "set_tile") {
    const tile = candidate.tile;
    const terrain = isObject(tile) ? getTileOperationTerrain(tile) : null;

    if (
      !isObject(tile)
      || !isInteger(tile.q)
      || !isInteger(tile.r)
      || typeof tile.hidden !== "boolean"
      || (terrain === null && tile.terrain !== null && tile.tileId !== null)
    ) {
      return "Invalid set_tile operation.";
    }

    return null;
  }

  if (candidate.type === "set_cell_hidden") {
    const cell = candidate.cell;

    if (!isObject(cell) || !isInteger(cell.q) || !isInteger(cell.r) || typeof cell.hidden !== "boolean") {
      return "Invalid set_cell_hidden operation.";
    }

    return null;
  }

  if (candidate.type === "add_feature") {
    const feature = candidate.feature;
    const kind = isObject(feature) && typeof feature.kind === "string"
      ? feature.kind
      : isObject(feature) && typeof feature.type === "string"
        ? feature.type
        : null;

    if (!isObject(feature) || typeof feature.id !== "string" || !isInteger(feature.q) || !isInteger(feature.r) || typeof kind !== "string") {
      return "Invalid add_feature operation.";
    }

    return null;
  }

  if (candidate.type === "update_feature") {
    if (typeof candidate.featureId !== "string" || !isObject(candidate.patch) || Object.keys(sanitizeFeaturePatch(candidate.patch)).length === 0) {
      return "Invalid update_feature operation.";
    }

    return null;
  }

  if (candidate.type === "set_feature_hidden") {
    if (typeof candidate.featureId !== "string" || typeof candidate.hidden !== "boolean") {
      return "Invalid set_feature_hidden operation.";
    }

    return null;
  }

  if (candidate.type === "remove_feature") {
    return typeof candidate.featureId === "string" ? null : "Invalid remove_feature operation.";
  }

  if (candidate.type === "add_river_data" || candidate.type === "remove_river_data") {
    const river = candidate.river;

    if (!isObject(river) || !isInteger(river.q) || !isInteger(river.r) || !isRoadOrRiverEdge(river.edge)) {
      return `Invalid ${candidate.type} operation.`;
    }

    return null;
  }

  if (candidate.type === "add_road_data" || candidate.type === "update_road_data") {
    const road = candidate.road;

    if (!isObject(road) || !isInteger(road.q) || !isInteger(road.r) || !Array.isArray(road.edges) || !road.edges.every(isRoadOrRiverEdge)) {
      return `Invalid ${candidate.type} operation.`;
    }

    return null;
  }

  if (candidate.type === "remove_road_data") {
    const road = candidate.road;

    if (!isObject(road) || !isInteger(road.q) || !isInteger(road.r)) {
      return "Invalid remove_road_data operation.";
    }

    return null;
  }

  if (candidate.type === "add_road_connection") {
    const from = candidate.from;
    const to = candidate.to;

    if (!isObject(from) || !isInteger(from.q) || !isInteger(from.r) || !isObject(to) || !isInteger(to.q) || !isInteger(to.r) || getRoadEdgeBetween(from, to) === null) {
      return "Invalid add_road_connection operation.";
    }

    return null;
  }

  if (candidate.type === "remove_road_connections_at") {
    const cell = candidate.cell;

    if (!isObject(cell) || !isInteger(cell.q) || !isInteger(cell.r)) {
      return "Invalid remove_road_connections_at operation.";
    }

    return null;
  }

  if (candidate.type === "add_faction") {
    const faction = candidate.faction;

    if (!isObject(faction) || typeof faction.id !== "string" || typeof faction.name !== "string" || !isHexColor(faction.color)) {
      return "Invalid add_faction operation.";
    }

    return null;
  }

  if (candidate.type === "update_faction") {
    if (typeof candidate.factionId !== "string" || !isObject(candidate.patch) || Object.keys(sanitizeFactionPatch(candidate.patch)).length === 0) {
      return "Invalid update_faction operation.";
    }

    return null;
  }

  if (candidate.type === "remove_faction") {
    return typeof candidate.factionId === "string" ? null : "Invalid remove_faction operation.";
  }

  if (candidate.type === "set_faction_territory") {
    const territory = candidate.territory;

    if (!isObject(territory) || !isInteger(territory.q) || !isInteger(territory.r) || (territory.factionId !== null && typeof territory.factionId !== "string")) {
      return "Invalid set_faction_territory operation.";
    }

    return null;
  }

  if (candidate.type === "rename_map") {
    return typeof candidate.name === "string" ? null : "Invalid rename_map operation.";
  }

  return "Unknown operation type.";
}
