import type { Pixel } from "@/domain/geometry/hex";

type Bounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

function getImageSize(image: HTMLImageElement): { width: number; height: number } | null {
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

export function getPolygonBounds(points: Pixel[]): Bounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    bottom: Math.max(...ys),
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys)
  };
}

export function drawImageContainedInBounds(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  bounds: Bounds,
  paddingRatio = 0.08
): boolean {
  const imageSize = getImageSize(image);

  if (!imageSize) {
    return false;
  }

  const boundsWidth = Math.max(0, bounds.right - bounds.left);
  const boundsHeight = Math.max(0, bounds.bottom - bounds.top);

  if (boundsWidth <= 0 || boundsHeight <= 0) {
    return false;
  }

  const safePaddingRatio = Math.min(0.45, Math.max(0, paddingRatio));
  const availableWidth = boundsWidth * (1 - safePaddingRatio * 2);
  const availableHeight = boundsHeight * (1 - safePaddingRatio * 2);

  if (availableWidth <= 0 || availableHeight <= 0) {
    return false;
  }

  const scale = Math.min(
    availableWidth / imageSize.width,
    availableHeight / imageSize.height
  );
  const drawWidth = imageSize.width * scale;
  const drawHeight = imageSize.height * scale;
  const x = bounds.left + (boundsWidth - drawWidth) / 2;
  const y = bounds.top + (boundsHeight - drawHeight) / 2;

  context.drawImage(image, x, y, drawWidth, drawHeight);
  return true;
}
