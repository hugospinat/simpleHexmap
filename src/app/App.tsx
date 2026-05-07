import { useCallback } from "react";
import { useBusyState } from "@/app/hooks/useBusyState";
import { useWorkspaceState } from "@/app/hooks/useWorkspaceState";
import { useAuthState } from "@/app/hooks/useAuthState";
import { useInviteState } from "@/app/hooks/useInviteState";
import { EditorScreen } from "@/app/EditorScreen";
import {
  LoginScreen,
  WorkspaceListScreen,
  WorkspaceManagementScreen,
} from "@/ui/components";

export default function App() {
  const { errorMessage, isBusy, setErrorMessage, withBusyState } = useBusyState(
    "Checking account...",
  );
  const workspaceState = useWorkspaceState({ withBusyState });
  const { login, logout, signup, user } = useAuthState({
    refreshWorkspaces: workspaceState.refreshWorkspaces,
    resetWorkspaceState: workspaceState.resetWorkspaceState,
    withBusyState,
  });
  const inviteState = useInviteState({
    refreshWorkspaceManagement: workspaceState.refreshWorkspaceManagement,
    refreshWorkspaces: workspaceState.refreshWorkspaces,
    setErrorMessage,
    setManagedWorkspaceId: workspaceState.setManagedWorkspaceId,
    setSelectedWorkspaceId: workspaceState.setSelectedWorkspaceId,
    user,
    withBusyState,
  });

  const closeEditor = useCallback(() => {
    workspaceState.closeEditor(async (workspaceId) => {
      await withBusyState("Refreshing workspace...", async () => {
        await workspaceState.refreshWorkspaceManagement(workspaceId);
        await workspaceState.refreshWorkspaces();
      });
    });
  }, [withBusyState, workspaceState]);

  if (workspaceState.openMap && user) {
    return (
        <EditorScreen
          initialDocument={workspaceState.openMap.document}
          key={workspaceState.openMap.id}
          initialWorld={workspaceState.openMap.world}
        mapId={workspaceState.openMap.id}
        mapName={workspaceState.openMap.name}
        workspaceMembers={workspaceState.openMap.workspaceMembers}
        user={user}
        role={workspaceState.openMap.role}
        onBackToMaps={closeEditor}
      />
    );
  }

  if (!user) {
    return (
      <LoginScreen
        errorMessage={errorMessage}
        invite={inviteState.inviteLookup?.invite ?? null}
        isBusy={isBusy}
        onLogin={login}
        onSignup={signup}
      />
    );
  }

  if (workspaceState.managedWorkspace) {
    return (
      <WorkspaceManagementScreen
        currentUser={user}
        errorMessage={errorMessage}
        isBusy={isBusy}
        invites={workspaceState.managedWorkspaceInvites}
        maps={workspaceState.managedWorkspaceMaps}
        members={workspaceState.managedWorkspaceMembers}
        onAddMember={workspaceState.addWorkspaceMember}
        onBackToWorkspaces={workspaceState.closeWorkspaceManagement}
        onCreateInvite={workspaceState.createWorkspaceInvite}
        onCreateMap={workspaceState.createWorkspaceMap}
        onDeleteMap={workspaceState.deleteWorkspaceMap}
        onExportMap={workspaceState.exportWorkspaceMap}
        onImportMap={workspaceState.importWorkspaceMap}
        onOpenMapAs={workspaceState.openWorkspaceMap}
        onRefresh={workspaceState.refreshManagedWorkspace}
        onRemoveMember={workspaceState.removeWorkspaceMember}
        onRevokeInvite={workspaceState.revokeWorkspaceInvite}
        onUpdateRole={workspaceState.updateWorkspaceMemberRole}
        workspace={workspaceState.managedWorkspace}
      />
    );
  }

  return (
    <WorkspaceListScreen
      errorMessage={errorMessage}
      isBusy={isBusy}
      onCreateWorkspace={workspaceState.createNewWorkspace}
      onDeleteWorkspace={workspaceState.deleteWorkspace}
      onLogout={logout}
      onManageWorkspace={workspaceState.openWorkspaceManagement}
      onRefresh={workspaceState.refreshWorkspaces}
      onRenameWorkspace={workspaceState.renameWorkspace}
      onSelectWorkspace={workspaceState.setSelectedWorkspaceId}
      selectedWorkspaceId={workspaceState.selectedWorkspaceId}
      user={user}
      workspaces={workspaceState.workspaces}
    />
  );
}
