import { boundsContains, expandWorldBounds, getCameraWorldBounds, type WorldBounds } from "./pixiGeometry";
import type { PixiLevelScene } from "./pixiMapSceneCache";
import type { PixiCameraState } from "./pixiTypes";

export type PixiActiveRenderWindow = {
  bounds: WorldBounds;
  cellIds: string[];
  key: string;
  level: number;
  marginBounds: WorldBounds;
};

function createWindowKey(level: number, cellIds: readonly string[]): string {
  if (cellIds.length === 0) {
    return `${level}|empty`;
  }

  return `${level}|${cellIds.length}|${cellIds[0]}|${cellIds[cellIds.length - 1]}`;
}

export function createPixiActiveRenderWindow(
  scene: PixiLevelScene,
  camera: PixiCameraState
): PixiActiveRenderWindow {
  const bounds = getCameraWorldBounds(camera.center, camera.level, camera.visualZoom, camera.viewport);
  const marginBounds = expandWorldBounds(bounds);
  const cellIds = scene.spatialIndex.queryCells(marginBounds).sort();

  return {
    bounds,
    cellIds,
    key: createWindowKey(camera.level, cellIds),
    level: camera.level,
    marginBounds
  };
}

export function shouldReusePixiActiveWindow(
  activeWindow: PixiActiveRenderWindow | null,
  camera: PixiCameraState
): boolean {
  if (!activeWindow || activeWindow.level !== camera.level) {
    return false;
  }

  const cameraBounds = getCameraWorldBounds(camera.center, camera.level, camera.visualZoom, camera.viewport);
  return boundsContains(activeWindow.marginBounds, cameraBounds);
}
