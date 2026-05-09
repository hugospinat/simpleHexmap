import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import type { Axial } from "@/core/geometry/hex";
import type { NoteDraft } from "@/editor/hooks/useNoteControls";
import { MarkdownCodeEditor } from "./MarkdownCodeEditor";

function areDraftsEqual(left: NoteDraft, right: NoteDraft): boolean {
  return (
    left.gmTitle === right.gmTitle &&
    left.playerTitle === right.playerTitle &&
    left.markdown === right.markdown
  );
}

function createEmptyDraft(): NoteDraft {
  return {
    gmTitle: "",
    playerTitle: "",
    markdown: "",
  };
}

type NotePanelProps = {
  note: NoteDraft;
  selectedHex: Axial;
  onClear: () => void;
  onClose: () => void;
  onSave: (selectedHex: Axial, note: NoteDraft) => void;
};

export function NotePanel({
  note,
  selectedHex,
  onClear,
  onClose,
  onSave,
}: NotePanelProps) {
  const [draft, setDraft] = useState(note);
  const autosaveTimerRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const previousNoteRef = useRef(note);
  const previousHexRef = useRef(selectedHex);
  const onSaveRef = useRef(onSave);

  draftRef.current = draft;
  onSaveRef.current = onSave;

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const flushDraftForHex = useCallback(
    (noteHex: Axial, nextDraft: NoteDraft) => {
      clearAutosaveTimer();
      onSaveRef.current(noteHex, nextDraft);
      previousHexRef.current = noteHex;
      previousNoteRef.current = nextDraft;
    },
    [clearAutosaveTimer],
  );

  const flushCurrentDraft = useCallback(() => {
    if (!areDraftsEqual(draftRef.current, previousNoteRef.current)) {
      flushDraftForHex(previousHexRef.current, draftRef.current);
      return;
    }

    clearAutosaveTimer();
  }, [clearAutosaveTimer, flushDraftForHex]);

  useEffect(() => {
    const previousHex = previousHexRef.current;
    const selectionChanged =
      previousHex.q !== selectedHex.q || previousHex.r !== selectedHex.r;

    if (selectionChanged) {
      if (!areDraftsEqual(draftRef.current, previousNoteRef.current)) {
        flushDraftForHex(previousHex, draftRef.current);
      } else {
        clearAutosaveTimer();
      }

      setDraft(note);
      previousHexRef.current = selectedHex;
      previousNoteRef.current = note;
      return;
    }

    const draftMatchesPrevious = areDraftsEqual(
      draftRef.current,
      previousNoteRef.current,
    );
    const draftMatchesIncoming = areDraftsEqual(draftRef.current, note);

    if (draftMatchesPrevious || draftMatchesIncoming) {
      setDraft(note);
    }

    previousNoteRef.current = note;
  }, [
    clearAutosaveTimer,
    flushDraftForHex,
    note.gmTitle,
    note.playerTitle,
    note.markdown,
    selectedHex.q,
    selectedHex.r,
  ]);

  useEffect(() => {
    if (areDraftsEqual(draft, note)) {
      clearAutosaveTimer();
      return;
    }

    clearAutosaveTimer();
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      flushDraftForHex(previousHexRef.current, draftRef.current);
    }, editorConfig.noteAutosaveDebounceMs);

    return clearAutosaveTimer;
  }, [
    clearAutosaveTimer,
    draft.gmTitle,
    draft.playerTitle,
    draft.markdown,
    flushDraftForHex,
    note.gmTitle,
    note.playerTitle,
    note.markdown,
  ]);

  useEffect(() => {
    return () => {
      if (!areDraftsEqual(draftRef.current, previousNoteRef.current)) {
        flushDraftForHex(previousHexRef.current, draftRef.current);
      } else {
        clearAutosaveTimer();
      }
    };
  }, [clearAutosaveTimer, flushDraftForHex]);

  const hasSavedNote =
    note.gmTitle.trim().length > 0 ||
    note.playerTitle.trim().length > 0 ||
    note.markdown.trim().length > 0;
  const hasDraft =
    draft.gmTitle.trim().length > 0 ||
    draft.playerTitle.trim().length > 0 ||
    draft.markdown.trim().length > 0;
  const isDirty = !areDraftsEqual(draft, note);
  const statusLabel = useMemo(() => {
    if (isDirty) {
      return "Autosave pending";
    }

    return hasSavedNote ? "Saved note metadata" : "No note metadata";
  }, [hasSavedNote, isDirty]);

  const handleClose = useCallback(() => {
    flushCurrentDraft();
    onClose();
  }, [flushCurrentDraft, onClose]);

  return (
    <aside className="note-panel" aria-label="Hex note editor">
      <div className="note-panel-header">
        <div>
          <span className="eyebrow">GM NOTE</span>
          <h2>
            Hex {selectedHex.q}, {selectedHex.r}
          </h2>
          <p>{statusLabel}</p>
        </div>
        <button type="button" className="compact-button" onClick={handleClose}>
          Close
        </button>
      </div>

      <label className="note-field">
        <span>GM title</span>
        <input
          className="note-input"
          value={draft.gmTitle}
          onBlur={flushCurrentDraft}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setDraft((current) => ({
              ...current,
              gmTitle: nextValue,
            }));
          }}
          placeholder="Visible to GM on the map"
        />
      </label>

      <label className="note-field">
        <span>Player title</span>
        <input
          className="note-input"
          value={draft.playerTitle}
          onBlur={flushCurrentDraft}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            setDraft((current) => ({
              ...current,
              playerTitle: nextValue,
            }));
          }}
          placeholder="Visible to players when the hex is visible"
        />
      </label>

      <label className="note-field">
        <span>Markdown</span>
        <div className="note-editor">
          <MarkdownCodeEditor
            value={draft.markdown}
            onBlur={flushCurrentDraft}
            onChange={(markdown) =>
              setDraft((current) => ({
                ...current,
                markdown,
              }))
            }
            placeholderText="Write a GM note for this hex..."
          />
        </div>
      </label>

      <p className="note-panel-hint">
        Player title is the only note field intended for player-side map
        rendering. GM title and markdown remain GM-only.
      </p>

      <div className="note-panel-actions">
        <button
          type="button"
          className="compact-button"
          onClick={() => {
            clearAutosaveTimer();
            setDraft(createEmptyDraft());

            if (hasSavedNote) {
              onClear();
            }
          }}
          disabled={!hasSavedNote && !hasDraft && !isDirty}
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
