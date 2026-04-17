import { type RiverEdgeRef, type MapState } from "@/core/map/world";
import { renderFeaturesForLevelWithStats } from "@/render/featureLayer";
import type { Axial } from "@/core/geometry/hex";
import type { FeatureVisibilityMode } from "@/core/map/features";
import { drawBoundaryOverlays } from "./boundaryRenderer";
import { drawFactionOverlays } from "./factionRenderer";
import { createMapRenderFrame, type MapRenderFrame } from "./mapRenderFrame";
import { drawRoadOverlays } from "./roadRenderer";
import { drawHoveredRiverEdge, drawRiverOverlays } from "./riverRenderer";
import { drawHiddenCellOverlay, drawTerrainBaseLayer, drawTerrainDetailLayer } from "./terrainRenderer";
import type { RenderStats, Viewport } from "./renderTypes";
import { nowForRenderTiming, withRenderTimings, type TimedRenderStats } from "./renderPerformance";

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
  world: MapState;
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
}: RenderMapFrameOptions): TimedRenderStats | null {
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const frameStartMs = nowForRenderTiming();
  const pixelRatio = window.devicePixelRatio || 1;
  const targetWidth = Math.max(1, Math.floor(viewport.width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(viewport.height * pixelRatio));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, viewport.width, viewport.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, viewport.width, viewport.height);

  const renderView = createMapRenderFrame({
    center,
    featureVisibilityMode,
    highlightedHex,
    hoverRiverEdge,
    level,
    viewport,
    visualZoom,
    world
  });
  const buildFrameEndMs = nowForRenderTiming();

  const stats = drawMapRenderFrame(
    context,
    renderView,
    showCoordinates,
    fogEditingActive,
    featureVisibilityMode
  );
  return withRenderTimings(stats, frameStartMs, buildFrameEndMs, nowForRenderTiming());
}

function drawMapRenderFrame(
  context: CanvasRenderingContext2D,
  renderView: MapRenderFrame,
  showCoordinates: boolean,
  fogEditingActive: boolean,
  featureVisibilityMode: FeatureVisibilityMode
): RenderStats {
  const {
    factionOverlayColorMap,
    featureVisibleKeys,
    featuresByHex,
    hiddenCells,
    highlightedHex,
    hoverRiverEdge,
    transform,
    visibleTerrainCells
  } = renderView;

  const tileCount = drawTerrainBaseLayer(
    context,
    visibleTerrainCells,
    transform
  );
  const boundaryCount = drawBoundaryOverlays(
    context,
    visibleTerrainCells,
    transform
  );
  const riverCount = drawRiverOverlays(
    context,
    visibleTerrainCells,
    transform
  );
  const cellStats = drawTerrainDetailLayer(
    context,
    visibleTerrainCells,
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
    visibleTerrainCells,
    transform
  );

  if (fogEditingActive && featureVisibilityMode === "gm") {
    drawHiddenCellOverlay(context, hiddenCells, transform, fogOverlayOpacity);
  }

  if (hoverRiverEdge) {
    drawHoveredRiverEdge(context, hoverRiverEdge, transform);
  }

  const featureStats = renderFeaturesForLevelWithStats(
    context,
    featuresByHex,
    transform,
    featureVisibleKeys,
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
