import { useCallback, useState } from "react";

export function useBusyState(initialMessage: string | null) {
  const [busyMessage, setBusyMessage] = useState<string | null>(initialMessage);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const withBusyState = useCallback(
    async (message: string, action: () => Promise<void>) => {
      setBusyMessage(message);
      setErrorMessage(null);

      try {
        await action();
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unexpected error.";
        setErrorMessage(detail);
      } finally {
        setBusyMessage(null);
      }
    },
    [],
  );

  return {
    busyMessage,
    errorMessage,
    isBusy: busyMessage !== null,
    setBusyMessage,
    setErrorMessage,
    withBusyState,
  };
}
