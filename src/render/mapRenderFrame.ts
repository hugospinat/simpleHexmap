import type { Axial } from "@/core/geometry/hex";
import type { FeatureVisibilityMode } from "@/core/map/features";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import { buildMapLevelView } from "@/core/map/mapLevelView";
import { createMapRenderTransform, type MapRenderTransform } from "@/render/mapTransform";
import type { RenderCell, VisibleCell, Viewport } from "@/render/renderTypes";
import { collectVisibleCells } from "@/render/visibleCells";

export type MapRenderFrame = ReturnType<typeof buildMapLevelView> & {
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
  level,
  viewport,
  visualZoom,
  world
}: CreateMapRenderFrameOptions): MapRenderFrame {
  const worldView = buildMapLevelView(world, level);
  const transform = createMapRenderTransform(center, level, visualZoom, viewport);
  const visible = collectVisibleCells(worldView.levelMap, center, level, visualZoom, viewport);
  const renderCells = visible.cells.map<RenderCell>((visibleCell) => ({
    ...visibleCell,
    center: transform.axialToScreen(visibleCell.axial),
    corners: transform.hexCorners(visibleCell.axial),
    factionColor: worldView.factionOverlayColorMap.get(visibleCell.key) ?? null,
    feature: worldView.featuresByHex.get(visibleCell.key) ?? null,
    riverEdges: worldView.riverLevelMap.get(visibleCell.key) ?? new Set(),
    roadEdges: worldView.roadLevelMap.get(visibleCell.key) ?? new Set()
  }));
  const hiddenCells = renderCells.filter(({ cell }) => cell.hidden);
  const visibleTerrainCells = featureVisibilityMode === "player"
    ? renderCells.filter(({ cell }) => !cell.hidden)
    : renderCells;
  const visibleTerrainKeys = new Set(visibleTerrainCells.map((cell) => cell.key));

  return {
    ...worldView,
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
