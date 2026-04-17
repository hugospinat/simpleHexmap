import type { MapRenderView } from "@/domain/rendering/mapRenderView";
import type { RenderStats } from "@/domain/rendering/renderTypes";

export type RenderLayerContext = {
  context: CanvasRenderingContext2D;
  renderView: MapRenderView;
};

export type RenderLayerResult = Partial<RenderStats>;

export type RenderLayer = (layerContext: RenderLayerContext) => RenderLayerResult;
