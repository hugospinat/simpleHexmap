export const editorModeOrder = ["terrain", "feature", "river", "road", "faction", "fog"] as const;

export type EditorMode = (typeof editorModeOrder)[number];
