import { getFeaturesForLevel } from "@/domain/world/features";
import {
  getFactionOverlayColorMap,
  getLevelMap,
  getRoadLevelMap,
  getRiverLevelMap,
  type RiverEdgeRef,
  type World
} from "@/domain/world/world";
import { renderFeaturesForLevelWithStats } from "@/domain/rendering/featureVisuals";
import type { Axial } from "@/domain/geometry/hex";
import type { FeatureVisibilityMode } from "@/domain/world/features";
import { drawBoundaryOverlays } from "./boundaryRenderer";
import { drawFactionOverlays } from "./factionRenderer";
import { createMapRenderTransform } from "./mapTransform";
import { drawRoadOverlays } from "./roadRenderer";
import { drawHoveredRiverEdge, drawRiverOverlays } from "./riverRenderer";
import { drawTerrainBaseLayer, drawTerrainDetailLayer } from "./terrainRenderer";
import { collectVisibleCells } from "./visibleCells";
import type { RenderStats, Viewport } from "./renderTypes";

type RenderMapFrameOptions = {
  canvas: HTMLCanvasElement;
  center: Axial;
  hoverRiverEdge: RiverEdgeRef | null;
  featureVisibilityMode?: FeatureVisibilityMode;
  highlightedHex: Axial | null;
  level: number;
  showCoordinates: boolean;
  viewport: Viewport;
  visualZoom: number;
  world: World;
};

export function renderMapFrame({
  canvas,
  center,
  featureVisibilityMode = "gm",
  highlightedHex,
  hoverRiverEdge,
  level,
  showCoordinates,
  viewport,
  visualZoom,
  world
}: RenderMapFrameOptions): RenderStats | null {
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, viewport.width, viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, viewport.width, viewport.height);

  const levelMap = getLevelMap(world, level);
  const factionOverlayColorMap = getFactionOverlayColorMap(world, level);
  const featuresByHex = getFeaturesForLevel(world, level);
  const riverLevelMap = getRiverLevelMap(world, level);
  const transform = createMapRenderTransform(center, level, visualZoom, viewport);
  const visible = collectVisibleCells(levelMap, center, level, visualZoom, viewport);
  const tileCount = drawTerrainBaseLayer(
    context,
    visible.cells,
    transform
  );
  const boundaryCount = drawBoundaryOverlays(
    context,
    visible.cells,
    transform
  );
  const riverCount = drawRiverOverlays(
    context,
    visible.cells,
    riverLevelMap,
    transform
  );
  const cellStats = drawTerrainDetailLayer(
    context,
    visible.cells,
    featuresByHex,
    highlightedHex,
    transform,
    showCoordinates
  );
  const factionCount = drawFactionOverlays(
    context,
    visible.cells,
    factionOverlayColorMap,
    transform
  );
  const roadCount = drawRoadOverlays(
    context,
    getRoadLevelMap(world, level),
    transform
  );

  if (hoverRiverEdge) {
    drawHoveredRiverEdge(context, hoverRiverEdge, transform);
  }

  const featureStats = renderFeaturesForLevelWithStats(
    context,
    featuresByHex,
    transform,
    visible.keys,
    cellStats.terrainOverriddenHexes,
    featureVisibilityMode
  );

  return {
    featureHexes: featureStats.hexes,
    features: featureStats.features,
    factions: factionCount,
    boundaries: boundaryCount,
    labels: cellStats.labels,
    roads: roadCount,
    rivers: riverCount,
    tiles: tileCount
  };
}
