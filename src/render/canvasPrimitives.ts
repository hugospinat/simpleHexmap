import type { Pixel } from "@/core/geometry/hex";
import { tracePolygon } from "@/render/tileVisuals";

export function fillPolygon(context: CanvasRenderingContext2D, points: Pixel[], fill: string) {
  tracePolygon(context, points);
  context.fillStyle = fill;
  context.fill();
}

export function addPolygonPath(context: CanvasRenderingContext2D, points: Pixel[]): void {
  context.moveTo(points[0].x, points[0].y);

  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }

  context.closePath();
}

export function strokePolygon(
  context: CanvasRenderingContext2D,
  points: Pixel[],
  stroke: string,
  lineWidth: number
) {
  tracePolygon(context, points);
  context.strokeStyle = stroke;
  context.lineWidth = lineWidth;
  context.stroke();
}

export function getSegmentKey(start: Pixel, end: Pixel): string {
  const precision = 1000;
  const sx = Math.round(start.x * precision);
  const sy = Math.round(start.y * precision);
  const ex = Math.round(end.x * precision);
  const ey = Math.round(end.y * precision);

  if (sx < ex || (sx === ex && sy <= ey)) {
    return `${sx},${sy}|${ex},${ey}`;
  }

  return `${ex},${ey}|${sx},${sy}`;
}
