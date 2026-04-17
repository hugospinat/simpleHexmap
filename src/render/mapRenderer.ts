import { type RiverEdgeRef, type MapState } from "@/core/map/world";
import { renderFeatureCellsWithStats } from "@/render/featureLayer";
import type { Axial } from "@/core/geometry/hex";
import type { FeatureVisibilityMode } from "@/core/map/features";
import { drawBoundaryOverlays } from "./boundaryRenderer";
import { drawFactionOverlays } from "./factionRenderer";
import { createMapRenderFrame, type MapRenderFrame } from "./mapRenderFrame";
import { drawRoadOverlays } from "./roadRenderer";
import { drawHoveredRiverEdge, drawRiverOverlays } from "./riverRenderer";
import { drawHiddenCellOverlay, drawTerrainLayer } from "./terrainRenderer";
import { hexKey } from "@/core/geometry/hex";
import { strokePolygon } from "./canvasPrimitives";
import type { RenderStats, Viewport } from "./renderTypes";
import { nowForRenderTiming, withRenderTimings, type TimedRenderStats } from "./renderPerformance";
import { prepareCanvasContext } from "./canvasSizing";

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
  const context = prepareCanvasContext(canvas, viewport);

  if (!context) {
    return null;
  }

  const frameStartMs = nowForRenderTiming();
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

  const layerTimings: Record<string, number> = {};
  timeLayer(layerTimings, "background", () => drawMapBackground(context, viewport));
  const stats = drawMapBaseFrame(
    context,
    renderView,
    showCoordinates,
    fogEditingActive,
    featureVisibilityMode,
    layerTimings
  );
  timeLayer(layerTimings, "interaction", () => {
    drawMapInteractionFrame(context, renderView, fogEditingActive, featureVisibilityMode);
  });
  return withRenderTimings(stats, frameStartMs, buildFrameEndMs, nowForRenderTiming(), layerTimings);
}

export function renderMapBaseFrame({
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
  const context = prepareCanvasContext(canvas, viewport);

  if (!context) {
    return null;
  }

  const frameStartMs = nowForRenderTiming();
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

  const layerTimings: Record<string, number> = {};
  timeLayer(layerTimings, "background", () => drawMapBackground(context, viewport));
  const stats = drawMapBaseFrame(
    context,
    renderView,
    showCoordinates,
    fogEditingActive,
    featureVisibilityMode,
    layerTimings
  );

  return withRenderTimings(stats, frameStartMs, buildFrameEndMs, nowForRenderTiming(), layerTimings);
}

export function renderMapInteractionFrame({
  canvas,
  center,
  fogEditingActive = false,
  featureVisibilityMode = "gm",
  highlightedHex,
  hoverRiverEdge,
  level,
  viewport,
  visualZoom,
  world
}: Omit<RenderMapFrameOptions, "showCoordinates">): TimedRenderStats | null {
  const context = prepareCanvasContext(canvas, viewport);

  if (!context) {
    return null;
  }

  const frameStartMs = nowForRenderTiming();
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

  const layerTimings: Record<string, number> = {};
  timeLayer(layerTimings, "interaction", () => {
    drawMapInteractionFrame(context, renderView, fogEditingActive, featureVisibilityMode);
  });
  return withRenderTimings(createEmptyRenderStats(), frameStartMs, buildFrameEndMs, nowForRenderTiming(), layerTimings);
}

function timeLayer<T>(layerTimings: Record<string, number>, name: string, draw: () => T): T {
  const start = nowForRenderTiming();
  const result = draw();
  layerTimings[name] = Number((nowForRenderTiming() - start).toFixed(2));
  return result;
}

function drawMapBackground(context: CanvasRenderingContext2D, viewport: Viewport): void {
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, viewport.width, viewport.height);
}

function createEmptyRenderStats(): RenderStats {
  return {
    boundaries: 0,
    factions: 0,
    featureHexes: 0,
    features: 0,
    labels: 0,
    roads: 0,
    rivers: 0,
    tiles: 0
  };
}

function drawMapBaseFrame(
  context: CanvasRenderingContext2D,
  renderView: MapRenderFrame,
  showCoordinates: boolean,
  fogEditingActive: boolean,
  featureVisibilityMode: FeatureVisibilityMode,
  layerTimings: Record<string, number>
): RenderStats {
  const {
    factionOverlayColorMap,
    hiddenCells,
    highlightedHex,
    transform,
    visibleTerrainCells
  } = renderView;

  const cellStats = timeLayer(layerTimings, "terrain", () => drawTerrainLayer(
    context,
    visibleTerrainCells,
    highlightedHex,
    transform,
    showCoordinates
  ));
  const boundaryCount = timeLayer(layerTimings, "boundaries", () => drawBoundaryOverlays(
    context,
    visibleTerrainCells,
    transform
  ));
  const riverCount = timeLayer(layerTimings, "rivers", () => drawRiverOverlays(
    context,
    visibleTerrainCells,
    transform
  ));
  const factionCount = timeLayer(layerTimings, "factions", () => drawFactionOverlays(
    context,
    visibleTerrainCells,
    factionOverlayColorMap,
    transform
  ));
  const roadCount = timeLayer(layerTimings, "roads", () => drawRoadOverlays(
    context,
    visibleTerrainCells,
    transform
  ));

  const featureStats = timeLayer(layerTimings, "features", () => renderFeatureCellsWithStats(
    context,
    visibleTerrainCells,
    transform,
    cellStats.terrainOverriddenHexes,
    featureVisibilityMode,
    fogEditingActive && featureVisibilityMode === "gm"
  ));

  return {
    featureHexes: featureStats.hexes,
    features: featureStats.features,
    factions: factionCount,
    boundaries: boundaryCount,
    labels: cellStats.labels,
    roads: roadCount,
    rivers: riverCount,
    tiles: cellStats.tiles
  };
}

function drawMapInteractionFrame(
  context: CanvasRenderingContext2D,
  renderView: MapRenderFrame,
  fogEditingActive: boolean,
  featureVisibilityMode: FeatureVisibilityMode
): void {
  const {
    highlightedHex,
    hiddenCells,
    hoverRiverEdge,
    visibleTerrainCells,
    transform
  } = renderView;

  if (fogEditingActive && featureVisibilityMode === "gm") {
    drawHiddenCellOverlay(context, hiddenCells, transform, fogOverlayOpacity);
  }

  if (hoverRiverEdge) {
    drawHoveredRiverEdge(context, hoverRiverEdge, transform);
  }

  if (highlightedHex) {
    const highlightedKey = hexKey(highlightedHex);
    const highlightedCell = visibleTerrainCells.find((cell) => cell.key === highlightedKey);

    if (highlightedCell) {
      strokePolygon(context, highlightedCell.corners, "#000000", transform.scaleMapLength(2));
    }
  }
}
