import { hexKey, type Axial } from "@/domain/geometry/hex";
import {
  addFeature,
  createFeature,
  getFeatureAt,
  removeFeatureAt,
  type FeatureKind
} from "@/domain/world/features";
import type { World } from "@/domain/world/world";

export type FeatureActionResult = {
  selectedFeatureId: string | null;
  world: World;
};

export function placeOrSelectFeature(
  world: World,
  level: number,
  axial: Axial,
  kind: FeatureKind,
  createId: () => string
): FeatureActionResult {
  const existingFeature = getFeatureAt(world, level, axial);

  if (existingFeature) {
    return {
      selectedFeatureId: existingFeature.id,
      world
    };
  }

  if (level !== 3) {
    return {
      selectedFeatureId: null,
      world
    };
  }

  const feature = createFeature(createId(), kind, hexKey(axial));

  return {
    selectedFeatureId: feature.id,
    world: addFeature(world, level, feature)
  };
}

export function removeFeatureOnHex(
  world: World,
  level: number,
  axial: Axial,
  selectedFeatureId: string | null
): FeatureActionResult {
  const existingFeature = getFeatureAt(world, level, axial);

  if (!existingFeature) {
    return {
      selectedFeatureId: null,
      world
    };
  }

  if (level !== 3) {
    return {
      selectedFeatureId: existingFeature.id,
      world
    };
  }

  return {
    selectedFeatureId: existingFeature.id === selectedFeatureId ? null : selectedFeatureId,
    world: removeFeatureAt(world, level, axial)
  };
}
