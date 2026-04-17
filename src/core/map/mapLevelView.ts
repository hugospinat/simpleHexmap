import { getFeaturesForLevel, type FeatureLevelMap } from "@/core/map/features";
import { hexKey, type Axial } from "@/core/geometry/hex";
import {
  getFactionOverlayColorMap,
  getLevelMap,
  getRoadLevelMap,
  getRiverLevelMap,
  type LevelMap,
  type RiverLevelMap,
  type RoadLevelMap,
  type MapState
} from "@/core/map/world";

export type MapLevelView = {
  factionOverlayColorMap: Map<string, string>;
  featuresByHex: FeatureLevelMap;
  level: number;
  levelMap: LevelMap;
  riverLevelMap: RiverLevelMap;
  roadLevelMap: RoadLevelMap;
  world: MapState;
};

const mapLevelViewCache = new WeakMap<MapState, Map<number, MapLevelView>>();

export function buildMapLevelView(world: MapState, level: number): MapLevelView {
  let viewsByLevel = mapLevelViewCache.get(world);

  if (!viewsByLevel) {
    viewsByLevel = new Map();
    mapLevelViewCache.set(world, viewsByLevel);
  }

  const cached = viewsByLevel.get(level);

  if (cached) {
    return cached;
  }

  const view: MapLevelView = {
    factionOverlayColorMap: getFactionOverlayColorMap(world, level),
    featuresByHex: getFeaturesForLevel(world, level),
    level,
    levelMap: getLevelMap(world, level),
    riverLevelMap: getRiverLevelMap(world, level),
    roadLevelMap: getRoadLevelMap(world, level),
    world
  };

  viewsByLevel.set(level, view);
  return view;
}

export function getMapLevelViewCell(view: MapLevelView, axial: Axial) {
  return view.levelMap.get(hexKey(axial)) ?? null;
}

export function getMapLevelViewFeatureAt(view: MapLevelView, axial: Axial) {
  return view.featuresByHex.get(hexKey(axial)) ?? null;
}

export function getMapLevelViewFactionOverlayColorAt(view: MapLevelView, axial: Axial): string | null {
  return view.factionOverlayColorMap.get(hexKey(axial)) ?? null;
}

export function getMapLevelViewRoadEdgesAt(view: MapLevelView, axial: Axial) {
  return view.roadLevelMap.get(hexKey(axial)) ?? new Set();
}

export function getMapLevelViewVisibleFeatureAt(view: MapLevelView, axial: Axial, visibleKeys: ReadonlySet<string>) {
  const key = hexKey(axial);
  return visibleKeys.has(key) ? view.featuresByHex.get(key) ?? null : null;
}
