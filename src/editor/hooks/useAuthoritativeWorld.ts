import { useCallback, useState } from "react";

export function useAuthoritativeWorld<T>(initialState: () => T) {
  const [world, setWorld] = useState(initialState);

  const resetFromCurrent = useCallback((deriveNextState: (currentState: T) => T) => {
    setWorld((currentWorld) => deriveNextState(currentWorld));
  }, []);

  return {
    resetFromCurrent,
    world
  };
}
