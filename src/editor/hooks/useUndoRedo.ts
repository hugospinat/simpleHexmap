import { useCallback, useState } from "react";
import { createHistory, recordHistory, redo, undo } from "@/editor/state/history";

export function useUndoRedo<T>(initialState: () => T) {
  const [history, setHistory] = useState(() => createHistory(initialState()));

  const record = useCallback((nextState: T) => {
    setHistory((previous) => recordHistory(previous, nextState));
  }, []);

  const undoHistory = useCallback(() => {
    setHistory(undo);
  }, []);

  const redoHistory = useCallback(() => {
    setHistory(redo);
  }, []);

  return {
    history,
    record,
    redo: redoHistory,
    undo: undoHistory
  };
}
