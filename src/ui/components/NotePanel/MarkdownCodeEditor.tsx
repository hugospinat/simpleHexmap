import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";

type MarkdownCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholderText: string;
};

export function MarkdownCodeEditor({
  value,
  onChange,
  onBlur,
  placeholderText,
}: MarkdownCodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const isApplyingExternalValueRef = useRef(false);

  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;

  useEffect(() => {
    if (!hostRef.current || editorViewRef.current) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          placeholder(placeholderText),
          EditorView.domEventHandlers({
            blur: () => {
              onBlurRef.current?.();
              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || isApplyingExternalValueRef.current) {
              return;
            }

            onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
      parent: hostRef.current,
    });

    editorViewRef.current = view;

    return () => {
      editorViewRef.current = null;
      view.destroy();
    };
  }, [placeholderText]);

  useEffect(() => {
    const view = editorViewRef.current;

    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();

    if (currentValue === value) {
      return;
    }

    isApplyingExternalValueRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
    isApplyingExternalValueRef.current = false;
  }, [value]);

  return <div ref={hostRef} className="note-editor-host" />;
}