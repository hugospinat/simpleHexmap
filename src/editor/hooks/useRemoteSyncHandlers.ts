import { useCallback, useEffect, useRef } from "react";

type UseRemoteSyncHandlersOptions = {
  clearToolPreview: (force?: boolean) => void;
  hasActiveGesture: () => boolean;
  operationHistory: {
    clearUndoRedoHistory: () => void;
    resetHistory: () => void;
  };
  resetGestureState: () => void;
};

export function useRemoteSyncHandlers({
  clearToolPreview,
  hasActiveGesture,
  operationHistory,
  resetGestureState,
}: UseRemoteSyncHandlersOptions) {
  const clearPreviewHandlerRef = useRef<() => void>(() => {});
  const authoritativeResyncHandlerRef = useRef<() => void>(() => {});
  const remoteOperationsAppliedHandlerRef = useRef<(count: number) => void>(
    () => {},
  );

  const clearSyncPreview = useCallback(() => {
    clearPreviewHandlerRef.current();
  }, []);

  const handleAuthoritativeResync = useCallback(() => {
    authoritativeResyncHandlerRef.current();
  }, []);

  const handleRemoteOperationsApplied = useCallback((count: number) => {
    remoteOperationsAppliedHandlerRef.current(count);
  }, []);

  useEffect(() => {
    clearPreviewHandlerRef.current = () => {
      if (hasActiveGesture()) {
        return;
      }

      clearToolPreview(true);
    };
    authoritativeResyncHandlerRef.current = () => {
      operationHistory.resetHistory();
      resetGestureState();
      clearToolPreview(true);
    };
    remoteOperationsAppliedHandlerRef.current = () => {
      operationHistory.clearUndoRedoHistory();
    };
  }, [clearToolPreview, hasActiveGesture, operationHistory, resetGestureState]);

  return {
    clearSyncPreview,
    handleAuthoritativeResync,
    handleRemoteOperationsApplied,
  };
}

