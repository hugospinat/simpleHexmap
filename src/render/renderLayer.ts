import type { MapRenderFrame } from "@/render/mapRenderFrame";
import type { RenderStats } from "@/render/renderTypes";

export type RenderLayerContext = {
  context: CanvasRenderingContext2D;
  frame: MapRenderFrame;
};

export type RenderLayerResult = Partial<RenderStats>;

export type RenderLayer = (layerContext: RenderLayerContext) => RenderLayerResult;
