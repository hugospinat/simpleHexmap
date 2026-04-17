import {
  canFeatureOverrideTerrain,
  getFeatureAsset,
  getFeatureTerrainOverrideAsset
} from "@/assets/featureAssets";
import type { Pixel } from "@/domain/geometry/hex";
import {
  featureKindLabels,
  type Feature,
  type FeatureKind
} from "@/domain/world/features";
import { getLoadedImage } from "./assetImages";
import { drawImageContainedInBounds, getPolygonBounds } from "./imageFit";

export const featureGlyphs: Record<FeatureKind, string> = {
  city: "o",
  capital: "*",
  village: "^",
  fort: "[]",
  ruin: "x",
  tower: "|",
  dungeon: "[]",
  marker: "+",
  label: "Aa"
};

export const featureImagePadding = 0.08;

const featureIconSize = 18;

export function getHexPoints(center: Pixel, radius: number): Pixel[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + (Math.PI / 3) * index;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    };
  });
}

export function tracePolygon(context: CanvasRenderingContext2D, points: Pixel[]) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.closePath();
}

export function drawPathWithHalo(context: CanvasRenderingContext2D, drawPath: () => void, baseLineWidth: number, haloWidth: number) {
  context.save();
  context.strokeStyle = "#ffffff";
  context.lineWidth = haloWidth;
  drawPath();
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = "#111111";
  context.lineWidth = baseLineWidth;
  drawPath();
  context.stroke();
  context.restore();
}

export function drawLabel(context: CanvasRenderingContext2D, text: string, center: Pixel, scale: number) {
  context.save();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2.4;
  context.strokeText(text, center.x, center.y + 0.5);
  context.restore();
  context.fillText(text, center.x, center.y + 0.5);
}

export function drawFeatureAsset(
  context: CanvasRenderingContext2D,
  type: FeatureKind,
  center: Pixel
): boolean {
  const asset = getFeatureAsset(type);

  if (!asset) {
    return false;
  }

  const image = getLoadedImage(asset.src);

  if (!image) {
    return false;
  }

  const hexRadius = featureIconSize / Math.sqrt(3);
  const points = getHexPoints(center, hexRadius);
  const bounds = getPolygonBounds(points);

  context.save();
  tracePolygon(context, points);
  context.clip();
  drawImageContainedInBounds(context, image, bounds, featureImagePadding);
  context.restore();
  return true;
}

export function drawFeatureTerrainOverrideTile(
  context: CanvasRenderingContext2D,
  featureKind: FeatureKind,
  points: Pixel[]
): boolean {
  const asset = getFeatureTerrainOverrideAsset(featureKind);

  if (!asset) {
    return false;
  }

  const image = getLoadedImage(asset.src);

  if (!image) {
    return false;
  }

  const bounds = getPolygonBounds(points);
  context.save();
  tracePolygon(context, points);
  context.clip();
  drawImageContainedInBounds(context, image, bounds, 0);
  context.restore();
  return true;
}

export function getFeatureTitle(type: FeatureKind): string {
  return featureKindLabels[type];
}

export function featureCanOverrideTerrainTile(feature: Feature): boolean {
  // Hidden features must never override terrain visuals to avoid leaking
  // unrevealed information through the rendered tile appearance.
  return !feature.hidden && feature.overrideTerrainTile && canFeatureOverrideTerrain(feature.kind);
}
