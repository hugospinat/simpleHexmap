import { useEffect, useRef, type RefObject } from "react";
import { editorConfig } from "@/config/editorConfig";
import { useLatestRef } from "./useLatestRef";

export function useCanvasWheelZoom(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  visualZoom: number,
  onVisualZoomChange: (zoom: number) => void
) {
  const zoomRef = useLatestRef(visualZoom);
  const onVisualZoomChangeRef = useLatestRef(onVisualZoomChange);
  const pendingZoomRef = useRef<number | null>(null);
  const zoomFrameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const handleWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const baseZoom = pendingZoomRef.current ?? zoomRef.current;
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      const nextZoom = Math.min(
        editorConfig.visualZoomMax,
        Math.max(editorConfig.visualZoomMin, baseZoom * zoomFactor)
      );
      pendingZoomRef.current = nextZoom;

      if (zoomFrameRef.current) {
        return;
      }

      zoomFrameRef.current = requestAnimationFrame(() => {
        zoomFrameRef.current = 0;

        if (pendingZoomRef.current === null) {
          return;
        }

        const zoomValue = pendingZoomRef.current;
        pendingZoomRef.current = null;
        zoomRef.current = zoomValue;
        onVisualZoomChangeRef.current(zoomValue);
      });
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("contextmenu", handleContextMenu);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("contextmenu", handleContextMenu);

      if (zoomFrameRef.current) {
        cancelAnimationFrame(zoomFrameRef.current);
        zoomFrameRef.current = 0;
      }
    };
  }, [canvasRef, onVisualZoomChangeRef, zoomRef]);
}
