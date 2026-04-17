import { type RiverEdgeRef, type World } from "@/domain/world/world";
import { renderFeaturesForLevelWithStats } from "@/domain/rendering/featureVisuals";
import type { Axial } from "@/domain/geometry/hex";
import type { FeatureVisibilityMode } from "@/domain/world/features";
import { drawBoundaryOverlays } from "./boundaryRenderer";
import { drawFactionOverlays } from "./factionRenderer";
import { createMapRenderView, type MapRenderView } from "./mapRenderView";
import { drawRoadOverlays } from "./roadRenderer";
import { drawHoveredRiverEdge, drawRiverOverlays } from "./riverRenderer";
import { drawHiddenCellOverlay, drawTerrainBaseLayer, drawTerrainDetailLayer } from "./terrainRenderer";
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

  const renderView = createMapRenderView({
    center,
    featureVisibilityMode,
    highlightedHex,
    hoverRiverEdge,
    level,
    viewport,
    visualZoom,
    world
  });

  return drawMapRenderView(
    context,
    renderView,
    showCoordinates,
    fogEditingActive,
    featureVisibilityMode
  );
}

function drawMapRenderView(
  context: CanvasRenderingContext2D,
  renderView: MapRenderView,
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
    riverLevelMap,
    roadLevelMap,
    transform,
    visibleTerrainCells,
    visibleTerrainKeys
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
    roadLevelMap,
    transform,
    featureVisibilityMode === "player" ? visibleTerrainKeys : undefined
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
