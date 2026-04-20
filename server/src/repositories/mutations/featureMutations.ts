import { and, eq } from "drizzle-orm";
import { features } from "../../db/schema.js";
import { sanitizeFeaturePatch } from "../../../../src/core/protocol/index.js";
import {
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
      hidden: operation.feature.hidden,
      id: operation.feature.id,
      kind: operation.feature.kind,
      labelRevealed: operation.feature.labelRevealed,
      playerLabel: operation.feature.playerLabel,
      q: operation.feature.q,
      r: operation.feature.r,
      updatedAt,
      mapId,
    })
    .onConflictDoNothing();
};

export const updateFeature: IncrementalOperationHandler<
  "update_feature"
> = async (tx, mapId, operation, updatedAt) => {
  const patch = sanitizeFeaturePatch(operation.patch);
  const set: Record<string, unknown> = { updatedAt };

  if ("kind" in patch && typeof patch.kind === "string") {
    set.kind = patch.kind;
  }
  if ("hidden" in patch && typeof patch.hidden === "boolean") {
    set.hidden = patch.hidden;
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
    set.labelRevealed = patch.labelRevealed;
  }

  if (Object.keys(set).length === 1) {
    return;
  }

  await tx
    .update(features)
    .set(set)
    .where(
      and(eq(features.mapId, mapId), eq(features.id, operation.featureId)),
    );
};

export const removeFeature: IncrementalOperationHandler<
  "remove_feature"
> = async (tx, mapId, operation) => {
  await tx
    .delete(features)
    .where(
      and(eq(features.mapId, mapId), eq(features.id, operation.featureId)),
    );
};
