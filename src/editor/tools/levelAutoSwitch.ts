import { LEVEL_ZOOM_THRESHOLDS } from "@/config/editorConfig";

export type LevelZoomThresholds = {
  level1Max: number;
  level2Max: number;
};

export function getLevelFromZoom(
  zoom: number,
  thresholds: LevelZoomThresholds = LEVEL_ZOOM_THRESHOLDS
): number {
  if (zoom < thresholds.level1Max) {
    return 1;
  }

  if (zoom < thresholds.level2Max) {
    return 2;
  }

  return 3;
}
