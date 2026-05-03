import { useCallback, useEffect, useState } from "react";
import { getCurrentUser, login, logout, signup } from "@/app/api";
import type { UserRecord } from "@/core/auth/authTypes";

type BusyRunner = (message: string, action: () => Promise<void>) => Promise<void>;

type UseAuthStateOptions = {
  refreshWorkspaces: () => Promise<void>;
  resetWorkspaceState: () => void;
  withBusyState: BusyRunner;
};

export function useAuthState({
  refreshWorkspaces,
  resetWorkspaceState,
  withBusyState,
}: UseAuthStateOptions) {
  const [user, setUser] = useState<UserRecord | null>(null);

  useEffect(() => {
    void withBusyState("Checking account...", async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        await refreshWorkspaces();
      }
    });
  }, [refreshWorkspaces, withBusyState]);

  const loginUser = useCallback(
    async (username: string, password: string) => {
      await withBusyState("Signing in...", async () => {
        const authenticated = await login(username, password);
        setUser(authenticated);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaces, withBusyState],
  );

  const signupUser = useCallback(
    async (username: string, password: string) => {
      await withBusyState("Creating account...", async () => {
        const authenticated = await signup(username, password);
        setUser(authenticated);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaces, withBusyState],
  );

  const logoutUser = useCallback(async () => {
    await withBusyState("Signing out...", async () => {
      await logout();
      resetWorkspaceState();
      setUser(null);
    });
  }, [resetWorkspaceState, withBusyState]);

  return {
    login: loginUser,
    logout: logoutUser,
    setUser,
    signup: signupUser,
    user,
  };
}
