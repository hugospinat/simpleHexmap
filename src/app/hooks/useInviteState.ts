import { useEffect, useState } from "react";
import {
  getWorkspaceInviteByToken,
  joinWorkspaceByInviteToken,
  type WorkspaceInviteLookup,
} from "@/app/api";
import {
  clearInviteTokenFromLocation,
  readInviteTokenFromLocation,
} from "@/app/appHelpers";
import type { UserRecord } from "@/core/auth/authTypes";

type BusyRunner = (message: string, action: () => Promise<void>) => Promise<void>;

type UseInviteStateOptions = {
  refreshWorkspaceManagement: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  setErrorMessage: (message: string | null) => void;
  setManagedWorkspaceId: (workspaceId: string | null) => void;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  user: UserRecord | null;
  withBusyState: BusyRunner;
};

export function useInviteState({
  refreshWorkspaceManagement,
  refreshWorkspaces,
  setErrorMessage,
  setManagedWorkspaceId,
  setSelectedWorkspaceId,
  user,
  withBusyState,
}: UseInviteStateOptions) {
  const [inviteToken, setInviteToken] = useState<string | null>(() =>
    readInviteTokenFromLocation(),
  );
  const [inviteLookup, setInviteLookup] = useState<WorkspaceInviteLookup | null>(
    null,
  );
  const [joiningInviteToken, setJoiningInviteToken] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteToken) {
      setInviteLookup(null);
      return;
    }

    void (async () => {
      try {
        setInviteLookup(await getWorkspaceInviteByToken(inviteToken));
      } catch (error) {
        setInviteLookup(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Could not load invite.",
        );
      }
    })();
  }, [inviteToken, setErrorMessage]);

  useEffect(() => {
    if (!user || !inviteToken || !inviteLookup || joiningInviteToken === inviteToken) {
      return;
    }

    setJoiningInviteToken(inviteToken);
    void withBusyState("Joining workspace invite...", async () => {
      const result = await joinWorkspaceByInviteToken(inviteToken);
      await refreshWorkspaces();
      await refreshWorkspaceManagement(result.workspace.id);
      setSelectedWorkspaceId(result.workspace.id);
      setManagedWorkspaceId(result.workspace.id);
      setInviteLookup(null);
      setInviteToken(null);
      clearInviteTokenFromLocation();
    }).finally(() => {
      setJoiningInviteToken((current) =>
        current === inviteToken ? null : current,
      );
    });
  }, [
    inviteLookup,
    inviteToken,
    joiningInviteToken,
    refreshWorkspaceManagement,
    refreshWorkspaces,
    setManagedWorkspaceId,
    setSelectedWorkspaceId,
    user,
    withBusyState,
  ]);

  return {
    inviteLookup,
    inviteToken,
    setInviteLookup,
    setInviteToken,
  };
}
