import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject,
} from "react";

type RemoteSyncHandlerRefs = {
  authoritativeResyncHandlerRef: MutableRefObject<() => void>;
  clearPreviewHandlerRef: MutableRefObject<() => void>;
  remoteOperationsAppliedHandlerRef: MutableRefObject<(count: number) => void>;
};

type UseRemoteSyncLifecycleOptions = RemoteSyncHandlerRefs & {
  clearToolPreview: (force?: boolean) => void;
  hasActiveGesture: () => boolean;
  operationHistory: {
    clearUndoRedoHistory: () => void;
    resetHistory: () => void;
  };
  resetGestureState: () => void;
};

export function useRemoteSyncCallbacks(
  clearPreviewFallback: () => void,
): RemoteSyncHandlerRefs & {
  clearSyncPreview: () => void;
  handleAuthoritativeResync: () => void;
  handleRemoteOperationsApplied: (count: number) => void;
} {
  const clearPreviewHandlerRef = useRef<() => void>(clearPreviewFallback);
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

  return {
    authoritativeResyncHandlerRef,
    clearPreviewHandlerRef,
    clearSyncPreview,
    handleAuthoritativeResync,
    handleRemoteOperationsApplied,
    remoteOperationsAppliedHandlerRef,
  };
}

export function useRemoteSyncLifecycle({
  authoritativeResyncHandlerRef,
  clearPreviewHandlerRef,
  clearToolPreview,
  hasActiveGesture,
  operationHistory,
  remoteOperationsAppliedHandlerRef,
  resetGestureState,
}: UseRemoteSyncLifecycleOptions) {
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
  }, [
    authoritativeResyncHandlerRef,
    clearPreviewHandlerRef,
    clearToolPreview,
    hasActiveGesture,
    operationHistory,
    remoteOperationsAppliedHandlerRef,
    resetGestureState,
  ]);
}
