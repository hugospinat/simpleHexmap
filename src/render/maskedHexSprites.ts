import type { Pixel } from "@/core/geometry/hex";
import { drawImageContainedInBounds, getPolygonBounds } from "@/render/imageFit";

const spriteCache = new Map<string, HTMLCanvasElement>();
const maxCachedSprites = 256;

function makeSpriteKey(image: HTMLImageElement, width: number, height: number, padding: number): string {
  const src = image.currentSrc || image.src;
  return `${src}|${Math.round(width)}x${Math.round(height)}|${padding}`;
}

function getCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function rememberSprite(key: string, sprite: HTMLCanvasElement): HTMLCanvasElement {
  if (spriteCache.size >= maxCachedSprites) {
    const firstKey = spriteCache.keys().next().value as string | undefined;

    if (firstKey) {
      spriteCache.delete(firstKey);
    }
  }

  spriteCache.set(key, sprite);
  return sprite;
}

export function drawMaskedHexImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  points: Pixel[],
  padding: number
): void {
  const bounds = getPolygonBounds(points);
  const width = Math.max(1, bounds.right - bounds.left);
  const height = Math.max(1, bounds.bottom - bounds.top);
  const key = makeSpriteKey(image, width, height, padding);
  const cached = spriteCache.get(key);

  if (cached) {
    context.drawImage(cached, bounds.left, bounds.top, width, height);
    return;
  }

  const sprite = getCanvas(width, height);
  const spriteContext = sprite.getContext("2d");

  if (!spriteContext) {
    drawImageContainedInBounds(context, image, bounds, padding);
    return;
  }

  const localPoints = points.map((point) => ({
    x: point.x - bounds.left,
    y: point.y - bounds.top
  }));

  spriteContext.beginPath();
  spriteContext.moveTo(localPoints[0].x, localPoints[0].y);

  for (const point of localPoints.slice(1)) {
    spriteContext.lineTo(point.x, point.y);
  }

  spriteContext.closePath();
  spriteContext.clip();
  drawImageContainedInBounds(spriteContext, image, {
    bottom: height,
    left: 0,
    right: width,
    top: 0
  }, padding);

  context.drawImage(rememberSprite(key, sprite), bounds.left, bounds.top, width, height);
}
