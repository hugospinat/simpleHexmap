import { useEffect, useMemo, useState } from "react";
import type { Axial } from "@/core/geometry/hex";
import { MarkdownCodeEditor } from "./MarkdownCodeEditor";

type NotePanelDraft = {
  gmTitle: string;
  playerTitle: string;
  markdown: string;
};

type NotePanelProps = {
  note: NotePanelDraft;
  selectedHex: Axial;
  onClear: () => void;
  onClose: () => void;
  onSave: (note: NotePanelDraft) => void;
};

export function NotePanel({
  note,
  selectedHex,
  onClear,
  onClose,
  onSave,
}: NotePanelProps) {
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    setDraft(note);
  }, [
    note.gmTitle,
    note.playerTitle,
    note.markdown,
    selectedHex.q,
    selectedHex.r,
  ]);

  const hasSavedNote =
    note.gmTitle.trim().length > 0 ||
    note.playerTitle.trim().length > 0 ||
    note.markdown.trim().length > 0;
  const hasDraft =
    draft.gmTitle.trim().length > 0 ||
    draft.playerTitle.trim().length > 0 ||
    draft.markdown.trim().length > 0;
  const isDirty =
    draft.gmTitle !== note.gmTitle ||
    draft.playerTitle !== note.playerTitle ||
    draft.markdown !== note.markdown;
  const statusLabel = useMemo(
    () => (hasSavedNote ? "Saved note metadata" : "No note metadata"),
    [hasSavedNote],
  );

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
        <button type="button" className="compact-button" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="note-field">
        <span>GM title</span>
        <input
          className="note-input"
          value={draft.gmTitle}
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
          onClick={() => onSave(draft)}
          disabled={!isDirty}
        >
          Save
        </button>
        <button
          type="button"
          className="compact-button"
          onClick={() => {
            setDraft({ gmTitle: "", playerTitle: "", markdown: "" });
            if (hasSavedNote) {
              onClear();
            }
          }}
          disabled={!hasSavedNote && !hasDraft}
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
