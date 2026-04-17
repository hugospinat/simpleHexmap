import { useEffect, useState, type RefObject } from "react";
import type { Viewport } from "@/render/renderTypes";

export function useCanvasViewport(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const [viewport, setViewport] = useState<Viewport>({ width: 800, height: 600 });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ width, height });
    });

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);

  return viewport;
}
