import { getFeaturesForLevel, type FeatureLevelMap } from "@/domain/world/features";
import { hexKey, type Axial } from "@/domain/geometry/hex";
import {
  getFactionOverlayColorMap,
  getLevelMap,
  getRoadLevelMap,
  getRiverLevelMap,
  type LevelMap,
  type RiverLevelMap,
  type RoadLevelMap,
  type World
} from "@/domain/world/world";

export type WorldView = {
  factionOverlayColorMap: Map<string, string>;
  featuresByHex: FeatureLevelMap;
  level: number;
  levelMap: LevelMap;
  riverLevelMap: RiverLevelMap;
  roadLevelMap: RoadLevelMap;
  world: World;
};

const worldViewCache = new WeakMap<World, Map<number, WorldView>>();

export function buildWorldView(world: World, level: number): WorldView {
  let viewsByLevel = worldViewCache.get(world);

  if (!viewsByLevel) {
    viewsByLevel = new Map();
    worldViewCache.set(world, viewsByLevel);
  }

  const cached = viewsByLevel.get(level);

  if (cached) {
    return cached;
  }

  const view: WorldView = {
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

export function getWorldViewCell(view: WorldView, axial: Axial) {
  return view.levelMap.get(hexKey(axial)) ?? null;
}

export function getWorldViewFeatureAt(view: WorldView, axial: Axial) {
  return view.featuresByHex.get(hexKey(axial)) ?? null;
}

export function getWorldViewFactionOverlayColorAt(view: WorldView, axial: Axial): string | null {
  return view.factionOverlayColorMap.get(hexKey(axial)) ?? null;
}

export function getWorldViewRoadEdgesAt(view: WorldView, axial: Axial) {
  return view.roadLevelMap.get(hexKey(axial)) ?? new Set();
}

export function getWorldViewVisibleFeatureAt(view: WorldView, axial: Axial, visibleKeys: ReadonlySet<string>) {
  const key = hexKey(axial);
  return visibleKeys.has(key) ? view.featuresByHex.get(key) ?? null : null;
}
