import {
  canFeatureOverrideTerrain,
  getFeatureAsset,
  getFeatureTerrainOverrideAsset
} from "@/assets/featureAssets";
import type { FeatureKind } from "@/core/map/features";
import { getLoadedImage } from "./assetImages";
import { drawImageContainedInBounds, getPolygonBounds } from "./imageFit";
import {
  featureGlyphs,
  featureImagePadding,
  getHexPoints,
  tracePolygon
} from "./featureVisualPrimitives";

export function drawFeaturePreview(
  context: CanvasRenderingContext2D,
  type: FeatureKind,
  width: number,
  height: number,
  selected = false
) {
  const center = { x: width / 2, y: height / 2 };
  const radius = Math.max(1, Math.min(width / 1.9, height / 2.12));
  const points = getHexPoints(center, radius);
  const bounds = getPolygonBounds(points);

  context.clearRect(0, 0, width, height);
  context.save();
  tracePolygon(context, points);
  context.fillStyle = "#ffffff";
  context.fill();
  context.restore();

  const overrideAsset = canFeatureOverrideTerrain(type)
    ? getFeatureTerrainOverrideAsset(type)
    : undefined;
  const asset = overrideAsset ?? getFeatureAsset(type);
  const image = asset ? getLoadedImage(asset.src) : null;

  if (image) {
    context.save();
    tracePolygon(context, points);
    context.clip();
    drawImageContainedInBounds(context, image, bounds, overrideAsset ? 0 : featureImagePadding);
    context.restore();
  } else {
    context.save();
    context.fillStyle = "#111111";
    context.font = "20px Georgia, 'Times New Roman', serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(featureGlyphs[type], center.x, center.y + 0.5);
    context.restore();
  }

  tracePolygon(context, points);
  context.strokeStyle = "#111111";
  context.lineWidth = selected ? 2 : 1.2;
  context.stroke();
}
