import type { MapOperation } from "../../../src/core/protocol/index.js";
import type { OperationEnvelope } from "../types.js";
import type {
  DbLike,
  IncrementalContentOperation,
  IncrementalOperationHandler,
} from "./mutations/mutationHelpers.js";
import { setTiles } from "./mutations/tileMutations.js";
import {
  addFaction,
  removeFaction,
  setFactionTerritories,
  updateFaction,
} from "./mutations/factionMutations.js";
import {
  addFeature,
  removeFeature,
  updateFeature,
} from "./mutations/featureMutations.js";
import { setRoadEdges } from "./mutations/roadMutations.js";
import { addRiverData, removeRiverData } from "./mutations/riverMutations.js";

const incrementalOperationHandlers: {
  [K in IncrementalContentOperation["type"]]: IncrementalOperationHandler<K>;
} = {
  set_tiles: setTiles,
  set_faction_territories: setFactionTerritories,
  add_faction: addFaction,
  update_faction: updateFaction,
  remove_faction: removeFaction,
  add_feature: addFeature,
  update_feature: updateFeature,
  remove_feature: removeFeature,
  add_river_data: addRiverData,
  remove_river_data: removeRiverData,
  set_road_edges: setRoadEdges,
};

function isIncrementalContentOperationType(
  type: MapOperation["type"],
): type is IncrementalContentOperation["type"] {
  return Object.hasOwn(incrementalOperationHandlers, type);
}

export function isIncrementalContentOperation(
  operation: MapOperation,
): operation is IncrementalContentOperation {
  return isIncrementalContentOperationType(operation.type);
}

async function applyIncrementalOperation(
  tx: DbLike,
  mapId: string,
  operation: IncrementalContentOperation,
  updatedAt: Date,
): Promise<void> {
  const handler = incrementalOperationHandlers[
    operation.type
  ] as IncrementalOperationHandler<typeof operation.type>;

  await handler(
    tx,
    mapId,
    operation as Extract<
      IncrementalContentOperation,
      { type: typeof operation.type }
    >,
    updatedAt,
  );
}

export async function applyIncrementalContentMutations(
  tx: DbLike,
  mapId: string,
  envelopes: OperationEnvelope[],
  updatedAt: Date,
): Promise<void> {
  for (const envelope of envelopes) {
    const operation = envelope.operation;

    if (!isIncrementalContentOperation(operation)) {
      continue;
    }

    await applyIncrementalOperation(tx, mapId, operation, updatedAt);
  }
}
