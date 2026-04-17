import {
  type Pixel
} from "@/core/geometry/hex";
import {
  featureHexIdToAxial,
  getFeatureLabel,
  isFeatureVisible,
  type Feature,
  type FeatureVisibilityMode
} from "@/core/map/features";
import {
  drawFeatureAsset,
  drawLabel,
  drawPathWithHalo
} from "./featureVisualPrimitives";
import type { MapRenderTransform } from "./mapTransform";

export { drawFeaturePreview } from "./featurePreview";
export {
  drawFeatureTerrainOverrideTile,
  featureCanOverrideTerrainTile,
  featureGlyphs,
  getFeatureTitle
} from "./featureVisualPrimitives";

export type FeatureRenderStats = {
  features: number;
  hexes: number;
};

export function renderFeature(
  context: CanvasRenderingContext2D,
  feature: Feature,
  origin: Pixel,
  scale: number,
  visibilityMode: FeatureVisibilityMode,
  emphasizeHidden = false
) {
  const center = { x: 0, y: 0 };
  const label = getFeatureLabel(feature, visibilityMode);

  context.save();
  context.translate(origin.x, origin.y);
  context.scale(scale, scale);
  if (visibilityMode === "gm" && emphasizeHidden && feature.hidden) {
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
  visibilityMode: FeatureVisibilityMode = "gm",
  emphasizeHidden = false
) {
  return renderFeaturesForLevelWithStats(
    context,
    featuresByHex,
    transform,
    visibleKeys,
    excludedHexes,
    visibilityMode,
    emphasizeHidden
  );
}

export function renderFeaturesForLevelWithStats(
  context: CanvasRenderingContext2D,
  featuresByHex: Map<string, Feature>,
  transform: MapRenderTransform,
  visibleKeys?: ReadonlySet<string>,
  excludedHexes?: ReadonlySet<string>,
  visibilityMode: FeatureVisibilityMode = "gm",
  emphasizeHidden = false
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
      visibilityMode,
      emphasizeHidden
    );
  }

  return {
    features: visibleFeatures,
    hexes: visibleHexes
  };
}

