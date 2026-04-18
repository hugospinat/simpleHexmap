import type { HexId } from "@/core/geometry/hex";
import { boundsIntersects, type WorldBounds } from "./pixiGeometry";

export type PixiSpatialIndexRecord = {
  bounds: WorldBounds;
  hexId: HexId;
};

export type PixiSpatialIndex = {
  has: (hexId: HexId) => boolean;
  queryCells: (bounds: WorldBounds) => HexId[];
  size: () => number;
};

export function createPixiSpatialIndex(records: Iterable<PixiSpatialIndexRecord>): PixiSpatialIndex {
  const indexedRecords = Array.from(records);
  const hexIds = new Set(indexedRecords.map((record) => record.hexId));

  return {
    has: (hexId) => hexIds.has(hexId),
    queryCells: (bounds) => indexedRecords
      .filter((record) => boundsIntersects(record.bounds, bounds))
      .map((record) => record.hexId),
    size: () => indexedRecords.length
  };
}
