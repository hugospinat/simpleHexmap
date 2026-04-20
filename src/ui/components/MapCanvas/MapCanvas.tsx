import { useEffect, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { hexKey } from "@/core/geometry/hex";
import { useCanvasViewport } from "@/editor/hooks/useCanvasViewport";
import { useCanvasWheelZoom } from "@/editor/hooks/useCanvasWheelZoom";
import { useMapInteraction } from "@/editor/hooks/useMapInteraction";
import { createPixiMapRenderer, type PixiMapRenderer } from "@/render/pixi/pixiMapRenderer";
import type { MapInteractionOverlay, PixiRenderStats } from "@/render/pixi/pixiTypes";
import type { MapCanvasProps } from "@/ui/components/MapCanvas/types";
import type { MapLevel } from "@/core/map/mapRules";

function isMapRenderDebugEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  try {
    return window.localStorage.getItem("hexmap:sync-debug") === "1";
  } catch {
    return false;
  }
}

export default function MapCanvas({
  world,
  renderWorldPatch,
  previewOperations,
  mapTokens,
  activeTokenProfileId,
  canEdit,
  playerMode,
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
  onHoveredHexChange,
  onGmTokenPlace,
  onGmTokenRemove,
  onPlayerTokenPlace,
  onToolStep,
  onRenderWorldPatchApplied
}: MapCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PixiMapRenderer | null>(null);
  const worldRenderFrameRef = useRef<number | null>(null);
  const cameraRenderFrameRef = useRef<number | null>(null);
  const overlayRenderFrameRef = useRef<number | null>(null);
  const previewRenderFrameRef = useRef<number | null>(null);
  const previewOperationsRef = useRef(previewOperations);
  const renderDebugBatchRef = useRef({ frames: 0, lastLogAt: 0 });
  const lastPerformanceLogAtRef = useRef(0);
  const sourceTileCountRef = useRef(0);
  const [rendererReady, setRendererReady] = useState(false);
  const viewport = useCanvasViewport(overlayCanvasRef);
  const pixiLevel = level as MapLevel;
  sourceTileCountRef.current = world.levels[3]?.size ?? 0;
  previewOperationsRef.current = previewOperations;

  useCanvasWheelZoom(overlayCanvasRef, visualZoom, onVisualZoomChange, onToolStep);

  const { handlers, hoverRiverEdge } = useMapInteraction({
    activeTokenProfileId,
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
    onGmTokenPlace,
    onGmTokenRemove,
    onPlayerTokenPlace,
    mapTokens,
    playerMode,
    viewport,
    visualZoom,
    world
  });

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    let cancelled = false;
    const renderer = createPixiMapRenderer();
    rendererRef.current = renderer;

    renderer.mount(stage).then(() => {
      if (cancelled) {
        return;
      }

      setRendererReady(true);
    });

    return () => {
      cancelled = true;
      setRendererReady(false);
      renderer.destroy();
      if (rendererRef.current === renderer) {
        rendererRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !rendererReady) {
      return;
    }

    renderer.resize(viewport.width, viewport.height, window.devicePixelRatio || 1);
  }, [rendererReady, viewport]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !rendererReady) {
      return;
    }

    if (worldRenderFrameRef.current !== null) {
      cancelAnimationFrame(worldRenderFrameRef.current);
    }

    worldRenderFrameRef.current = requestAnimationFrame(() => {
      worldRenderFrameRef.current = null;
      renderer.setWorld(world, renderWorldPatch);

      const activePreviewOperations = previewOperationsRef.current;

      if (activePreviewOperations.length === 0) {
        renderer.clearPreview();
      } else {
        renderer.setPreviewOperations(activePreviewOperations);
      }

      if (renderWorldPatch) {
        onRenderWorldPatchApplied?.(renderWorldPatch.revision);
      }
    });

    return () => {
      if (worldRenderFrameRef.current !== null) {
        cancelAnimationFrame(worldRenderFrameRef.current);
        worldRenderFrameRef.current = null;
      }
    };
  }, [
    rendererReady,
    renderWorldPatch,
    onRenderWorldPatchApplied,
    world
  ]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !rendererReady) {
      return;
    }

    if (previewRenderFrameRef.current !== null) {
      cancelAnimationFrame(previewRenderFrameRef.current);
    }

    previewRenderFrameRef.current = requestAnimationFrame(() => {
      previewRenderFrameRef.current = null;

      if (previewOperations.length === 0) {
        renderer.clearPreview();
      } else {
        renderer.setPreviewOperations(previewOperations);
      }
    });

    return () => {
      if (previewRenderFrameRef.current !== null) {
        cancelAnimationFrame(previewRenderFrameRef.current);
        previewRenderFrameRef.current = null;
      }
    };
  }, [
    previewOperations,
    rendererReady
  ]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !rendererReady) {
      return;
    }

    renderer.setTokens(mapTokens);
  }, [mapTokens, rendererReady]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !rendererReady) {
      return;
    }

    if (cameraRenderFrameRef.current !== null) {
      cancelAnimationFrame(cameraRenderFrameRef.current);
    }

    cameraRenderFrameRef.current = requestAnimationFrame(() => {
      cameraRenderFrameRef.current = null;
      const frameStart = performance.now();
      const stats: PixiRenderStats = renderer.setCamera({
        center,
        featureVisibilityMode,
        fogEditingActive,
        level: pixiLevel,
        showCoordinates,
        viewport,
        visualZoom
      });
      const frameDurationMs = performance.now() - frameStart;

      if (isMapRenderDebugEnabled()) {
        const now = performance.now();
        const batch = renderDebugBatchRef.current;
        batch.frames += 1;

        if (now - batch.lastLogAt >= 500) {
          console.info("[MapRender] pixi_base_frame_batch", {
            editMode,
            featureVisibilityMode,
            fogEditingActive,
            frames: batch.frames,
            activeWindowMs: stats.activeWindowMs,
            cameraMs: stats.cameraMs,
            fogCacheHit: stats.fogCacheHit,
            fogCells: stats.fogCells,
            layerTimings: stats.layerTimings,
            layerPatchMs: stats.layerPatchMs,
            frameTimeMs: Number(frameDurationMs.toFixed(2)),
            level,
            pixiUpdateMs: stats.pixiUpdateMs,
            sceneUpdateMs: stats.sceneUpdateMs,
            sourceTileCount: sourceTileCountRef.current,
            spriteCount: stats.spriteCount,
            visibleCellCount: stats.visibleCellCount,
            visualZoom: Number(visualZoom.toFixed(2)),
            viewport
          });

          batch.frames = 0;
          batch.lastLogAt = now;
        }
      }

      if (!editorConfig.performanceDebugLogs) {
        return;
      }

      const now = performance.now();

      if (now - lastPerformanceLogAtRef.current <= 250) {
        return;
      }

      lastPerformanceLogAtRef.current = now;
      console.debug("[hexmap] pixi_base_frame", {
        frameTimeMs: Number(frameDurationMs.toFixed(2)),
        level,
        zoom: Number(visualZoom.toFixed(2)),
        ...stats
      });
    });

    return () => {
      if (cameraRenderFrameRef.current !== null) {
        cancelAnimationFrame(cameraRenderFrameRef.current);
        cameraRenderFrameRef.current = null;
      }
    };
  }, [
    center,
    editMode,
    featureVisibilityMode,
    fogEditingActive,
    level,
    pixiLevel,
    rendererReady,
    showCoordinates,
    viewport,
    visualZoom,
  ]);

  useEffect(() => {
    const renderer = rendererRef.current;

    if (!renderer || !rendererReady) {
      return;
    }

    if (overlayRenderFrameRef.current !== null) {
      cancelAnimationFrame(overlayRenderFrameRef.current);
    }

    overlayRenderFrameRef.current = requestAnimationFrame(() => {
      overlayRenderFrameRef.current = null;
      const highlightedHex = !canEdit || editMode === "river" || !hoveredHex ? null : hoveredHex;
      const overlay: MapInteractionOverlay = {
        brushCells: [],
        cursorMode: editMode,
        highlightedHex: highlightedHex ? hexKey(highlightedHex) : null,
        hoverRiverEdge,
        previewCells: [],
        selectedHexes: []
      };

      renderer.setOverlay(overlay);
    });

    return () => {
      if (overlayRenderFrameRef.current !== null) {
        cancelAnimationFrame(overlayRenderFrameRef.current);
        overlayRenderFrameRef.current = null;
      }
    };
  }, [
    canEdit,
    editMode,
    hoverRiverEdge,
    hoveredHex,
    level,
    rendererReady
  ]);

  return (
    <>
      <div ref={stageRef} className="pixi-hex-stage" aria-hidden="true" />
      <canvas
        ref={overlayCanvasRef}
        className="hex-canvas hex-canvas-overlay pixi-hex-input"
        tabIndex={0}
        aria-label={`Level ${level} hex map canvas. ${interactionLabel}`}
        {...handlers}
      />
    </>
  );
}
