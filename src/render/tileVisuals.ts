import { getTerrainAsset } from "@/assets/terrainAssets";
import type { Pixel } from "@/core/geometry/hex";
import type { TerrainType } from "@/core/map/world";
import { getLoadedImage } from "./assetImages";
import { drawImageContainedInBounds, getPolygonBounds } from "./imageFit";

export const tileLabels: Record<TerrainType, string> = {
  empty: "Empty",
  water: "Water",
  plain: "Plain",
  forest: "Forest",
  hill: "Hill",
  mountain: "Mountain",
  desert: "Desert",
  swamp: "Swamp",
  tundra: "Tundra",
  wasteland: "Wasteland"
};

export function tracePolygon(context: CanvasRenderingContext2D, points: Pixel[]) {
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.closePath();
}

function withTileClip(context: CanvasRenderingContext2D, points: Pixel[], draw: () => void) {
  context.save();
  tracePolygon(context, points);
  context.clip();
  draw();
  context.restore();
}

export function drawTileAsset(
  context: CanvasRenderingContext2D,
  type: TerrainType,
  points: Pixel[]
): boolean {
  const asset = getTerrainAsset(type);

  if (!asset) {
    return false;
  }

  const image = getLoadedImage(asset.src);

  if (!image) {
    return false;
  }

  const bounds = getPolygonBounds(points);
  withTileClip(context, points, () => {
    drawImageContainedInBounds(context, image, bounds, 0.08);
  });
  return true;
}

export function drawTilePattern(
  context: CanvasRenderingContext2D,
  type: TerrainType,
  points: Pixel[],
  center: Pixel,
  radius: number
) {
  context.save();
  context.strokeStyle = "#111111";
  context.fillStyle = "#111111";
  context.lineWidth = radius * 0.035;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (type === "plain") {
    withTileClip(context, points, () => {
      for (let row = -1; row <= 1; row += 1) {
        const y = center.y + row * radius * 0.24;
        context.beginPath();
        context.moveTo(center.x - radius * 0.58, y + radius * 0.04 * row);
        context.quadraticCurveTo(center.x - radius * 0.2, y - radius * 0.07, center.x, y);
        context.quadraticCurveTo(center.x + radius * 0.2, y + radius * 0.07, center.x + radius * 0.58, y);
        context.stroke();
      }
    });
  }

  if (type === "forest") {
    withTileClip(context, points, () => {
      for (let offset = -radius * 2; offset <= radius * 2; offset += Math.max(8, radius * 0.34)) {
        context.beginPath();
        context.moveTo(center.x + offset - radius * 0.7, center.y + radius * 0.72);
        context.lineTo(center.x + offset + radius * 0.7, center.y - radius * 0.72);
        context.stroke();
      }
    });
  }

  if (type === "mountain") {
    context.beginPath();
    context.moveTo(center.x, center.y - radius * 0.45);
    context.lineTo(center.x - radius * 0.42, center.y + radius * 0.36);
    context.lineTo(center.x + radius * 0.42, center.y + radius * 0.36);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(center.x - radius * 0.08, center.y - radius * 0.22);
    context.lineTo(center.x + radius * 0.1, center.y + radius * 0.36);
    context.stroke();
  }

  if (type === "hill") {
    context.beginPath();
    context.moveTo(center.x - radius * 0.48, center.y + radius * 0.3);
    context.quadraticCurveTo(center.x - radius * 0.22, center.y - radius * 0.06, center.x + radius * 0.02, center.y + radius * 0.24);
    context.quadraticCurveTo(center.x + radius * 0.24, center.y - radius * 0.02, center.x + radius * 0.5, center.y + radius * 0.28);
    context.stroke();
  }

  if (type === "water") {
    withTileClip(context, points, () => {
      for (let row = -1; row <= 1; row += 1) {
        const y = center.y + row * radius * 0.26;
        context.beginPath();
        context.moveTo(center.x - radius * 0.58, y);

        for (let step = 0; step <= 4; step += 1) {
          const x = center.x - radius * 0.58 + step * radius * 0.29;
          context.quadraticCurveTo(x + radius * 0.14, y - radius * 0.12, x + radius * 0.29, y);
        }

        context.stroke();
      }
    });
  }

  if (type === "desert") {
    withTileClip(context, points, () => {
      for (let row = -1; row <= 1; row += 1) {
        const y = center.y + row * radius * 0.26;
        context.beginPath();
        context.moveTo(center.x - radius * 0.54, y);
        context.quadraticCurveTo(center.x - radius * 0.22, y - radius * 0.1, center.x + radius * 0.02, y);
        context.quadraticCurveTo(center.x + radius * 0.24, y + radius * 0.08, center.x + radius * 0.54, y);
        context.stroke();
      }
    });
  }

  if (type === "swamp") {
    withTileClip(context, points, () => {
      for (let row = -1; row <= 1; row += 1) {
        const y = center.y + row * radius * 0.22;
        context.beginPath();
        context.moveTo(center.x - radius * 0.56, y + radius * 0.04);
        context.quadraticCurveTo(center.x - radius * 0.24, y - radius * 0.1, center.x, y + radius * 0.02);
        context.quadraticCurveTo(center.x + radius * 0.24, y + radius * 0.12, center.x + radius * 0.56, y);
        context.stroke();
      }

      context.beginPath();
      context.moveTo(center.x - radius * 0.24, center.y + radius * 0.32);
      context.lineTo(center.x - radius * 0.08, center.y + radius * 0.08);
      context.lineTo(center.x + radius * 0.02, center.y + radius * 0.26);
      context.lineTo(center.x + radius * 0.2, center.y + radius * 0.04);
      context.stroke();
    });
  }

  if (type === "tundra") {
    withTileClip(context, points, () => {
      context.beginPath();
      context.moveTo(center.x - radius * 0.44, center.y + radius * 0.3);
      context.lineTo(center.x - radius * 0.16, center.y - radius * 0.34);
      context.lineTo(center.x + radius * 0.08, center.y + radius * 0.24);
      context.lineTo(center.x + radius * 0.36, center.y - radius * 0.22);
      context.stroke();
    });
  }

  if (type === "wasteland") {
    withTileClip(context, points, () => {
      context.beginPath();
      context.moveTo(center.x - radius * 0.48, center.y - radius * 0.3);
      context.lineTo(center.x - radius * 0.16, center.y - radius * 0.04);
      context.lineTo(center.x - radius * 0.24, center.y + radius * 0.18);
      context.lineTo(center.x + radius * 0.08, center.y + radius * 0.4);
      context.lineTo(center.x + radius * 0.4, center.y + radius * 0.08);
      context.stroke();
    });
  }

  context.restore();
}

export function drawTileContent(
  context: CanvasRenderingContext2D,
  type: TerrainType,
  points: Pixel[],
  center: Pixel,
  radius: number
) {
  if (type === "empty") {
    return;
  }

  if (drawTileAsset(context, type, points)) {
    return;
  }

  drawTilePattern(context, type, points, center, radius);
}

function getPreviewHexCorners(width: number, height: number): { center: Pixel; points: Pixel[]; radius: number } {
  const center = { x: width / 2, y: height / 2 };
  const radius = Math.max(1, Math.min(width / 1.9, height / 2.12));
  const points = Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 6 + (Math.PI / 3) * index;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    };
  });

  return { center, points, radius };
}

export function drawTilePreview(
  context: CanvasRenderingContext2D,
  type: TerrainType,
  width: number,
  height: number,
  selected = false
) {
  const { center, points, radius } = getPreviewHexCorners(width, height);

  context.clearRect(0, 0, width, height);
  context.save();
  tracePolygon(context, points);
  context.fillStyle = "#ffffff";
  context.fill();
  context.restore();

  drawTileContent(context, type, points, center, radius);

  tracePolygon(context, points);
  context.strokeStyle = "#111111";
  context.lineWidth = selected ? 2 : 1.2;
  context.stroke();
}
