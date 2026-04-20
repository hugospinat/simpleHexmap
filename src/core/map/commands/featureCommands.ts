import { parseHexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { applyOperationToWorld } from "@/core/map/worldOperationApplier";
import {
  getFeatureAt,
  getFeatureById,
  type Feature,
  type MapState,
} from "@/core/map/world";
import type { MapOperation } from "@/core/protocol";
import { emptyCommandResult, type MapEditCommandResult } from "./commandTypes";

function featureToRecord(
  feature: Feature,
): Extract<MapOperation, { type: "add_feature" }>["feature"] {
  const axial = parseHexKey(feature.hexId);

  return {
    id: feature.id,
    kind: feature.kind,
    q: axial.q,
    r: axial.r,
    hidden: feature.hidden,
    gmLabel: feature.gmLabel ?? null,
    playerLabel: feature.playerLabel ?? null,
    labelRevealed: feature.labelRevealed ?? false,
  };
}

export function commandAddFeature(
  world: MapState,
  level: number,
  feature: Feature,
): MapEditCommandResult {
  if (
    level !== SOURCE_LEVEL ||
    getFeatureById(world, SOURCE_LEVEL, feature.id) ||
    getFeatureAt(world, SOURCE_LEVEL, parseHexKey(feature.hexId))
  ) {
    return emptyCommandResult(world);
  }

  const operation: MapOperation = {
    type: "add_feature",
    feature: featureToRecord(feature),
  };

  return {
    changed: true,
    mapState: applyOperationToWorld(world, operation),
    operations: [operation],
  };
}

export function commandUpdateFeature(
  world: MapState,
  level: number,
  featureId: string,
  updates: Partial<
    Pick<
      Feature,
      "gmLabel" | "hidden" | "kind" | "labelRevealed" | "playerLabel"
    >
  >,
): MapEditCommandResult {
  const patch: Extract<MapOperation, { type: "update_feature" }>["patch"] = {};

  if (level === SOURCE_LEVEL && typeof updates.kind === "string") {
    patch.kind = updates.kind;
  }
  if (typeof updates.hidden === "boolean") {
    patch.hidden = updates.hidden;
  }
  if ("gmLabel" in updates) {
    patch.gmLabel = updates.gmLabel?.trim() ? updates.gmLabel : null;
  }
  if ("playerLabel" in updates) {
    patch.playerLabel = updates.playerLabel?.trim()
      ? updates.playerLabel
      : null;
  }
  if (typeof updates.labelRevealed === "boolean") {
    patch.labelRevealed = updates.labelRevealed;
  }

  if (Object.keys(patch).length === 0) {
    return emptyCommandResult(world);
  }

  const operation: MapOperation = {
    type: "update_feature",
    featureId,
    patch,
  };
  const nextWorld = applyOperationToWorld(world, operation);

  return nextWorld !== world
    ? { changed: true, mapState: nextWorld, operations: [operation] }
    : emptyCommandResult(world);
}

export function commandSetFeatureHidden(
  world: MapState,
  featureId: string,
  hidden: boolean,
): MapEditCommandResult {
  return commandUpdateFeature(world, SOURCE_LEVEL, featureId, { hidden });
}

export function commandRemoveFeature(
  world: MapState,
  featureId: string,
): MapEditCommandResult {
  if (!getFeatureById(world, SOURCE_LEVEL, featureId)) {
    return emptyCommandResult(world);
  }

  const operation: MapOperation = {
    type: "remove_feature",
    featureId,
  };

  return {
    changed: true,
    mapState: applyOperationToWorld(world, operation),
    operations: [operation],
  };
}

export function commandToggleFeatureHiddenAt(
  world: MapState,
  level: number,
  axial: Axial,
): MapEditCommandResult {
  const feature = getFeatureAt(world, level, axial);

  if (!feature) {
    return emptyCommandResult(world);
  }

  return commandSetFeatureHidden(world, feature.id, !feature.hidden);
}
