import type { RenderStats } from "@/render/renderTypes";

export type RenderTimingStats = {
  buildFrameMs: number;
  drawMs: number;
  layers?: Record<string, number>;
  totalMs: number;
};

export type TimedRenderStats = RenderStats & {
  timings: RenderTimingStats;
};

export function nowForRenderTiming(): number {
  return performance.now();
}

export function withRenderTimings(
  stats: RenderStats,
  frameStartMs: number,
  buildFrameEndMs: number,
  drawEndMs: number,
  layerTimings?: Record<string, number>
): TimedRenderStats {
  return {
    ...stats,
    timings: {
      buildFrameMs: Number((buildFrameEndMs - frameStartMs).toFixed(2)),
      drawMs: Number((drawEndMs - buildFrameEndMs).toFixed(2)),
      ...(layerTimings ? { layers: layerTimings } : {}),
      totalMs: Number((drawEndMs - frameStartMs).toFixed(2))
    }
  };
}
