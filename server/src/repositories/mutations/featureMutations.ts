import { eq } from "drizzle-orm";
import { features } from "../../db/schema.js";
import { toMapScopedId } from "../mapContentRepository.js";
import { sanitizeFeaturePatch } from "../../../../src/core/protocol/index.js";
import {
  boolInt,
  type DbLike,
  type IncrementalOperationHandler,
} from "./mutationHelpers.js";

export const addFeature: IncrementalOperationHandler<"add_feature"> = async (
  tx,
  mapId,
  operation,
  updatedAt,
) => {
  await tx
    .insert(features)
    .values({
      createdAt: updatedAt,
      gmLabel: operation.feature.gmLabel,
      id: toMapScopedId(mapId, operation.feature.id),
      kind: operation.feature.kind,
      labelRevealed: boolInt(operation.feature.labelRevealed),
      overrideTerrainTile: boolInt(operation.feature.overrideTerrainTile),
      playerLabel: operation.feature.playerLabel,
      q: operation.feature.q,
      r: operation.feature.r,
      updatedAt,
      visibility: operation.feature.visibility,
      mapId,
    })
    .onConflictDoNothing();
};

export const setFeatureHidden: IncrementalOperationHandler<
  "set_feature_hidden"
> = async (tx, mapId, operation, updatedAt) => {
  await tx
    .update(features)
    .set({
      updatedAt,
      visibility: operation.hidden ? "hidden" : "visible",
    })
    .where(eq(features.id, toMapScopedId(mapId, operation.featureId)));
};

export const updateFeature: IncrementalOperationHandler<
  "update_feature"
> = async (tx, mapId, operation, updatedAt) => {
  const patch = sanitizeFeaturePatch(operation.patch);
  const set: Record<string, unknown> = { updatedAt };

  if ("kind" in patch && typeof patch.kind === "string") {
    set.kind = patch.kind;
  }
  if (
    "visibility" in patch &&
    (patch.visibility === "hidden" || patch.visibility === "visible")
  ) {
    set.visibility = patch.visibility;
  }
  if (
    "overrideTerrainTile" in patch &&
    typeof patch.overrideTerrainTile === "boolean"
  ) {
    set.overrideTerrainTile = boolInt(patch.overrideTerrainTile);
  }
  if (
    "gmLabel" in patch &&
    (typeof patch.gmLabel === "string" || patch.gmLabel === null)
  ) {
    set.gmLabel = patch.gmLabel;
  }
  if (
    "playerLabel" in patch &&
    (typeof patch.playerLabel === "string" || patch.playerLabel === null)
  ) {
    set.playerLabel = patch.playerLabel;
  }
  if ("labelRevealed" in patch && typeof patch.labelRevealed === "boolean") {
    set.labelRevealed = boolInt(patch.labelRevealed);
  }

  if (Object.keys(set).length === 1) {
    return;
  }

  await tx
    .update(features)
    .set(set)
    .where(eq(features.id, toMapScopedId(mapId, operation.featureId)));
};

export const removeFeature: IncrementalOperationHandler<
  "remove_feature"
> = async (tx, mapId, operation) => {
  await tx
    .delete(features)
    .where(eq(features.id, toMapScopedId(mapId, operation.featureId)));
};
