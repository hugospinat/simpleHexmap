export const MIN_VISUAL_ZOOM = 0.12;
export const MAX_VISUAL_ZOOM = 40;

export const editorConfig = {
  boundaryLineAlpha: 0.55,
  boundaryLineColor: "#c8c8c8",
  boundaryLineDashCurrent: [3, 3],
  boundaryLineWidth: 0.85,
  keyboardPanPixelsPerSecond: 520,
  maxLevels: 3,
  performanceDebugLogs: false,
  renderViewportMarginCells: 3,
  visualZoomMax: MAX_VISUAL_ZOOM,
  visualZoomMin: MIN_VISUAL_ZOOM
} as const;
