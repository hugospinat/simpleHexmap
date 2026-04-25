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
      featureLevel: operation.feature.featureLevel,
      hidden: operation.feature.hidden,
      id: operation.feature.id,
      kind: operation.feature.kind,
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

  if ("hidden" in patch && typeof patch.hidden === "boolean") {
    set.hidden = patch.hidden;
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
