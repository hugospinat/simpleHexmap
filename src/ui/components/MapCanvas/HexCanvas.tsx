import { useEffect, useRef } from "react";
import { editorConfig } from "@/config/editorConfig";
import { renderMapFrame } from "@/domain/rendering/mapRenderer";
import { useCanvasViewport } from "@/editor/hooks/useCanvasViewport";
import { useCanvasWheelZoom } from "@/editor/hooks/useCanvasWheelZoom";
import { useMapAssetsVersion } from "@/editor/hooks/useMapAssetsVersion";
import { useMapInteraction } from "@/editor/hooks/useMapInteraction";
import type { HexCanvasProps } from "@/ui/components/MapCanvas/types";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetVersion = useMapAssetsVersion();
  const lastPerformanceLogAtRef = useRef(0);
  const viewport = useCanvasViewport(canvasRef);

  useCanvasWheelZoom(canvasRef, visualZoom, onVisualZoomChange);

  const { handlers, hoverRiverEdge } = useMapInteraction({
    canEdit,
    canvasRef,
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
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const frameStart = performance.now();
    const stats = renderMapFrame({
      canvas,
      center,
      fogEditingActive,
      featureVisibilityMode,
      hoverRiverEdge,
      highlightedHex: !canEdit || editMode === "river" ? null : hoveredHex,
      level,
      showCoordinates,
      viewport,
      visualZoom,
      world
    });

    if (!stats || !editorConfig.performanceDebugLogs) {
      return;
    }

    const now = performance.now();

    if (now - lastPerformanceLogAtRef.current <= 250) {
      return;
    }

    lastPerformanceLogAtRef.current = now;
    console.debug("[hexmap] frame", {
      frameTimeMs: Number((now - frameStart).toFixed(2)),
      level,
      zoom: Number(visualZoom.toFixed(2)),
      ...stats
    });
  }, [
    assetVersion,
    canEdit,
    fogEditingActive,
    featureVisibilityMode,
    world,
    level,
    center,
    hoveredHex,
    showCoordinates,
    visualZoom,
    viewport,
    editMode,
    hoverRiverEdge
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="hex-canvas"
      tabIndex={0}
      aria-label={`Level ${level} hex map canvas. ${interactionLabel}`}
      {...handlers}
    />
  );
}
