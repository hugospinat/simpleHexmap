import type { Axial } from "@/core/geometry/hex";
import type { FeatureVisibilityMode } from "@/core/map/features";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import { buildMapLevelView } from "@/core/map/mapLevelView";
import { createMapRenderTransform, type MapRenderTransform } from "@/render/mapTransform";
import type { VisibleCell, Viewport } from "@/render/renderTypes";
import { collectVisibleCells } from "@/render/visibleCells";

export type MapRenderFrame = ReturnType<typeof buildMapLevelView> & {
  featureVisibleKeys: ReadonlySet<string>;
  hiddenCells: VisibleCell[];
  highlightedHex: Axial | null;
  hoverRiverEdge: RiverEdgeRef | null;
  transform: MapRenderTransform;
  visibleCells: VisibleCell[];
  visibleKeys: ReadonlySet<string>;
  visibleTerrainCells: VisibleCell[];
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
  const hiddenCells = visible.cells.filter(({ cell }) => cell.hidden);
  const visibleTerrainCells = featureVisibilityMode === "player"
    ? visible.cells.filter(({ cell }) => !cell.hidden)
    : visible.cells;
  const visibleTerrainKeys = new Set(visibleTerrainCells.map((cell) => cell.key));

  return {
    ...worldView,
    featureVisibleKeys: featureVisibilityMode === "player" ? visibleTerrainKeys : visible.keys,
    hiddenCells,
    highlightedHex,
    hoverRiverEdge,
    transform,
    visibleCells: visible.cells,
    visibleKeys: visible.keys,
    visibleTerrainCells,
    visibleTerrainKeys
  };
}
