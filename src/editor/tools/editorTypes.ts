export const editorModeOrder = [
  "terrain",
  "feature",
  "river",
  "road",
  "faction",
  "fog",
  "token",
  "notes",
] as const;

export type EditorMode = (typeof editorModeOrder)[number];
