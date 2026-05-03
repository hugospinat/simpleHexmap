import { useCallback, useMemo, useRef } from "react";
import {
  clearOperationHistory,
  createOperationHistoryState,
  recordOperationHistory,
  takeRedoOperations,
  takeUndoOperations,
} from "@/core/map/history/mapOperationHistory";
import type { MapState } from "@/core/map/world";
import type { MapOperation } from "@/core/protocol";

export function useEditorOperationHistory(
  canEdit: boolean,
  commitLocalOperations: (operations: MapOperation[]) => void,
) {
  const operationHistoryRef = useRef(createOperationHistoryState());

  const clearUndoRedoHistory = useCallback(() => {
    clearOperationHistory(operationHistoryRef.current);
  }, []);

  const resetHistory = useCallback(() => {
    clearOperationHistory(operationHistoryRef.current);
  }, []);

  const submitLocalOperations = useCallback(
    (operations: MapOperation[], worldBefore: MapState) => {
      if (operations.length === 0) {
        return;
      }

      recordOperationHistory(operationHistoryRef.current, worldBefore, operations);
      commitLocalOperations(operations);
    },
    [commitLocalOperations],
  );

  const undoLastOperationBatch = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const operations = takeUndoOperations(operationHistoryRef.current);

    if (operations.length > 0) {
      commitLocalOperations(operations);
    }
  }, [canEdit, commitLocalOperations]);

  const redoLastOperationBatch = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const operations = takeRedoOperations(operationHistoryRef.current);

    if (operations.length > 0) {
      commitLocalOperations(operations);
    }
  }, [canEdit, commitLocalOperations]);

  return useMemo(
    () => ({
      clearUndoRedoHistory,
      redoLastOperationBatch,
      resetHistory,
      submitLocalOperations,
      undoLastOperationBatch,
    }),
    [
      clearUndoRedoHistory,
      redoLastOperationBatch,
      resetHistory,
      submitLocalOperations,
      undoLastOperationBatch,
    ],
  );
}
