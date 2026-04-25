import {
  getAncestorAtLevel,
  hexKey,
  parseHexKey,
  type Axial,
  type HexId,
} from "../geometry/hex.js";
import type { MapState } from "./worldTypes.js";
import { bumpMapStateVersion } from "./worldTypes.js";
import { SOURCE_LEVEL } from "./mapRules.js";

export type FeatureLevel = 1 | 2 | 3;

export type FeatureKind =
  | "camp"
  | "ruin"
  | "village"
  | "fort"
  | "donjon"
  | "city"
  | "citadel"
  | "megadungeon"
  | "capital";

export type FeatureDefinition = {
  kind: FeatureKind;
  label: string;
  featureLevel: FeatureLevel;
  canOverrideTerrain: boolean;
};

export const featureDefinitions = [
  {
    kind: "camp",
    label: "Camp",
    featureLevel: 1,
    canOverrideTerrain: true,
  },
  {
    kind: "ruin",
    label: "Ruin",
    featureLevel: 1,
    canOverrideTerrain: true,
  },
  {
    kind: "village",
    label: "Village",
    featureLevel: 1,
    canOverrideTerrain: true,
  },
  {
    kind: "fort",
    label: "Fort",
    featureLevel: 2,
    canOverrideTerrain: true,
  },
  {
    kind: "donjon",
    label: "Donjon",
    featureLevel: 2,
    canOverrideTerrain: true,
  },
  {
    kind: "city",
    label: "City",
    featureLevel: 2,
    canOverrideTerrain: true,
  },
  {
    kind: "citadel",
    label: "Citadel",
    featureLevel: 3,
    canOverrideTerrain: true,
  },
  {
    kind: "megadungeon",
    label: "Megadungeon",
    featureLevel: 3,
    canOverrideTerrain: true,
  },
  {
    kind: "capital",
    label: "Capital",
    featureLevel: 3,
    canOverrideTerrain: true,
  },
] as const satisfies readonly FeatureDefinition[];

const featureDefinitionByKind = new Map<FeatureKind, FeatureDefinition>(
  featureDefinitions.map((definition) => [definition.kind, definition]),
);

export type Feature = {
  id: string;
  kind: FeatureKind;
  featureLevel: FeatureLevel;
  hexId: string;
  hidden: boolean;
};

export type FeatureInput = {
  id: string;
  kind: FeatureKind;
  featureLevel?: FeatureLevel;
  hexId: HexId | string;
  hidden?: boolean;
};

export type FeatureLevelMap = Map<string, Feature>;

export type FeatureVisibilityMode = "gm" | "player";

export const featureKinds: FeatureKind[] = featureDefinitions.map(
  (definition) => definition.kind,
);

export const featureKindLabels: Record<FeatureKind, string> =
  Object.fromEntries(
    featureDefinitions.map((definition) => [definition.kind, definition.label]),
  ) as Record<FeatureKind, string>;

export function isFeatureKind(value: unknown): value is FeatureKind {
  return (
    typeof value === "string" &&
    featureDefinitionByKind.has(value as FeatureKind)
  );
}

export function isFeatureLevel(value: unknown): value is FeatureLevel {
  return value === 1 || value === 2 || value === 3;
}

export function getFeatureDefinition(kind: FeatureKind): FeatureDefinition {
  const definition = featureDefinitionByKind.get(kind);

  if (!definition) {
    throw new Error(`Unknown feature kind: ${String(kind)}.`);
  }

  return definition;
}

export function getFeatureLevelForKind(kind: FeatureKind): FeatureLevel {
  return getFeatureDefinition(kind).featureLevel;
}

export function canFeatureKindOverrideTerrain(kind: FeatureKind): boolean {
  return getFeatureDefinition(kind).canOverrideTerrain;
}

export function axialToFeatureHexId(coord: Axial): HexId {
  return hexKey(coord);
}

export function featureHexIdToAxial(hexId: HexId | string): Axial {
  return parseHexKey(hexId);
}

export function normalizeFeature(feature: FeatureInput): Feature {
  return {
    id: feature.id,
    kind: feature.kind,
    featureLevel: feature.featureLevel ?? getFeatureLevelForKind(feature.kind),
    hexId: feature.hexId,
    hidden: feature.hidden ?? false,
  };
}

function shouldRenderFeatureAtLevel(feature: Feature, level: number): boolean {
  if (level >= SOURCE_LEVEL) {
    return true;
  }

  if (level === 2) {
    return feature.featureLevel >= 2;
  }

  if (level === 1) {
    return feature.featureLevel === 3;
  }

  return true;
}

function getStoredFeaturesForLevel(
  world: MapState,
  level: number,
): FeatureLevelMap {
  return world.featuresByLevel[level] ?? new Map();
}

function deriveFeaturesForLevelFromSource(
  world: MapState,
  level: number,
): FeatureLevelMap {
  const sourceFeatures = getStoredFeaturesForLevel(world, SOURCE_LEVEL);
  const derived = new Map<string, Feature>();

  for (const feature of Array.from(sourceFeatures.values()).sort((a, b) =>
    a.hexId.localeCompare(b.hexId),
  )) {
    if (!shouldRenderFeatureAtLevel(feature, level)) {
      continue;
    }

    const parent = getAncestorAtLevel(
      featureHexIdToAxial(feature.hexId),
      SOURCE_LEVEL,
      level,
    );
    const parentHexId = hexKey(parent);

    if (derived.has(parentHexId)) {
      continue;
    }

    derived.set(parentHexId, {
      ...feature,
      hexId: parentHexId,
    });
  }

  return derived;
}

export function createFeature(
  id: string,
  kind: FeatureKind,
  hexId: HexId | string,
): Feature {
  return normalizeFeature({
    id,
    kind,
    hexId,
    hidden: false,
  });
}

export function getFeaturesForLevel(
  world: MapState,
  level: number,
): FeatureLevelMap {
  if (level === SOURCE_LEVEL) {
    return getStoredFeaturesForLevel(world, level);
  }

  return deriveFeaturesForLevelFromSource(world, level);
}

export function getFeatureAt(
  world: MapState,
  level: number,
  coord: Axial,
): Feature | null {
  return (
    getFeaturesForLevel(world, level).get(axialToFeatureHexId(coord)) ?? null
  );
}

export function getFeatureById(
  world: MapState,
  level: number,
  featureId: string,
): Feature | null {
  for (const feature of getFeaturesForLevel(world, level).values()) {
    if (feature.id === featureId) {
      return feature;
    }
  }

  return null;
}

export function addFeature(
  world: MapState,
  level: number,
  feature: FeatureInput,
): MapState {
  if (level !== SOURCE_LEVEL) {
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
      [level]: nextLevelFeatures,
    },
    versions: bumpMapStateVersion(world, "features"),
  };
}

export function updateFeature(
  world: MapState,
  level: number,
  featureId: string,
  updates: Partial<Pick<Feature, "hidden">>,
): MapState {
  const targetLevel = level === SOURCE_LEVEL ? level : SOURCE_LEVEL;
  const allowedUpdates: typeof updates = level === SOURCE_LEVEL ? updates : {};

  if (level !== SOURCE_LEVEL) {
    if ("hidden" in updates) {
      allowedUpdates.hidden = updates.hidden;
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
      ...allowedUpdates,
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
      [targetLevel]: nextLevelFeatures,
    },
    versions: bumpMapStateVersion(world, "features"),
  };
}

export function removeFeatureAt(
  world: MapState,
  level: number,
  coord: Axial,
): MapState {
  if (level !== SOURCE_LEVEL) {
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
      [level]: nextLevelFeatures,
    },
    versions: bumpMapStateVersion(world, "features"),
  };
}

export function isFeatureVisible(
  feature: Feature,
  mode: FeatureVisibilityMode,
): boolean {
  return mode === "gm" || !feature.hidden;
}
