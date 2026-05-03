import { useCallback, useEffect, useMemo } from "react";
import { hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import type { MapState } from "@/core/map/world";
import type { MapDocument, MapOperation } from "@/core/protocol";

type UseNoteControlsOptions = {
  activeNoteHex: Axial | null;
  setActiveNoteHex: (axial: Axial | null) => void;
  submitLocalOperations: (operations: MapOperation[]) => void;
  visibleDocument: MapDocument;
  visibleWorld: MapState;
};

export function useNoteControls({
  activeNoteHex,
  setActiveNoteHex,
  submitLocalOperations,
  visibleDocument,
  visibleWorld,
}: UseNoteControlsOptions) {
  useEffect(() => {
    if (
      activeNoteHex &&
      !(visibleWorld.levels[SOURCE_LEVEL] ?? new Map()).has(hexKey(activeNoteHex))
    ) {
      setActiveNoteHex(null);
    }
  }, [activeNoteHex, setActiveNoteHex, visibleWorld]);

  const selectedNoteMarkdown = useMemo(() => {
    if (!activeNoteHex) {
      return "";
    }

    return (
      visibleDocument.notes.find(
        (note) => note.q === activeNoteHex.q && note.r === activeNoteHex.r,
      )?.markdown ?? ""
    );
  }, [activeNoteHex, visibleDocument.notes]);

  const saveSelectedNote = useCallback(
    (markdown: string) => {
      if (!activeNoteHex) {
        return;
      }

      const nextMarkdown = markdown.trim() ? markdown : null;
      const currentMarkdown =
        visibleDocument.notes.find(
          (note) => note.q === activeNoteHex.q && note.r === activeNoteHex.r,
        )?.markdown ?? null;

      if (currentMarkdown === nextMarkdown) {
        return;
      }

      submitLocalOperations([
        {
          type: "set_note",
          note: {
            q: activeNoteHex.q,
            r: activeNoteHex.r,
            markdown: nextMarkdown,
          },
        },
      ]);
    },
    [activeNoteHex, submitLocalOperations, visibleDocument.notes],
  );

  const clearSelectedNote = useCallback(() => {
    if (!activeNoteHex || !selectedNoteMarkdown) {
      return;
    }

    submitLocalOperations([
      {
        type: "set_note",
        note: {
          q: activeNoteHex.q,
          r: activeNoteHex.r,
          markdown: null,
        },
      },
    ]);
  }, [activeNoteHex, selectedNoteMarkdown, submitLocalOperations]);

  return {
    clearSelectedNote,
    closeSelectedNote: () => setActiveNoteHex(null),
    saveSelectedNote,
    selectedNoteHex: activeNoteHex,
    selectedNoteMarkdown,
    setSelectedNoteHex: setActiveNoteHex,
  };
}
