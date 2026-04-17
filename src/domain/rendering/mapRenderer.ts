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
import { drawHiddenCellOverlay, drawTerrainBaseLayer, drawTerrainDetailLayer } from "./terrainRenderer";
import { collectVisibleCells } from "./visibleCells";
import type { RenderStats, Viewport } from "./renderTypes";

const fogOverlayOpacity = 0.4;

type RenderMapFrameOptions = {
  canvas: HTMLCanvasElement;
  center: Axial;
  fogEditingActive?: boolean;
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
  fogEditingActive = false,
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
  const hiddenCells = visible.cells.filter(({ cell }) => cell.hidden);
  const visibleTerrainCells = featureVisibilityMode === "player"
    ? visible.cells.filter(({ cell }) => !cell.hidden)
    : visible.cells;
  const visibleTerrainKeys = new Set(visibleTerrainCells.map((cell) => cell.key));
  const tileCount = drawTerrainBaseLayer(
    context,
    visible.cells,
    transform,
    featureVisibilityMode === "player"
  );
  const boundaryCount = drawBoundaryOverlays(
    context,
    visibleTerrainCells,
    transform
  );
  const riverCount = drawRiverOverlays(
    context,
    visibleTerrainCells,
    riverLevelMap,
    transform
  );
  const cellStats = drawTerrainDetailLayer(
    context,
    visibleTerrainCells,
    featuresByHex,
    highlightedHex,
    transform,
    showCoordinates
  );
  const factionCount = drawFactionOverlays(
    context,
    visibleTerrainCells,
    factionOverlayColorMap,
    transform
  );
  const roadCount = drawRoadOverlays(
    context,
    getRoadLevelMap(world, level),
    transform,
    featureVisibilityMode === "player" ? visibleTerrainKeys : undefined
  );

  if (fogEditingActive) {
    drawHiddenCellOverlay(context, hiddenCells, transform, fogOverlayOpacity);
  }

  if (hoverRiverEdge) {
    drawHoveredRiverEdge(context, hoverRiverEdge, transform);
  }

  const featureStats = renderFeaturesForLevelWithStats(
    context,
    featuresByHex,
    transform,
    featureVisibilityMode === "player" ? visibleTerrainKeys : visible.keys,
    cellStats.terrainOverriddenHexes,
    featureVisibilityMode,
    fogEditingActive && featureVisibilityMode === "gm"
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
