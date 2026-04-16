import { useEffect, useRef } from "react";
import { drawTilePreview } from "@/domain/rendering/tileVisuals";
import type { TerrainType } from "@/domain/world/world";
import { useMapAssetsVersion } from "@/editor/hooks/useMapAssetsVersion";

type TerrainTilePreviewProps = {
  selected: boolean;
  type: TerrainType;
};

const previewWidth = 78;
const previewHeight = 63;

export function TerrainTilePreview({ selected, type }: TerrainTilePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const assetVersion = useMapAssetsVersion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(previewWidth * pixelRatio);
    canvas.height = Math.floor(previewHeight * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawTilePreview(context, type, previewWidth, previewHeight, selected);
  }, [assetVersion, selected, type]);

  return (
    <canvas
      ref={canvasRef}
      className="tile-preview-canvas"
      width={previewWidth}
      height={previewHeight}
      aria-hidden="true"
    />
  );
}
