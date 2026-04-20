import {
  getAncestorAtLevel,
  hexKey,
  parseHexKey,
  type Axial,
  type HexId,
} from "@/core/geometry/hex";
import type { MapState } from "./worldTypes";
import { bumpMapStateVersion } from "./worldTypes";
import { SOURCE_LEVEL } from "./mapRules";

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
  hidden: boolean;
  gmLabel?: string;
  playerLabel?: string;
  labelRevealed?: boolean;
  // TODO: add player discovery state (e.g. discovered: boolean).
};

export type FeatureInput = {
  id: string;
  kind: FeatureKind;
  hexId: HexId | string;
  gmLabel?: string;
  hidden?: boolean;
  labelRevealed?: boolean;
  playerLabel?: string;
};

export type FeatureLevelMap = Map<string, Feature>;

export type FeatureVisibilityMode = "gm" | "player";

export const featureKinds: FeatureKind[] = [
  "city",
  "capital",
  "village",
  "fort",
  "ruin",
  "tower",
  "dungeon",
  "marker",
  "label",
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
  label: "Label",
};

export function canFeatureKindOverrideTerrain(kind: FeatureKind): boolean {
  return kind !== "label" && kind !== "marker";
}

function optionalTrim(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
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
    hexId: feature.hexId,
    hidden: feature.hidden ?? false,
    gmLabel: optionalTrim(feature.gmLabel),
    playerLabel: optionalTrim(feature.playerLabel),
    labelRevealed: feature.labelRevealed,
  };
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
    labelRevealed: false,
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
  updates: Partial<
    Pick<
      Feature,
      "gmLabel" | "hidden" | "kind" | "labelRevealed" | "playerLabel"
    >
  >,
): MapState {
  const targetLevel = level === SOURCE_LEVEL ? level : SOURCE_LEVEL;
  const allowedUpdates: typeof updates = level === SOURCE_LEVEL ? updates : {};

  if (level !== SOURCE_LEVEL) {
    if ("gmLabel" in updates) {
      allowedUpdates.gmLabel = updates.gmLabel;
    }
    if ("hidden" in updates) {
      allowedUpdates.hidden = updates.hidden;
    }
    if ("labelRevealed" in updates) {
      allowedUpdates.labelRevealed = updates.labelRevealed;
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

export function getFeatureLabel(
  feature: Feature,
  mode: FeatureVisibilityMode,
): string | undefined {
  if (mode === "player") {
    return feature.playerLabel;
  }

  return feature.gmLabel;
}

export function isFeatureVisible(
  feature: Feature,
  mode: FeatureVisibilityMode,
): boolean {
  return mode === "gm" || !feature.hidden;
}
