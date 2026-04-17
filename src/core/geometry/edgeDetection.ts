import {
  getHexCorners,
  getNeighbors,
  roundAxial,
  screenPixelToAxial,
  type Axial,
  type Pixel
} from "@/core/geometry/hex";
import {
  getRiverEdgeRefKey,
  type RiverEdgeIndex,
  type RiverEdgeRef
} from "@/core/map/world";

type Viewport = {
  height: number;
  width: number;
};

const riverEdgeLookup = [0, 1, 2, 3, 4, 5] as const satisfies ReadonlyArray<RiverEdgeIndex>;

function getPointToSegmentDistance(point: Pixel, start: Pixel, end: Pixel): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = {
    x: start.x + t * dx,
    y: start.y + t * dy
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export function riverEdgesEqual(a: RiverEdgeRef | null, b: RiverEdgeRef | null): boolean {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.edge === b.edge && a.axial.q === b.axial.q && a.axial.r === b.axial.r;
}

export function getNearestRiverEdgeAtPoint(
  point: Pixel,
  center: Axial,
  level: number,
  zoom: number,
  viewport: Viewport
): RiverEdgeRef | null {
  const rounded = roundAxial(
    screenPixelToAxial(point, center, level, zoom, {
      x: viewport.width,
      y: viewport.height
    })
  );
  const candidates = [rounded, ...getNeighbors(rounded)];
  const maxDistance = Math.max(8, 13 + Math.log2(Math.max(zoom, 0.25)) * 2.5);
  let best: { distance: number; ref: RiverEdgeRef } | null = null;

  for (const candidate of candidates) {
    const corners = getHexCorners(candidate, center, level, zoom, {
      x: viewport.width,
      y: viewport.height
    });

    for (const edgeIndex of riverEdgeLookup) {
      const start = corners[edgeIndex];
      const end = corners[(edgeIndex + 1) % corners.length];
      const distance = getPointToSegmentDistance(point, start, end);

      if (!best || distance < best.distance) {
        best = {
          distance,
          ref: {
            axial: candidate,
            edge: edgeIndex
          }
        };
      }
    }
  }

  if (!best || best.distance > maxDistance) {
    return null;
  }

  return best.ref;
}

export function getRiverEdgesAlongPointerMove(
  from: Pixel,
  to: Pixel,
  center: Axial,
  level: number,
  zoom: number,
  viewport: Viewport,
  initialLastEdge: RiverEdgeRef | null
): { edges: RiverEdgeRef[]; lastEdge: RiverEdgeRef | null } {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / 7));
  const edges: RiverEdgeRef[] = [];
  let lastKey = initialLastEdge ? getRiverEdgeRefKey(initialLastEdge) : "";
  let lastEdge = initialLastEdge;

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const samplePoint = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t
    };
    const edge = getNearestRiverEdgeAtPoint(samplePoint, center, level, zoom, viewport);

    if (!edge) {
      continue;
    }

    const key = getRiverEdgeRefKey(edge);

    if (key === lastKey) {
      continue;
    }

    edges.push(edge);
    lastKey = key;
    lastEdge = edge;
  }

  return { edges, lastEdge };
}
