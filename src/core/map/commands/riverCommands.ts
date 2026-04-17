import { hexKey } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { getCanonicalRiverEdgeRef } from "@/core/map/rivers";
import { applyOperationToWorld } from "@/core/map/worldOperationApplier";
import { getRiverLevelMap, type RiverEdgeRef, type MapState } from "@/core/map/world";
import type { MapOperation } from "@/core/protocol";
import { emptyCommandResult, type MapEditCommandResult } from "./commandTypes";

function hasRiverEdge(world: MapState, ref: RiverEdgeRef): boolean {
  return getRiverLevelMap(world, SOURCE_LEVEL).get(hexKey(ref.axial))?.has(ref.edge) ?? false;
}

export function commandSetRiverEdge(
  world: MapState,
  level: number,
  ref: RiverEdgeRef,
  enabled: boolean
): MapEditCommandResult {
  if (level !== SOURCE_LEVEL) {
    return emptyCommandResult(world);
  }

  const canonical = getCanonicalRiverEdgeRef(ref);

  if (hasRiverEdge(world, canonical) === enabled) {
    return emptyCommandResult(world);
  }

  const operation: MapOperation = enabled
    ? {
      type: "add_river_data",
      river: {
        q: canonical.axial.q,
        r: canonical.axial.r,
        edge: canonical.edge
      }
    }
    : {
      type: "remove_river_data",
      river: {
        q: canonical.axial.q,
        r: canonical.axial.r,
        edge: canonical.edge
      }
    };

  return {
    changed: true,
    mapState: applyOperationToWorld(world, operation),
    operations: [operation]
  };
}
