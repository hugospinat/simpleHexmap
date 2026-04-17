import { getAncestorAtLevel, hexKey, parseHexKey, type Axial } from "@/domain/geometry/hex";
import { canFeatureOverrideTerrain } from "@/assets/featureAssets";
import type { World } from "./worldTypes";

const sourceLevel = 3;

export type FeatureKind =
  | "city"
  | "capital"
  | "village"
  | "fort"
  | "ruin"
  | "tower"
  | "dungeon"
  | "marker"
  | "label";

export type Feature = {
  id: string;
  kind: FeatureKind;
  hexId: string;
  overrideTerrainTile: boolean;
  hidden: boolean;
  gmLabel?: string;
  playerLabel?: string;
  labelRevealed?: boolean;
  // TODO: add player discovery state (e.g. discovered: boolean).
};

type LegacyFeatureRecord = {
  id: string;
  coord?: Axial;
  gmLabel?: string;
  hidden?: boolean;
  hexId?: string;
  kind?: FeatureKind;
  label?: string;
  labelRevealed?: boolean;
  overrideTerrainTile?: boolean;
  playerLabel?: string;
  type?: FeatureKind;
};

type LegacyFeatureWorld = {
  [key: string]: unknown;
};

export type FeatureLevelMap = Map<string, Feature>;

export type FeatureVisibilityMode = "gm" | "player";

const legacyFeaturesByLevelKey = ["annot", "ationsByLevel"].join("");

export const featureKinds: FeatureKind[] = [
  "city",
  "capital",
  "village",
  "fort",
  "ruin",
  "tower",
  "dungeon",
  "marker",
  "label"
];

export const featureKindLabels: Record<FeatureKind, string> = {
  city: "City",
  capital: "Capital",
  village: "Village",
  fort: "Fort",
  ruin: "Ruin",
  tower: "Tower",
  dungeon: "Dungeon",
  marker: "Marker",
  label: "Label"
};

function getDefaultOverrideTerrainTile(kind: FeatureKind): boolean {
  return canFeatureOverrideTerrain(kind);
}

function optionalTrim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function axialToFeatureHexId(coord: Axial): string {
  return hexKey(coord);
}

export function featureHexIdToAxial(hexId: string): Axial {
  return parseHexKey(hexId);
}

export function normalizeFeature(feature: Feature | LegacyFeatureRecord, fallbackHexId?: string): Feature {
  const legacyCoord = "coord" in feature ? feature.coord : undefined;
  const legacyType = "type" in feature ? feature.type : undefined;
  const legacyLabel = "label" in feature ? feature.label : undefined;
  const hexId = feature.hexId ?? (legacyCoord ? axialToFeatureHexId(legacyCoord) : fallbackHexId);
  const kind = feature.kind ?? legacyType;

  if (!hexId || !kind) {
    throw new Error("Feature data is missing a hexId or kind.");
  }

  return {
    id: feature.id,
    kind,
    hexId,
    overrideTerrainTile: feature.overrideTerrainTile ?? getDefaultOverrideTerrainTile(kind),
    hidden: feature.hidden ?? false,
    gmLabel: optionalTrim(feature.gmLabel ?? legacyLabel),
    playerLabel: optionalTrim(feature.playerLabel),
    labelRevealed: feature.labelRevealed
  };
}

type FeatureLevelMapInput =
  | FeatureLevelMap
  | Map<string, Feature | LegacyFeatureRecord | Array<Feature | LegacyFeatureRecord>>;

function normalizeFeatureLevelMap(levelMap: FeatureLevelMapInput): FeatureLevelMap {
  const next = new Map<string, Feature>();

  for (const [hexId, featureOrFeatures] of levelMap.entries()) {
    const firstFeature = Array.isArray(featureOrFeatures)
      ? featureOrFeatures[0]
      : featureOrFeatures;

    if (!firstFeature) {
      continue;
    }

    next.set(hexId, normalizeFeature(firstFeature, hexId));
  }

  return next;
}

function getStoredFeaturesForLevel(world: World, level: number): FeatureLevelMap {
  const current = world.featuresByLevel[level];

  if (current) {
    return normalizeFeatureLevelMap(current);
  }

  const legacyWorld = world as World & LegacyFeatureWorld;
  const legacyByLevel = legacyWorld[legacyFeaturesByLevelKey] as Record<number, unknown> | undefined;
  const legacy = legacyByLevel?.[level] as
    | FeatureLevelMap
    | Map<string, LegacyFeatureRecord | LegacyFeatureRecord[]>
    | undefined;

  return legacy ? normalizeFeatureLevelMap(legacy) : new Map();
}

function deriveFeaturesForLevelFromSource(world: World, level: number): FeatureLevelMap {
  const sourceFeatures = getStoredFeaturesForLevel(world, sourceLevel);
  const derived = new Map<string, Feature>();

  for (const feature of Array.from(sourceFeatures.values()).sort((a, b) => a.hexId.localeCompare(b.hexId))) {
    const parent = getAncestorAtLevel(featureHexIdToAxial(feature.hexId), sourceLevel, level);
    const parentHexId = hexKey(parent);

    if (derived.has(parentHexId)) {
      continue;
    }

    derived.set(parentHexId, {
      ...feature,
      hexId: parentHexId
    });
  }

  return derived;
}

export function createFeature(id: string, kind: FeatureKind, hexId: string): Feature {
  return normalizeFeature({
    id,
    kind,
    hexId,
    overrideTerrainTile: getDefaultOverrideTerrainTile(kind),
    hidden: false,
    labelRevealed: false
  });
}

export function getFeaturesForLevel(world: World, level: number): FeatureLevelMap {
  if (level === sourceLevel) {
    return getStoredFeaturesForLevel(world, level);
  }

  return deriveFeaturesForLevelFromSource(world, level);
}

export function getFeatureAt(world: World, level: number, coord: Axial): Feature | null {
  return getFeaturesForLevel(world, level).get(axialToFeatureHexId(coord)) ?? null;
}

export function getFeatureById(world: World, level: number, featureId: string): Feature | null {
  for (const feature of getFeaturesForLevel(world, level).values()) {
    if (feature.id === featureId) {
      return feature;
    }
  }

  return null;
}

export function addFeature(world: World, level: number, feature: Feature | LegacyFeatureRecord): World {
  if (level !== sourceLevel) {
    return world;
  }

  const normalized = normalizeFeature(feature);
  const levelFeatures = getFeaturesForLevel(world, level);

  if (levelFeatures.has(normalized.hexId)) {
    return world;
  }

  const nextLevelFeatures = new Map(levelFeatures);
  nextLevelFeatures.set(normalized.hexId, normalized);

  return {
    ...world,
    featuresByLevel: {
      ...world.featuresByLevel,
      [level]: nextLevelFeatures
    }
  };
}

export function updateFeature(
  world: World,
  level: number,
  featureId: string,
  updates: Partial<
    Pick<Feature, "gmLabel" | "hidden" | "kind" | "labelRevealed" | "overrideTerrainTile" | "playerLabel">
  >
): World {
  const targetLevel = level === sourceLevel ? level : sourceLevel;
  const allowedUpdates: typeof updates = level === sourceLevel ? updates : {};

  if (level !== sourceLevel) {
    if ("gmLabel" in updates) {
      allowedUpdates.gmLabel = updates.gmLabel;
    }
    if ("hidden" in updates) {
      allowedUpdates.hidden = updates.hidden;
    }
    if ("labelRevealed" in updates) {
      allowedUpdates.labelRevealed = updates.labelRevealed;
    }
    if ("overrideTerrainTile" in updates) {
      allowedUpdates.overrideTerrainTile = updates.overrideTerrainTile;
    }
    if ("playerLabel" in updates) {
      allowedUpdates.playerLabel = updates.playerLabel;
    }
  }

  const levelFeatures = getStoredFeaturesForLevel(world, targetLevel);
  let changed = false;
  const nextLevelFeatures = new Map(levelFeatures);

  for (const [hexId, feature] of levelFeatures.entries()) {
    if (feature.id !== featureId) {
      continue;
    }

    const nextFeature = normalizeFeature({
      ...feature,
      ...allowedUpdates
    });
    nextLevelFeatures.set(hexId, nextFeature);
    changed = true;
    break;
  }

  if (!changed) {
    return world;
  }

  return {
    ...world,
    featuresByLevel: {
      ...world.featuresByLevel,
      [targetLevel]: nextLevelFeatures
    }
  };
}

export function removeFeatureAt(world: World, level: number, coord: Axial): World {
  if (level !== sourceLevel) {
    return world;
  }

  const levelFeatures = getFeaturesForLevel(world, level);
  const key = axialToFeatureHexId(coord);

  if (!levelFeatures.has(key)) {
    return world;
  }

  const nextLevelFeatures = new Map(levelFeatures);
  nextLevelFeatures.delete(key);

  return {
    ...world,
    featuresByLevel: {
      ...world.featuresByLevel,
      [level]: nextLevelFeatures
    }
  };
}

export function getFeatureLabel(feature: Feature, mode: FeatureVisibilityMode): string | undefined {
  if (mode === "player") {
    return feature.labelRevealed ? feature.playerLabel : undefined;
  }

  return feature.gmLabel;
}

export function isFeatureVisible(feature: Feature, mode: FeatureVisibilityMode): boolean {
  return mode === "gm" || !feature.hidden;
}
