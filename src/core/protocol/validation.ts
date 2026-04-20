import type { MapOperation } from "./types.js";
import {
  isHexColor,
  isInteger,
  isObject,
  isRoadOrRiverEdge,
  sanitizeFactionPatch,
  sanitizeFeaturePatch,
} from "./recordHelpers.js";

const maxSemanticCellsPerOperation = 5000;

function isValidCellRef(value: unknown): value is { q: number; r: number } {
  return isObject(value) && isInteger(value.q) && isInteger(value.r);
}

function isValidCellRefArray(
  value: unknown,
): value is Array<{ q: number; r: number }> {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= maxSemanticCellsPerOperation &&
    value.every(isValidCellRef)
  );
}

export function validateMapOperation(operation: unknown): string | null {
  if (!isObject(operation) || typeof operation.type !== "string") {
    return "Invalid operation payload.";
  }

  const candidate = operation as Partial<MapOperation> &
    Record<string, unknown>;

  if (candidate.type === "paint_cells") {
    if (
      !isValidCellRefArray(candidate.cells) ||
      typeof candidate.hidden !== "boolean" ||
      (candidate.terrain !== null && typeof candidate.terrain !== "string")
    ) {
      return "Invalid paint_cells operation.";
    }

    return null;
  }

  if (candidate.type === "set_cells_hidden") {
    if (
      !isValidCellRefArray(candidate.cells) ||
      typeof candidate.hidden !== "boolean"
    ) {
      return "Invalid set_cells_hidden operation.";
    }

    return null;
  }

  if (candidate.type === "assign_faction_cells") {
    if (
      !isValidCellRefArray(candidate.cells) ||
      (candidate.factionId !== null && typeof candidate.factionId !== "string")
    ) {
      return "Invalid assign_faction_cells operation.";
    }

    return null;
  }

  if (candidate.type === "set_tiles") {
    const tiles = candidate.tiles;

    if (
      !Array.isArray(tiles) ||
      tiles.length === 0 ||
      tiles.length > maxSemanticCellsPerOperation ||
      !tiles.every(
        (tile) =>
          isObject(tile) &&
          isInteger(tile.q) &&
          isInteger(tile.r) &&
          typeof tile.hidden === "boolean" &&
          (tile.terrain === null || typeof tile.terrain === "string"),
      )
    ) {
      return "Invalid set_tiles operation.";
    }

    return null;
  }

  if (candidate.type === "set_faction_territories") {
    const territories = candidate.territories;

    if (
      !Array.isArray(territories) ||
      territories.length === 0 ||
      territories.length > maxSemanticCellsPerOperation ||
      !territories.every(
        (territory) =>
          isObject(territory) &&
          isInteger(territory.q) &&
          isInteger(territory.r) &&
          (territory.factionId === null ||
            typeof territory.factionId === "string"),
      )
    ) {
      return "Invalid set_faction_territories operation.";
    }

    return null;
  }

  if (candidate.type === "add_feature") {
    const feature = candidate.feature;

    if (
      !isObject(feature) ||
      typeof feature.id !== "string" ||
      !isInteger(feature.q) ||
      !isInteger(feature.r) ||
      typeof feature.kind !== "string"
    ) {
      return "Invalid add_feature operation.";
    }

    return null;
  }

  if (candidate.type === "update_feature") {
    if (
      typeof candidate.featureId !== "string" ||
      !isObject(candidate.patch) ||
      Object.keys(sanitizeFeaturePatch(candidate.patch)).length === 0
    ) {
      return "Invalid update_feature operation.";
    }

    return null;
  }

  if (candidate.type === "set_feature_hidden") {
    if (
      typeof candidate.featureId !== "string" ||
      typeof candidate.hidden !== "boolean"
    ) {
      return "Invalid set_feature_hidden operation.";
    }

    return null;
  }

  if (candidate.type === "remove_feature") {
    return typeof candidate.featureId === "string"
      ? null
      : "Invalid remove_feature operation.";
  }

  if (
    candidate.type === "add_river_data" ||
    candidate.type === "remove_river_data"
  ) {
    const river = candidate.river;

    if (
      !isObject(river) ||
      !isInteger(river.q) ||
      !isInteger(river.r) ||
      !isRoadOrRiverEdge(river.edge)
    ) {
      return `Invalid ${candidate.type} operation.`;
    }

    return null;
  }

  if (candidate.type === "set_road_edges") {
    const cell = candidate.cell;
    const edges = candidate.edges;

    if (
      !isValidCellRef(cell) ||
      !Array.isArray(edges) ||
      !edges.every(isRoadOrRiverEdge)
    ) {
      return "Invalid set_road_edges operation.";
    }

    return null;
  }

  if (candidate.type === "add_faction") {
    const faction = candidate.faction;

    if (
      !isObject(faction) ||
      typeof faction.id !== "string" ||
      typeof faction.name !== "string" ||
      !isHexColor(faction.color)
    ) {
      return "Invalid add_faction operation.";
    }

    return null;
  }

  if (candidate.type === "update_faction") {
    if (
      typeof candidate.factionId !== "string" ||
      !isObject(candidate.patch) ||
      Object.keys(sanitizeFactionPatch(candidate.patch)).length === 0
    ) {
      return "Invalid update_faction operation.";
    }

    return null;
  }

  if (candidate.type === "remove_faction") {
    return typeof candidate.factionId === "string"
      ? null
      : "Invalid remove_faction operation.";
  }

  if (candidate.type === "rename_map") {
    return typeof candidate.name === "string"
      ? null
      : "Invalid rename_map operation.";
  }

  return "Unknown operation type.";
}
