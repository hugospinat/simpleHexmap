import type { Viewport } from "@/render/renderTypes";

export type CanvasSizing = {
  pixelRatio: number;
  resized: boolean;
};

export function resizeCanvasToViewport(canvas: HTMLCanvasElement, viewport: Viewport): CanvasSizing {
  const pixelRatio = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.floor(viewport.width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(viewport.height * pixelRatio));
  const resized = canvas.width !== targetWidth || canvas.height !== targetHeight;

  if (resized) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  return { pixelRatio, resized };
}

export function prepareCanvasContext(
  canvas: HTMLCanvasElement,
  viewport: Viewport,
  clear = true
): CanvasRenderingContext2D | null {
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const { pixelRatio } = resizeCanvasToViewport(canvas, viewport);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (clear) {
    context.clearRect(0, 0, viewport.width, viewport.height);
  }

  return context;
}
