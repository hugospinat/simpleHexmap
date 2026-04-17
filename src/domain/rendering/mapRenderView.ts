import type { Axial } from "@/domain/geometry/hex";
import type { FeatureVisibilityMode } from "@/domain/world/features";
import type { RiverEdgeRef, World } from "@/domain/world/world";
import { buildWorldView } from "@/domain/world/worldView";
import { createMapRenderTransform, type MapRenderTransform } from "@/domain/rendering/mapTransform";
import type { VisibleCell, Viewport } from "@/domain/rendering/renderTypes";
import { collectVisibleCells } from "@/domain/rendering/visibleCells";

export type MapRenderView = ReturnType<typeof buildWorldView> & {
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

type CreateMapRenderViewOptions = {
  center: Axial;
  featureVisibilityMode: FeatureVisibilityMode;
  highlightedHex: Axial | null;
  hoverRiverEdge: RiverEdgeRef | null;
  level: number;
  viewport: Viewport;
  visualZoom: number;
  world: World;
};

export function createMapRenderView({
  center,
  featureVisibilityMode,
  highlightedHex,
  hoverRiverEdge,
  level,
  viewport,
  visualZoom,
  world
}: CreateMapRenderViewOptions): MapRenderView {
  const worldView = buildWorldView(world, level);
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
