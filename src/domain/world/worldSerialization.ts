import type { Feature } from "@/domain/world/features";
import type { RoadEdgeIndex } from "@/domain/world/roads";
import type { HexCell, RiverEdgeIndex, World } from "@/domain/world/worldTypes";
import { TERRAIN_TYPES, type TerrainType } from "@/domain/world/terrainTypes";

type SerializedLevelMap<T> = Record<string, T>;

export type SerializedWorld = {
  levels: Record<string, SerializedLevelMap<HexCell>>;
  featuresByLevel: Record<string, SerializedLevelMap<Feature>>;
  riversByLevel: Record<string, SerializedLevelMap<RiverEdgeIndex[]>>;
  roadsByLevel: Record<string, SerializedLevelMap<RoadEdgeIndex[]>>;
};

function serializeLevelRecord<T>(
  levels: Record<number, Map<string, T>>,
  toSerializable: (value: T) => unknown = (value) => value
): Record<string, Record<string, unknown>> {
  const serialized: Record<string, Record<string, unknown>> = {};

  for (const [levelKey, levelMap] of Object.entries(levels)) {
    const level: Record<string, unknown> = {};

    for (const [hexId, value] of levelMap.entries()) {
      level[hexId] = toSerializable(value);
    }

    serialized[levelKey] = level;
  }

  return serialized;
}

function deserializeLevelRecord<T>(
  input: unknown,
  fromSerializable: (value: unknown) => T
): Record<number, Map<string, T>> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const record = input as Record<string, unknown>;
  const levels: Record<number, Map<string, T>> = {};

  for (const [levelKey, levelMap] of Object.entries(record)) {
    const level = Number(levelKey);

    if (!Number.isFinite(level) || !levelMap || typeof levelMap !== "object") {
      continue;
    }

    const nextLevelMap = new Map<string, T>();

    for (const [hexId, value] of Object.entries(levelMap as Record<string, unknown>)) {
      nextLevelMap.set(hexId, fromSerializable(value));
    }

    levels[level] = nextLevelMap;
  }

  return levels;
}

function toEdgeSet(value: unknown): Set<RiverEdgeIndex> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(value.filter((edge) => Number.isInteger(edge)) as RiverEdgeIndex[]);
}

function toRoadEdgeSet(value: unknown): Set<RoadEdgeIndex> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  return new Set(value.filter((edge) => Number.isInteger(edge)) as RoadEdgeIndex[]);
}

export function serializeWorld(world: World): SerializedWorld {
  return {
    levels: serializeLevelRecord(world.levels) as SerializedWorld["levels"],
    featuresByLevel: serializeLevelRecord(world.featuresByLevel) as SerializedWorld["featuresByLevel"],
    riversByLevel: serializeLevelRecord(
      world.riversByLevel,
      (edges: Set<RiverEdgeIndex>) => Array.from(edges.values())
    ) as SerializedWorld["riversByLevel"],
    roadsByLevel: serializeLevelRecord(
      world.roadsByLevel,
      (edges: Set<RoadEdgeIndex>) => Array.from(edges.values())
    ) as SerializedWorld["roadsByLevel"]
  };
}

export function deserializeWorld(input: unknown): World {
  const source = (input && typeof input === "object") ? input as Record<string, unknown> : {};

  return {
    levels: deserializeLevelRecord<HexCell>(source.levels, (value) => {
      const candidate = value && typeof value === "object"
        ? (value as { type?: unknown }).type
        : undefined;

      if (typeof candidate === "string" && TERRAIN_TYPES.includes(candidate as TerrainType)) {
        return { type: candidate as TerrainType };
      }

      return { type: "plain" };
    }),
    featuresByLevel: deserializeLevelRecord<Feature>(
      source.featuresByLevel,
      (value) => (value && typeof value === "object" ? value as Feature : {
        id: "feature-invalid",
        kind: "marker",
        hexId: "0,0",
        hidden: false,
        overrideTerrainTile: false
      })
    ),
    riversByLevel: deserializeLevelRecord<Set<RiverEdgeIndex>>(source.riversByLevel, toEdgeSet),
    roadsByLevel: deserializeLevelRecord<Set<RoadEdgeIndex>>(source.roadsByLevel, toRoadEdgeSet)
  };
}
