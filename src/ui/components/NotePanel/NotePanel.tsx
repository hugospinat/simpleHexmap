import { useEffect, useMemo, useState } from "react";
import type { Axial } from "@/core/geometry/hex";

type NotePanelProps = {
  noteMarkdown: string;
  selectedHex: Axial;
  onClear: () => void;
  onClose: () => void;
  onSave: (markdown: string) => void;
};

export function NotePanel({
  noteMarkdown,
  selectedHex,
  onClear,
  onClose,
  onSave,
}: NotePanelProps) {
  const [draft, setDraft] = useState(noteMarkdown);

  useEffect(() => {
    setDraft(noteMarkdown);
  }, [noteMarkdown, selectedHex]);

  const hasSavedNote = noteMarkdown.trim().length > 0;
  const hasDraft = draft.trim().length > 0;
  const isDirty = draft !== noteMarkdown;
  const statusLabel = useMemo(
    () => (hasSavedNote ? "Note enregistrée" : "Aucune note"),
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
        <span>Markdown</span>
        <textarea
          className="note-textarea"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          placeholder="Write a GM note for this hex..."
          spellCheck={false}
        />
      </label>

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
          onClick={onClear}
          disabled={!hasSavedNote && !hasDraft}
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
