import { axialToWorldPixel, type HexId } from "@/core/geometry/hex";
import { getLevelScale } from "@/core/geometry/hex";
import type { MapState } from "@/core/map/worldTypes";
import type {
  PixiCameraState,
  PixiSceneCellRecord,
  PixiSceneRenderFrame,
} from "./pixiTypes";
import type { PixiActiveRenderWindow } from "./pixiActiveWindow";
import type { PixiLevelScene } from "./pixiMapSceneCache";

export function buildPixiSceneRenderFrame(
  world: MapState,
  scene: PixiLevelScene,
  activeWindow: PixiActiveRenderWindow,
  camera: PixiCameraState,
): PixiSceneRenderFrame {
  const renderCells: PixiSceneCellRecord[] = [];
  const hiddenCells: PixiSceneCellRecord[] = [];
  const visibleTerrainCells: PixiSceneCellRecord[] = [];
  const visibleTerrainKeys = new Set<string>();
  const featureVisibleKeys = new Set<string>();
  const isPlayerMode = camera.featureVisibilityMode === "player";

  for (const hexId of activeWindow.cellIds) {
    const cell = scene.cellsByHex.get(hexId as HexId);

    if (!cell) {
      continue;
    }

    renderCells.push(cell);

    if (cell.cell.hidden) {
      hiddenCells.push(cell);
    }

    if (!isPlayerMode || !cell.cell.hidden) {
      visibleTerrainCells.push(cell);
      visibleTerrainKeys.add(cell.key);
    }

    if (!isPlayerMode) {
      featureVisibleKeys.add(cell.key);
    }
  }

  if (isPlayerMode) {
    for (const cell of visibleTerrainCells) {
      featureVisibleKeys.add(cell.key);
    }
  }

  const mapScale = getLevelScale(camera.level) * camera.visualZoom;

  return {
    cameraWorldCenter: axialToWorldPixel(camera.center, camera.level),
    factionOverlayColorMap: new Map(
      visibleTerrainCells
        .filter((cell) => cell.factionColor)
        .map((cell) => [cell.key, cell.factionColor as string]),
    ),
    featureVisibleKeys,
    hiddenCells,
    highlightedHex: null,
    hoverRiverEdge: null,
    renderCells,
    transform: {
      level: camera.level,
      mapScale,
      scaleMapLength: (length) => length * mapScale,
      viewport: camera.viewport,
      zoom: camera.visualZoom,
    },
    visibleTerrainCells,
    visibleTerrainKeys,
    world,
  };
}
