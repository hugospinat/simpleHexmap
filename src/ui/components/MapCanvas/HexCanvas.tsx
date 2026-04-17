import { useEffect, useRef } from "react";
import { editorConfig } from "@/config/editorConfig";
import { getLevelScale } from "@/core/geometry/hex";
import { renderMapBaseFrame, renderMapInteractionFrame } from "@/render/mapRenderer";
import { useCanvasViewport } from "@/editor/hooks/useCanvasViewport";
import { useCanvasWheelZoom } from "@/editor/hooks/useCanvasWheelZoom";
import { useMapAssetsVersion } from "@/editor/hooks/useMapAssetsVersion";
import { useMapInteraction } from "@/editor/hooks/useMapInteraction";
import type { HexCanvasProps } from "@/ui/components/MapCanvas/types";

function isMapSyncDebugEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  try {
    return window.localStorage.getItem("hexmap:sync-debug") === "1";
  } catch {
    return false;
  }
}

function getScreenHexRadius(level: number, visualZoom: number): number {
  return 32 * getLevelScale(level) * visualZoom;
}

export default function HexCanvas({
  world,
  canEdit,
  fogEditingActive,
  level,
  center,
  visualZoom,
  hoveredHex,
  editMode,
  featureVisibilityMode,
  interactionLabel,
  showCoordinates,
  onCenterChange,
  onVisualZoomChange,
  onEditGestureStart,
  onEditGestureMove,
  onRiverGestureStart,
  onRiverGestureMove,
  onEditGestureEnd,
  onRiverGestureEnd,
  onHoveredHexChange
}: HexCanvasProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetVersion = useMapAssetsVersion();
  const lastPerformanceLogAtRef = useRef(0);
  const renderDebugBatchRef = useRef({ frames: 0, lastLogAt: 0 });
  const baseRenderFrameRef = useRef<number | null>(null);
  const overlayRenderFrameRef = useRef<number | null>(null);
  const viewport = useCanvasViewport(overlayCanvasRef);

  useCanvasWheelZoom(overlayCanvasRef, visualZoom, onVisualZoomChange);

  const { handlers, hoverRiverEdge } = useMapInteraction({
    canEdit,
    canvasRef: overlayCanvasRef,
    center,
    editMode,
    level,
    onCenterChange,
    onEditGestureEnd,
    onEditGestureMove,
    onEditGestureStart,
    onRiverGestureEnd,
    onRiverGestureMove,
    onRiverGestureStart,
    onHoveredHexChange,
    viewport,
    visualZoom
  });

  useEffect(() => {
    const canvas = baseCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (baseRenderFrameRef.current !== null) {
      cancelAnimationFrame(baseRenderFrameRef.current);
    }

    baseRenderFrameRef.current = requestAnimationFrame(() => {
      baseRenderFrameRef.current = null;
      const frameStart = performance.now();
      const stats = renderMapBaseFrame({
        canvas,
        center,
        fogEditingActive,
        featureVisibilityMode,
        hoverRiverEdge: null,
        highlightedHex: null,
        level,
        showCoordinates,
        viewport,
        visualZoom,
        world
      });
      const frameDurationMs = performance.now() - frameStart;

      if (isMapSyncDebugEnabled() && frameDurationMs >= 16) {
        const hexRadius = getScreenHexRadius(level, visualZoom);

        console.info("[MapRender] base_frame_slow", {
          frameTimeMs: Number(frameDurationMs.toFixed(2)),
          hexRadius: Number(hexRadius.toFixed(2)),
          level,
          editMode,
          mapScale: Number((hexRadius / 32).toFixed(3)),
          visualZoom: Number(visualZoom.toFixed(2)),
          tileCountLevel3: world.levels[3]?.size ?? 0
        });
      }

      if (isMapSyncDebugEnabled()) {
        const now = performance.now();
        const batch = renderDebugBatchRef.current;
        batch.frames += 1;

        if (now - batch.lastLogAt >= 500) {
          const hexRadius = getScreenHexRadius(level, visualZoom);

          console.info("[MapRender] base_frame_batch", {
            editMode,
            featureVisibilityMode,
            fogEditingActive,
            frames: batch.frames,
            buildFrameMs: stats?.timings.buildFrameMs ?? null,
            drawMs: stats?.timings.drawMs ?? null,
            hexRadius: Number(hexRadius.toFixed(2)),
            layerTimings: stats?.timings.layers ?? null,
            mapScale: Number((hexRadius / 32).toFixed(3)),
            frameTimeMs: Number(frameDurationMs.toFixed(2)),
            level,
            sourceTileCount: world.levels[3]?.size ?? 0,
            visualZoom: Number(visualZoom.toFixed(2)),
            viewport
          });

          batch.frames = 0;
          batch.lastLogAt = now;
        }
      }

      if (!stats || !editorConfig.performanceDebugLogs) {
        return;
      }

      const now = performance.now();

      if (now - lastPerformanceLogAtRef.current <= 250) {
        return;
      }

      lastPerformanceLogAtRef.current = now;
      console.debug("[hexmap] base_frame", {
        frameTimeMs: Number(frameDurationMs.toFixed(2)),
        level,
        zoom: Number(visualZoom.toFixed(2)),
        buildFrameMs: stats.timings.buildFrameMs,
        drawMs: stats.timings.drawMs,
        layerTimings: stats.timings.layers ?? null,
        ...stats
      });
    });

    return () => {
      if (baseRenderFrameRef.current !== null) {
        cancelAnimationFrame(baseRenderFrameRef.current);
        baseRenderFrameRef.current = null;
      }
    };
  }, [
    assetVersion,
    fogEditingActive,
    featureVisibilityMode,
    world,
    level,
    center,
    showCoordinates,
    visualZoom,
    viewport,
    editMode
  ]);

  useEffect(() => {
    const canvas = overlayCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (overlayRenderFrameRef.current !== null) {
      cancelAnimationFrame(overlayRenderFrameRef.current);
    }

    overlayRenderFrameRef.current = requestAnimationFrame(() => {
      overlayRenderFrameRef.current = null;
      renderMapInteractionFrame({
        canvas,
        center,
        fogEditingActive,
        featureVisibilityMode,
        hoverRiverEdge,
        highlightedHex: !canEdit || editMode === "river" ? null : hoveredHex,
        level,
        viewport,
        visualZoom,
        world
      });
    });

    return () => {
      if (overlayRenderFrameRef.current !== null) {
        cancelAnimationFrame(overlayRenderFrameRef.current);
        overlayRenderFrameRef.current = null;
      }
    };
  }, [
    assetVersion,
    canEdit,
    center,
    editMode,
    featureVisibilityMode,
    fogEditingActive,
    hoverRiverEdge,
    hoveredHex,
    level,
    viewport,
    visualZoom,
    world
  ]);

  return (
    <>
      <canvas
        ref={baseCanvasRef}
        className="hex-canvas hex-canvas-base"
        aria-hidden="true"
      />
      <canvas
        ref={overlayCanvasRef}
        className="hex-canvas hex-canvas-overlay"
        tabIndex={0}
        aria-label={`Level ${level} hex map canvas. ${interactionLabel}`}
        {...handlers}
      />
    </>
  );
}

