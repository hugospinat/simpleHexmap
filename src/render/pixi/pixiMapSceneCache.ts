import { hexKey, parseHexKey, type HexId } from "@/core/geometry/hex";
import { MAP_LEVELS, SOURCE_LEVEL, type MapLevel } from "@/core/map/mapRules";
import { buildMapLevelView } from "@/core/map/mapLevelView";
import {
  getNeighborForRiverEdge,
  getNeighborForRoadEdge,
  type RoadEdgeIndex,
} from "@/core/map/world";
import type { MapState, MapStateVersions } from "@/core/map/worldTypes";
import type { MapOperation } from "@/core/protocol/types";
import { getWorldHexGeometry } from "./pixiGeometry";
import {
  createPixiSpatialIndex,
  type PixiSpatialIndex,
} from "./pixiSpatialIndex";
import type { PixiSceneCellRecord } from "./pixiTypes";

const allRoadEdges: RoadEdgeIndex[] = [0, 1, 2, 3, 4, 5];

export type PixiLevelScene = {
  cellsByHex: Map<HexId, PixiSceneCellRecord>;
  hiddenHexes: Set<HexId>;
  level: MapLevel;
  spatialIndex: PixiSpatialIndex;
  stale: boolean;
  versions: MapStateVersions;
};

export type PixiSceneDirtySet = {
  factionHexes: Set<HexId>;
  featureHexes: Set<HexId>;
  levels: Set<MapLevel>;
  riverHexes: Set<HexId>;
  roadHexes: Set<HexId>;
  snapshot: boolean;
  terrainHexes: Set<HexId>;
};

export type PixiMapSceneCache = {
  applyOperations: (
    world: MapState,
    operations: readonly MapOperation[],
  ) => PixiSceneDirtySet;
  getLevelScene: (level: MapLevel, world: MapState) => PixiLevelScene;
  markSnapshot: (world: MapState) => void;
  readonly levels: Map<MapLevel, PixiLevelScene>;
  readonly versions: MapStateVersions;
  readonly world: MapState;
};

function cloneVersions(versions: MapStateVersions): MapStateVersions {
  return { ...versions };
}

function versionsEqual(
  left: MapStateVersions,
  right: MapStateVersions,
): boolean {
  return (
    left.terrain === right.terrain &&
    left.features === right.features &&
    left.factions === right.factions &&
    left.roads === right.roads &&
    left.rivers === right.rivers
  );
}

function createEmptyDirtySet(snapshot = false): PixiSceneDirtySet {
  return {
    factionHexes: new Set(),
    featureHexes: new Set(),
    levels: new Set(),
    riverHexes: new Set(),
    roadHexes: new Set(),
    snapshot,
    terrainHexes: new Set(),
  };
}

function addSourceHex(
  dirtySet: PixiSceneDirtySet,
  key: HexId,
  kind: keyof Pick<
    PixiSceneDirtySet,
    | "factionHexes"
    | "featureHexes"
    | "riverHexes"
    | "roadHexes"
    | "terrainHexes"
  >,
): void {
  dirtySet[kind].add(key);
}

function addRoadDirtyHexes(
  dirtySet: PixiSceneDirtySet,
  axial: { q: number; r: number },
  edges: readonly RoadEdgeIndex[],
): void {
  addSourceHex(dirtySet, hexKey(axial), "roadHexes");

  for (const edge of edges) {
    addSourceHex(
      dirtySet,
      hexKey(getNeighborForRoadEdge(axial, edge)),
      "roadHexes",
    );
  }
}

function addOperationDirtyHexes(
  dirtySet: PixiSceneDirtySet,
  operation: MapOperation,
): void {
  switch (operation.type) {
    case "set_tiles":
      for (const tile of operation.tiles) {
        addSourceHex(dirtySet, hexKey(tile), "terrainHexes");
      }
      return;
    case "set_faction_territories":
      for (const territory of operation.territories) {
        addSourceHex(dirtySet, hexKey(territory), "factionHexes");
      }
      return;
    case "add_feature":
      addSourceHex(dirtySet, hexKey(operation.feature), "featureHexes");
      return;
    case "add_river_data":
    case "remove_river_data":
      addSourceHex(dirtySet, hexKey(operation.river), "riverHexes");
      addSourceHex(
        dirtySet,
        hexKey(getNeighborForRiverEdge(operation.river, operation.river.edge)),
        "riverHexes",
      );
      return;
    case "set_road_edges":
      addRoadDirtyHexes(
        dirtySet,
        operation.cell,
        operation.edges.length > 0 ? operation.edges : allRoadEdges,
      );
      return;
    case "add_faction":
    case "remove_faction":
    case "update_faction":
      return;
    case "remove_feature":
    case "update_feature":
      return;
  }
}

function buildPixiSceneCellRecord(
  world: MapState,
  level: MapLevel,
  hexId: HexId,
): PixiSceneCellRecord | null {
  const levelView = buildMapLevelView(world, level);
  const cell = levelView.levelMap.get(hexId);

  if (!cell) {
    return null;
  }

  const axial = parseHexKey(hexId);
  const geometry = getWorldHexGeometry(axial, level);

  return {
    axial,
    boundsHeight: geometry.boundsHeight,
    boundsWidth: geometry.boundsWidth,
    cell,
    center: geometry.worldCenter,
    corners: geometry.worldCorners,
    factionColor: levelView.factionOverlayColorMap.get(hexId) ?? null,
    feature: levelView.featuresByHex.get(hexId) ?? null,
    featureImage: null,
    featureTerrainOverrideImage: null,
    hexId,
    key: hexId,
    riverEdges: levelView.riverLevelMap.get(hexId) ?? new Set(),
    roadEdges: levelView.roadLevelMap.get(hexId) ?? new Set(),
    terrainImage: null,
    worldCenter: geometry.worldCenter,
    worldCorners: geometry.worldCorners,
  };
}

function rebuildSpatialIndex(scene: PixiLevelScene): void {
  scene.spatialIndex = createPixiSpatialIndex(
    Array.from(scene.cellsByHex.values(), (record) => ({
      bounds: getWorldHexGeometry(record.axial, scene.level).bounds,
      hexId: record.hexId,
    })),
  );
}

function patchSourceScene(
  scene: PixiLevelScene,
  world: MapState,
  dirtySet: PixiSceneDirtySet,
): void {
  const dirtyHexes = new Set<HexId>([
    ...dirtySet.factionHexes,
    ...dirtySet.featureHexes,
    ...dirtySet.riverHexes,
    ...dirtySet.roadHexes,
    ...dirtySet.terrainHexes,
  ]);

  for (const hexId of dirtyHexes) {
    const record = buildPixiSceneCellRecord(world, SOURCE_LEVEL, hexId);

    if (!record) {
      scene.cellsByHex.delete(hexId);
      scene.hiddenHexes.delete(hexId);
      continue;
    }

    scene.cellsByHex.set(hexId, record);

    if (record.cell.hidden) {
      scene.hiddenHexes.add(hexId);
    } else {
      scene.hiddenHexes.delete(hexId);
    }
  }

  if (dirtyHexes.size > 0) {
    rebuildSpatialIndex(scene);
  }

  scene.versions = cloneVersions(world.versions);
  scene.stale = false;
}

function hasUnpatchableSourceOperation(operation: MapOperation): boolean {
  switch (operation.type) {
    case "set_tiles":
    case "set_faction_territories":
      return false;
    case "remove_feature":
    case "update_feature":
    case "add_faction":
    case "remove_faction":
    case "update_faction":
      return true;
    default:
      return false;
  }
}

function buildPixiLevelScene(world: MapState, level: MapLevel): PixiLevelScene {
  const levelView = buildMapLevelView(world, level);
  const cellsByHex = new Map<HexId, PixiSceneCellRecord>();
  const hiddenHexes = new Set<HexId>();

  for (const [rawKey, cell] of levelView.levelMap.entries()) {
    const hexId = rawKey as HexId;
    const record = buildPixiSceneCellRecord(world, level, hexId);

    if (!record) {
      continue;
    }

    if (record.cell.hidden) {
      hiddenHexes.add(hexId);
    }

    cellsByHex.set(hexId, record);
  }

  const spatialIndex = createPixiSpatialIndex(
    Array.from(cellsByHex.values(), (record) => ({
      bounds: getWorldHexGeometry(record.axial, level).bounds,
      hexId: record.hexId,
    })),
  );

  return {
    cellsByHex,
    hiddenHexes,
    level,
    spatialIndex,
    stale: false,
    versions: cloneVersions(world.versions),
  };
}

export function createPixiMapSceneCache(
  initialWorld: MapState,
): PixiMapSceneCache {
  let world = initialWorld;
  let versions = cloneVersions(initialWorld.versions);
  const levels = new Map<MapLevel, PixiLevelScene>();

  return {
    applyOperations: (nextWorld, operations) => {
      world = nextWorld;
      versions = cloneVersions(nextWorld.versions);
      const dirtySet = createEmptyDirtySet(false);

      for (const operation of operations) {
        addOperationDirtyHexes(dirtySet, operation);
      }

      const sourceLevel = SOURCE_LEVEL as MapLevel;
      const sourceScene = levels.get(sourceLevel);
      const canPatchSourceScene =
        Boolean(sourceScene) && !operations.some(hasUnpatchableSourceOperation);

      for (const level of MAP_LEVELS) {
        dirtySet.levels.add(level);

        const scene = levels.get(level);

        if (!scene) {
          continue;
        }

        if (level === SOURCE_LEVEL && canPatchSourceScene) {
          patchSourceScene(scene, nextWorld, dirtySet);
        } else {
          scene.stale = true;
        }
      }
      return dirtySet;
    },
    getLevelScene: (level, nextWorld) => {
      world = nextWorld;
      versions = cloneVersions(nextWorld.versions);
      const existing = levels.get(level);

      if (
        existing &&
        !existing.stale &&
        versionsEqual(existing.versions, nextWorld.versions)
      ) {
        return existing;
      }

      const scene = buildPixiLevelScene(nextWorld, level);
      levels.set(level, scene);
      return scene;
    },
    markSnapshot: (nextWorld) => {
      world = nextWorld;
      versions = cloneVersions(nextWorld.versions);
      levels.clear();
    },
    get levels() {
      return levels;
    },
    get versions() {
      return versions;
    },
    get world() {
      return world;
    },
  };
}
