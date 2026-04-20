export const editorModeOrder = [
  "terrain",
  "feature",
  "river",
  "road",
  "faction",
  "fog",
  "token",
] as const;

export type EditorMode = (typeof editorModeOrder)[number];
