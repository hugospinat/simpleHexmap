import { useCallback, useEffect, useMemo } from "react";
import { hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import type { MapState } from "@/core/map/world";
import type { MapDocument, MapOperation } from "@/core/protocol";

export type NoteDraft = {
  gmTitle: string;
  playerTitle: string;
  markdown: string;
};

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
  const sourceLevel = visibleWorld.levels[SOURCE_LEVEL] ?? new Map();

  useEffect(() => {
    if (activeNoteHex && !sourceLevel.has(hexKey(activeNoteHex))) {
      setActiveNoteHex(null);
    }
  }, [activeNoteHex, setActiveNoteHex, sourceLevel]);

  const selectedNote = useMemo<NoteDraft>(() => {
    if (!activeNoteHex) {
      return { gmTitle: "", playerTitle: "", markdown: "" };
    }

    const note = visibleDocument.notes.find(
      (candidate) => candidate.q === activeNoteHex.q && candidate.r === activeNoteHex.r,
    );

    return {
      gmTitle: note?.gmTitle ?? "",
      playerTitle: note?.playerTitle ?? "",
      markdown: note?.markdown ?? "",
    };
  }, [activeNoteHex, visibleDocument.notes]);

  const saveNoteAtHex = useCallback(
    (noteHex: Axial, noteDraft: NoteDraft) => {
      const nextGmTitle = noteDraft.gmTitle.trim() ? noteDraft.gmTitle.trim() : null;
      const nextPlayerTitle = noteDraft.playerTitle.trim()
        ? noteDraft.playerTitle.trim()
        : null;
      const nextMarkdown = noteDraft.markdown.trim() ? noteDraft.markdown : null;
      const currentNote = visibleDocument.notes.find(
        (note) => note.q === noteHex.q && note.r === noteHex.r,
      );

      if (
        (currentNote?.gmTitle ?? null) === nextGmTitle &&
        (currentNote?.playerTitle ?? null) === nextPlayerTitle &&
        (currentNote?.markdown ?? null) === nextMarkdown
      ) {
        return;
      }

      submitLocalOperations([
        {
          type: "set_note",
          note: {
            q: noteHex.q,
            r: noteHex.r,
            gmTitle: nextGmTitle,
            playerTitle: nextPlayerTitle,
            markdown: nextMarkdown,
          },
        },
      ]);
    },
    [submitLocalOperations, visibleDocument.notes],
  );

  const saveSelectedNote = useCallback(
    (noteDraft: NoteDraft) => {
      if (!activeNoteHex) {
        return;
      }

      saveNoteAtHex(activeNoteHex, noteDraft);
    },
    [activeNoteHex, saveNoteAtHex],
  );

  const clearSelectedNote = useCallback(() => {
    if (
      !activeNoteHex ||
      (!selectedNote.gmTitle &&
        !selectedNote.playerTitle &&
        !selectedNote.markdown)
    ) {
      return;
    }

    submitLocalOperations([
      {
        type: "set_note",
        note: {
          q: activeNoteHex.q,
          r: activeNoteHex.r,
          gmTitle: null,
          playerTitle: null,
          markdown: null,
        },
      },
    ]);
  }, [activeNoteHex, selectedNote, submitLocalOperations]);

  return {
    clearSelectedNote,
    closeSelectedNote: () => setActiveNoteHex(null),
    saveNoteAtHex,
    saveSelectedNote,
    selectedNoteHex: activeNoteHex,
    selectedNote,
    setSelectedNoteHex: setActiveNoteHex,
  };
}
