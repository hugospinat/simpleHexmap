import { TextStyle, type Container, type Text } from "pixi.js";
import { hexKey } from "@/core/geometry/hex";
import { getLevelRotation } from "@/core/geometry/hex";
import { scaleWorldLength } from "./pixiLayers";
import type {
  MapNoteRenderable,
  PixiObjectPools,
  PixiSceneRenderFrame,
} from "./pixiTypes";

const noteLabelStyle = new TextStyle({
  align: "center",
  fill: "#2f2418",
  fontFamily: "Georgia, Times New Roman, serif",
  fontSize: 12,
  fontStyle: "italic",
  stroke: {
    color: "#f7f0de",
    width: 3,
  },
  wordWrap: true,
});

function updateNoteLabel(text: Text, label: string, maxWidth: number): void {
  if (text.text !== label) {
    text.text = label;
  }

  if (text.style !== noteLabelStyle) {
    text.style = noteLabelStyle;
  }

  text.style.wordWrapWidth = maxWidth;
  text.anchor.set(0.5);
}

export function drawPixiNoteLayer(
  frame: PixiSceneRenderFrame,
  pools: PixiObjectPools,
  parent: Container,
  noteLabels: readonly MapNoteRenderable[],
): number {
  const visibleKeys = new Set<string>();

  if (frame.transform.scaleMapLength(32) <= 18 || noteLabels.length === 0) {
    pools.noteTexts.releaseUnused(visibleKeys);
    return 0;
  }

  const cellsByKey = new Map(
    frame.visibleTerrainCells.map((cell) => [cell.key, cell] as const),
  );
  const rotation = getLevelRotation(frame.transform.level);
  const labelScale = scaleWorldLength(frame, 1);

  for (const note of noteLabels) {
    const cell = cellsByKey.get(hexKey(note));

    if (!cell) {
      continue;
    }

    const key = `note:${cell.key}`;
    visibleKeys.add(key);
    const text = pools.noteTexts.acquire(key, parent);
    updateNoteLabel(text, note.text, cell.boundsWidth * 1.1);
    text.position.set(
      cell.worldCenter.x,
      cell.worldCenter.y - cell.boundsHeight * 0.28,
    );
    text.rotation = rotation;
    text.scale.set(labelScale);
    text.alpha = 0.95;
  }

  pools.noteTexts.releaseUnused(visibleKeys);
  return visibleKeys.size;
}