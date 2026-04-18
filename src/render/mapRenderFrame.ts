import type { Axial, Pixel } from "@/core/geometry/hex";
import {
  axialToWorldPixel,
  HEX_BASE_SIZE,
  getLevelRotation,
  getLevelScale
} from "@/core/geometry/hex";
import {
  canFeatureOverrideTerrain,
  getFeatureAsset,
  getFeatureTerrainOverrideAsset
} from "@/assets/featureAssets";
import type { FeatureVisibilityMode } from "@/core/map/features";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import { getTerrainAsset } from "@/assets/terrainAssets";
import { buildMapLevelView } from "@/core/map/mapLevelView";
import { createMapRenderTransform, type MapRenderTransform } from "@/render/mapTransform";
import { getLoadedImage } from "@/render/assetImages";
import type { RenderCell, VisibleCell, Viewport } from "@/render/renderTypes";
import { collectVisibleCells } from "@/render/visibleCells";

export type MapRenderFrame = ReturnType<typeof buildMapLevelView> & {
  cameraWorldCenter: Pixel;
  featureVisibleKeys: ReadonlySet<string>;
  hiddenCells: RenderCell[];
  highlightedHex: Axial | null;
  hoverRiverEdge: RiverEdgeRef | null;
  transform: MapRenderTransform;
  renderCells: RenderCell[];
  visibleCells: VisibleCell[];
  visibleKeys: ReadonlySet<string>;
  visibleTerrainCells: RenderCell[];
  visibleTerrainKeys: ReadonlySet<string>;
};

type CreateMapRenderFrameOptions = {
  center: Axial;
  featureVisibilityMode: FeatureVisibilityMode;
  highlightedHex: Axial | null;
  hoverRiverEdge: RiverEdgeRef | null;
  includeCanvasImages?: boolean;
  includeScreenGeometry?: boolean;
  level: number;
  viewport: Viewport;
  visualZoom: number;
  world: MapState;
};

export function createMapRenderFrame({
  center,
  featureVisibilityMode,
  highlightedHex,
  hoverRiverEdge,
  includeCanvasImages = true,
  includeScreenGeometry = true,
  level,
  viewport,
  visualZoom,
  world
}: CreateMapRenderFrameOptions): MapRenderFrame {
  const worldView = buildMapLevelView(world, level);
  const transform = createMapRenderTransform(center, level, visualZoom, viewport);
  const visible = collectVisibleCells(worldView.levelMap, center, level, visualZoom, viewport);
  const worldRotation = getLevelRotation(level);
  const worldRadius = HEX_BASE_SIZE * getLevelScale(level);
  const cameraWorldCenter = axialToWorldPixel(center, level);
  const renderCells = visible.cells.map<RenderCell>((visibleCell) => {
    const feature = worldView.featuresByHex.get(visibleCell.key) ?? null;
    const terrainAsset = includeCanvasImages ? getTerrainAsset(visibleCell.cell.type) : undefined;
    const featureAsset = includeCanvasImages && feature ? getFeatureAsset(feature.kind) : undefined;
    const featureOverrideAsset = includeCanvasImages && feature && canFeatureOverrideTerrain(feature.kind)
      ? getFeatureTerrainOverrideAsset(feature.kind)
      : undefined;
    const worldCenter = axialToWorldPixel(visibleCell.axial, level);
    const worldCorners: Pixel[] = [];
    let minWorldX = Number.POSITIVE_INFINITY;
    let maxWorldX = Number.NEGATIVE_INFINITY;
    let minWorldY = Number.POSITIVE_INFINITY;
    let maxWorldY = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < 6; index += 1) {
      const angle = worldRotation + Math.PI / 6 + (Math.PI / 3) * index;
      const point = {
        x: worldCenter.x + worldRadius * Math.cos(angle),
        y: worldCenter.y + worldRadius * Math.sin(angle)
      };

      worldCorners.push(point);
      minWorldX = Math.min(minWorldX, point.x);
      maxWorldX = Math.max(maxWorldX, point.x);
      minWorldY = Math.min(minWorldY, point.y);
      maxWorldY = Math.max(maxWorldY, point.y);
    }

    const center = includeScreenGeometry ? transform.axialToScreen(visibleCell.axial) : worldCenter;
    const corners = includeScreenGeometry ? transform.hexCorners(visibleCell.axial) : worldCorners;
    const boundsWidth = maxWorldX - minWorldX;
    const boundsHeight = maxWorldY - minWorldY;

    return {
      ...visibleCell,
      boundsHeight,
      boundsWidth,
      center,
      corners,
      factionColor: worldView.factionOverlayColorMap.get(visibleCell.key) ?? null,
      feature,
      featureImage: featureAsset ? getLoadedImage(featureAsset.src) : null,
      featureTerrainOverrideImage: featureOverrideAsset ? getLoadedImage(featureOverrideAsset.src) : null,
      riverEdges: worldView.riverLevelMap.get(visibleCell.key) ?? new Set(),
      roadEdges: worldView.roadLevelMap.get(visibleCell.key) ?? new Set(),
      terrainImage: terrainAsset ? getLoadedImage(terrainAsset.src) : null,
      worldCenter,
      worldCorners
    };
  });
  const hiddenCells = renderCells.filter(({ cell }) => cell.hidden);
  const visibleTerrainCells = featureVisibilityMode === "player"
    ? renderCells.filter(({ cell }) => !cell.hidden)
    : renderCells;
  const visibleTerrainKeys = new Set(visibleTerrainCells.map((cell) => cell.key));

  return {
    ...worldView,
    cameraWorldCenter,
    featureVisibleKeys: featureVisibilityMode === "player" ? visibleTerrainKeys : visible.keys,
    hiddenCells,
    highlightedHex,
    hoverRiverEdge,
    renderCells,
    transform,
    visibleCells: visible.cells,
    visibleKeys: visible.keys,
    visibleTerrainCells,
    visibleTerrainKeys
  };
}
