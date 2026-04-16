import { useEffect, useRef } from "react";
import { drawFeaturePreview } from "@/domain/rendering/featureVisuals";
import type { FeatureKind } from "@/domain/world/features";
import { useMapAssetsVersion } from "@/editor/hooks/useMapAssetsVersion";

type FeatureKindPreviewProps = {
  selected: boolean;
  type: FeatureKind;
};

const previewWidth = 78;
const previewHeight = 63;

export function FeatureKindPreview({ selected, type }: FeatureKindPreviewProps) {
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
    drawFeaturePreview(context, type, previewWidth, previewHeight, selected);
  }, [assetVersion, selected, type]);

  return (
    <canvas
      ref={canvasRef}
      className="feature-preview-canvas"
      width={previewWidth}
      height={previewHeight}
      aria-hidden="true"
    />
  );
}
