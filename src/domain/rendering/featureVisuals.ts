import {
  canFeatureOverrideTerrain,
  getFeatureAsset,
  getFeatureTerrainOverrideAsset
} from "@/assets/featureAssets";
import {
  type Pixel
} from "@/domain/geometry/hex";
import {
  featureKindLabels,
  featureHexIdToAxial,
  getFeatureLabel,
  isFeatureVisible,
  type Feature,
  type FeatureKind,
  type FeatureVisibilityMode
} from "@/domain/world/features";
import { getLoadedImage } from "./assetImages";
import { drawImageContainedInBounds, getPolygonBounds } from "./imageFit";
import type { MapRenderTransform } from "./mapTransform";

export type FeatureRenderStats = {
  features: number;
  hexes: number;
};

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

const featureIconSize = 18;
const featureImagePadding = 0.08;

function getHexPoints(center: Pixel, radius: number): Pixel[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + (Math.PI / 3) * index;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    };
  });
}

function tracePolygon(context: CanvasRenderingContext2D, points: Pixel[]) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.closePath();
}

function drawCircle(context: CanvasRenderingContext2D, center: Pixel, radius: number) {
  context.beginPath();
  context.arc(center.x, center.y, radius, 0, Math.PI * 2);
  context.stroke();
}

function drawPathWithHalo(context: CanvasRenderingContext2D, drawPath: () => void, baseLineWidth: number, haloWidth: number) {
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

function drawLabel(context: CanvasRenderingContext2D, text: string, center: Pixel, scale: number) {
  context.save();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 2.4;
  context.strokeText(text, center.x, center.y + 0.5);
  context.restore();
  context.fillText(text, center.x, center.y + 0.5);
}

function drawFeatureAsset(
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

export function renderFeature(
  context: CanvasRenderingContext2D,
  feature: Feature,
  origin: Pixel,
  scale: number,
  visibilityMode: FeatureVisibilityMode
) {
  const center = { x: 0, y: 0 };
  const label = getFeatureLabel(feature, visibilityMode);

  context.save();
  context.translate(origin.x, origin.y);
  context.scale(scale, scale);
  if (visibilityMode === "gm" && feature.hidden) {
    context.globalAlpha = 0.5;
  }
  context.strokeStyle = "#111111";
  context.fillStyle = "#111111";
  const baseLineWidth = 1.2;
  const haloWidth = 2.2;
  context.lineWidth = baseLineWidth;
  context.font = "12px Georgia, 'Times New Roman', serif";
  context.textAlign = "center";
  context.textBaseline = "middle";

  if (feature.kind === "label") {
    if (label) {
      drawLabel(context, label, center, scale);
    }
    context.restore();
    return;
  }

  if (drawFeatureAsset(context, feature.kind, center)) {
    if (label) {
      drawLabel(context, label, { x: center.x, y: center.y + 16 }, scale);
    }
    context.restore();
    return;
  }

  if (feature.kind === "city") {
    context.save();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(center.x, center.y, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.arc(center.x, center.y, 4, 0, Math.PI * 2);
      },
      baseLineWidth,
      haloWidth
    );
  }

  if (feature.kind === "capital") {
    const drawStar = () => {
      context.beginPath();
      for (let point = 0; point < 8; point += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * point) / 8;
        const radius = point % 2 === 0 ? 6 : 2.5;
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius;

        if (point === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.closePath();
    };

    context.save();
    context.fillStyle = "#ffffff";
    drawStar();
    context.fill();
    context.restore();
    drawPathWithHalo(context, drawStar, baseLineWidth, haloWidth);
  }

  if (feature.kind === "village") {
    context.save();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(center.x - 5, center.y);
    context.lineTo(center.x, center.y - 4);
    context.lineTo(center.x + 5, center.y);
    context.closePath();
    context.fill();
    context.beginPath();
    context.rect(center.x - 4, center.y, 8, 8);
    context.fill();
    context.restore();
    context.save();
    context.beginPath();
    context.arc(center.x, center.y + 3, 1.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 5, center.y);
        context.lineTo(center.x, center.y - 4);
        context.lineTo(center.x + 5, center.y);
      },
      baseLineWidth,
      haloWidth
    );
  }

  if (feature.kind === "fort") {
    context.save();
    context.fillStyle = "#ffffff";
    context.fillRect(center.x - 5, center.y - 5, 10, 10);
    context.fillRect(center.x - 2, center.y + 1, 4, 4);
    context.restore();
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.rect(center.x - 5, center.y - 5, 10, 10);
      },
      baseLineWidth,
      haloWidth
    );
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 2, center.y - 5);
        context.lineTo(center.x - 2, center.y - 8);
        context.moveTo(center.x + 2, center.y - 5);
        context.lineTo(center.x + 2, center.y - 8);
      },
      baseLineWidth,
      haloWidth
    );
  }

  if (feature.kind === "ruin") {
    context.save();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(center.x - 5, center.y - 4);
    context.lineTo(center.x - 5, center.y + 5);
    context.lineTo(center.x + 4, center.y + 5);
    context.lineTo(center.x + 4, center.y + 1);
    context.lineTo(center.x + 2, center.y + 1);
    context.lineTo(center.x + 2, center.y + 3);
    context.lineTo(center.x - 3, center.y + 3);
    context.lineTo(center.x - 3, center.y - 2);
    context.closePath();
    context.fill();
    context.restore();
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 5, center.y - 4);
        context.lineTo(center.x - 5, center.y + 5);
        context.lineTo(center.x + 4, center.y + 5);
        context.lineTo(center.x + 4, center.y + 1);
      },
      baseLineWidth,
      haloWidth
    );
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 7, center.y - 7);
        context.lineTo(center.x + 7, center.y + 7);
      },
      baseLineWidth,
      haloWidth
    );
  }

  if (feature.kind === "tower") {
    context.save();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(center.x - 3, center.y + 6);
    context.lineTo(center.x - 2, center.y - 6);
    context.lineTo(center.x + 2, center.y - 6);
    context.lineTo(center.x + 3, center.y + 6);
    context.closePath();
    context.fill();
    context.restore();
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 3, center.y + 6);
        context.lineTo(center.x - 2, center.y - 6);
        context.lineTo(center.x + 2, center.y - 6);
        context.lineTo(center.x + 3, center.y + 6);
        context.closePath();
      },
      baseLineWidth,
      haloWidth
    );
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 4, center.y - 3);
        context.lineTo(center.x + 4, center.y - 3);
      },
      baseLineWidth,
      haloWidth
    );
  }

  if (feature.kind === "dungeon") {
    context.save();
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.moveTo(center.x - 5, center.y + 5);
    context.lineTo(center.x - 5, center.y - 2);
    context.quadraticCurveTo(center.x, center.y - 9, center.x + 5, center.y - 2);
    context.lineTo(center.x + 5, center.y + 5);
    context.closePath();
    context.fill();
    context.restore();
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.rect(center.x - 5, center.y - 2, 10, 7);
      },
      baseLineWidth,
      haloWidth
    );
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 5, center.y - 2);
        context.quadraticCurveTo(center.x, center.y - 9, center.x + 5, center.y - 2);
        context.moveTo(center.x, center.y - 2);
        context.lineTo(center.x, center.y + 5);
      },
      baseLineWidth,
      haloWidth
    );
  }

  if (feature.kind === "marker") {
    drawPathWithHalo(
      context,
      () => {
        context.beginPath();
        context.moveTo(center.x - 5, center.y);
        context.lineTo(center.x + 5, center.y);
        context.moveTo(center.x, center.y - 5);
        context.lineTo(center.x, center.y + 5);
      },
      baseLineWidth,
      haloWidth
    );
  }

  if (label) {
    drawLabel(context, label, { x: center.x, y: center.y + 16 }, scale);
  }

  context.restore();
}

export function renderFeaturesForLevel(
  context: CanvasRenderingContext2D,
  featuresByHex: Map<string, Feature>,
  transform: MapRenderTransform,
  visibleKeys?: ReadonlySet<string>,
  excludedHexes?: ReadonlySet<string>,
  visibilityMode: FeatureVisibilityMode = "gm"
) {
  return renderFeaturesForLevelWithStats(
    context,
    featuresByHex,
    transform,
    visibleKeys,
    excludedHexes,
    visibilityMode
  );
}

export function renderFeaturesForLevelWithStats(
  context: CanvasRenderingContext2D,
  featuresByHex: Map<string, Feature>,
  transform: MapRenderTransform,
  visibleKeys?: ReadonlySet<string>,
  excludedHexes?: ReadonlySet<string>,
  visibilityMode: FeatureVisibilityMode = "gm"
): FeatureRenderStats {
  const featureScale = transform.mapScale;
  let visibleHexes = 0;
  let visibleFeatures = 0;

  for (const [key, feature] of featuresByHex.entries()) {
    if (visibleKeys && !visibleKeys.has(key)) {
      continue;
    }

    if (excludedHexes?.has(key)) {
      continue;
    }

    if (!isFeatureVisible(feature, visibilityMode)) {
      continue;
    }

    const origin = transform.axialToScreen(featureHexIdToAxial(key));

    visibleHexes += 1;
    visibleFeatures += 1;

    renderFeature(
      context,
      feature,
      origin,
      featureScale,
      visibilityMode
    );
  }

  return {
    features: visibleFeatures,
    hexes: visibleHexes
  };
}

export function getFeatureTitle(type: FeatureKind): string {
  return featureKindLabels[type];
}

export function featureCanOverrideTerrainTile(feature: Feature): boolean {
  return feature.overrideTerrainTile && canFeatureOverrideTerrain(feature.kind);
}

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

  const asset = getFeatureAsset(type);
  const image = asset ? getLoadedImage(asset.src) : null;

  if (image) {
    context.save();
    tracePolygon(context, points);
    context.clip();
    drawImageContainedInBounds(context, image, bounds, featureImagePadding);
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
