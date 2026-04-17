export type Axial = { q: number; r: number };
export type HexId = string & { readonly __brand: "HexId" };

export type Pixel = { x: number; y: number };

export const axialDirections: Axial[] = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 }
];

export const HEX_BASE_SIZE = 32;
export const LEVEL_SCALE = Math.sqrt(7);
export const LEVEL_ROTATION = Math.atan2(Math.sqrt(3) / 2, 2.5);

export function hexKey({ q, r }: Axial): HexId {
  return `${q},${r}` as HexId;
}

export function parseHexKey(key: HexId | string): Axial {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

export function addAxial(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function getNeighbors(axial: Axial): Axial[] {
  return axialDirections.map((direction) => addAxial(axial, direction));
}

export function axialToPixel({ q, r }: Axial, size = HEX_BASE_SIZE): Pixel {
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * 1.5 * r
  };
}

export function pixelToAxial({ x, y }: Pixel, size = HEX_BASE_SIZE): Axial {
  return {
    q: (Math.sqrt(3) / 3 * x - y / 3) / size,
    r: (2 / 3 * y) / size
  };
}

export function roundAxial({ q, r }: Axial): Axial {
  let cubeQ = Math.round(q);
  let cubeR = Math.round(r);
  let cubeS = Math.round(-q - r);

  const qDiff = Math.abs(cubeQ - q);
  const rDiff = Math.abs(cubeR - r);
  const sDiff = Math.abs(cubeS - (-q - r));

  if (qDiff > rDiff && qDiff > sDiff) {
    cubeQ = -cubeR - cubeS;
  } else if (rDiff > sDiff) {
    cubeR = -cubeQ - cubeS;
  } else {
    cubeS = -cubeQ - cubeR;
  }

  return { q: cubeQ, r: cubeR };
}

export function axialDistance(a: Axial, b: Axial): number {
  return (
    Math.abs(a.q - b.q) +
    Math.abs(a.q + a.r - b.q - b.r) +
    Math.abs(a.r - b.r)
  ) / 2;
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function getAxialLine(start: Axial, end: Axial): Axial[] {
  const distance = axialDistance(start, end);

  if (distance === 0) {
    return [start];
  }

  return Array.from({ length: distance + 1 }, (_, index) => {
    const amount = index / distance;
    return roundAxial({
      q: lerp(start.q, end.q, amount),
      r: lerp(start.r, end.r, amount)
    });
  });
}

export function coarseToFine({ q, r }: Axial): Axial {
  return {
    q: 2 * q - r,
    r: q + 3 * r
  };
}

export function getChildCluster(parent: Axial): Axial[] {
  const center = coarseToFine(parent);
  return [center, ...getNeighbors(center)];
}

export function getDescendantsAtLevel(parent: Axial, fromLevel: number, toLevel: number): Axial[] {
  if (fromLevel >= toLevel) {
    return [parent];
  }

  let currentLevel = fromLevel;
  let descendants = [parent];

  while (currentLevel < toLevel) {
    const nextByKey = new Map<string, Axial>();

    for (const descendant of descendants.flatMap(getChildCluster)) {
      nextByKey.set(hexKey(descendant), descendant);
    }

    descendants = Array.from(nextByKey.values());
    currentLevel += 1;
  }

  return descendants;
}

export function fineToCoarse({ q, r }: Axial): Axial {
  return {
    q: (3 * q + r) / 7,
    r: (-q + 2 * r) / 7
  };
}

export function getAncestorAtLevel(axial: Axial, fromLevel: number, toLevel: number): Axial {
  if (fromLevel <= toLevel) {
    return axial;
  }

  let currentLevel = fromLevel;
  let ancestor = axial;

  while (currentLevel > toLevel) {
    ancestor = roundAxial(fineToCoarse(ancestor));
    currentLevel -= 1;
  }

  return ancestor;
}

export function getLevelExponent(level: number): number {
  return 1 - level;
}

export function getLevelScale(level: number): number {
  return LEVEL_SCALE ** getLevelExponent(level);
}

export function getLevelRotation(level: number): number {
  return LEVEL_ROTATION * getLevelExponent(level);
}

export function rotatePixel({ x, y }: Pixel, radians: number): Pixel {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
}

export function unrotatePixel(pixel: Pixel, radians: number): Pixel {
  return rotatePixel(pixel, -radians);
}

export function axialToWorldPixel(axial: Axial, level: number, size = HEX_BASE_SIZE): Pixel {
  const scaled = axialToPixel(axial, size * getLevelScale(level));
  return rotatePixel(scaled, getLevelRotation(level));
}

export function worldPixelToAxial(pixel: Pixel, level: number, size = HEX_BASE_SIZE): Axial {
  const unrotated = unrotatePixel(pixel, getLevelRotation(level));
  return pixelToAxial(unrotated, size * getLevelScale(level));
}

export function convertAxialBetweenLevels(
  axial: Axial,
  fromLevel: number,
  toLevel: number,
  size = HEX_BASE_SIZE
): Axial {
  if (fromLevel === toLevel) {
    return axial;
  }

  // Axial q/r coordinates are local to a specific level. The same q/r at
  // another level is a different world position, so level switches must
  // preserve the invariant world pixel center and re-express it in the target grid.
  return worldPixelToAxial(axialToWorldPixel(axial, fromLevel, size), toLevel, size);
}

export function axialToScreenPixel(
  axial: Axial,
  center: Axial,
  level: number,
  zoom: number,
  viewport: Pixel,
  size = HEX_BASE_SIZE
): Pixel {
  const world = axialToWorldPixel(axial, level, size);
  const centerWorld = axialToWorldPixel(center, level, size);

  return {
    x: viewport.x / 2 + (world.x - centerWorld.x) * zoom,
    y: viewport.y / 2 + (world.y - centerWorld.y) * zoom
  };
}

export function screenPixelToAxial(
  screen: Pixel,
  center: Axial,
  level: number,
  zoom: number,
  viewport: Pixel,
  size = HEX_BASE_SIZE
): Axial {
  const centerWorld = axialToWorldPixel(center, level, size);
  const world = {
    x: centerWorld.x + (screen.x - viewport.x / 2) / zoom,
    y: centerWorld.y + (screen.y - viewport.y / 2) / zoom
  };

  return worldPixelToAxial(world, level, size);
}

export function panCenterByScreenDelta(
  center: Axial,
  delta: Pixel,
  level: number,
  zoom: number,
  size = HEX_BASE_SIZE
): Axial {
  const centerWorld = axialToWorldPixel(center, level, size);
  const nextCenterWorld = {
    x: centerWorld.x - delta.x / zoom,
    y: centerWorld.y - delta.y / zoom
  };

  return worldPixelToAxial(nextCenterWorld, level, size);
}

export function getHexCorners(
  axial: Axial,
  center: Axial,
  level: number,
  zoom: number,
  viewport: Pixel,
  size = HEX_BASE_SIZE
): Pixel[] {
  const screenCenter = axialToScreenPixel(axial, center, level, zoom, viewport, size);
  const radius = size * getLevelScale(level) * zoom;
  const rotation = getLevelRotation(level);

  return Array.from({ length: 6 }, (_, index) => {
    const angle = rotation + Math.PI / 6 + (Math.PI / 3) * index;
    return {
      x: screenCenter.x + radius * Math.cos(angle),
      y: screenCenter.y + radius * Math.sin(angle)
    };
  });
}
