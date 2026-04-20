import { useCallback, useEffect, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { createInitialWorld, type MapState } from "@/core/map/world";
import { EditorScreen } from "@/app/EditorScreen";
import { WorkspaceListScreen } from "@/ui/components/WorkspaceListScreen/WorkspaceListScreen";
import { WorkspaceManagementScreen } from "@/ui/components/WorkspaceManagementScreen/WorkspaceManagementScreen";
import { LoginScreen } from "@/ui/components/LoginScreen/LoginScreen";
import {
  getCurrentUser,
  login as loginAccount,
  logout as logoutAccount,
  signup as signupAccount
} from "@/app/api/authApi";
import {
  addWorkspaceMemberByUsername,
  createWorkspace,
  createWorkspaceMapById,
  deleteMapById,
  deleteWorkspaceById,
  exportMapById,
  importWorkspaceMapById,
  listWorkspaceMapsById,
  listWorkspaceMembersById,
  listWorkspaces,
  loadMapById,
  removeWorkspaceMemberById,
  renameWorkspaceById,
  updateWorkspaceMemberRoleById,
  type WorkspaceMapSummary,
  type WorkspaceSummary
} from "@/app/api/workspaceApi";
import {
  canOpenWorkspaceAsGM,
  type MapOpenMode,
  type UserRecord,
  type WorkspaceMember
} from "@/core/auth/authTypes";
import { parseMapDocument } from "@/core/document/savedMapCodec";
import { serializeWorld } from "@/app/document/worldMapCodec";
import { deserializeWorld } from "@/app/document/worldMapCodec";

type OpenMapState = {
  id: string;
  name: string;
  role: MapOpenMode;
  workspaceMembers: WorkspaceMember[];
  tokenPlacements: { userId: string; q: number; r: number }[];
  updatedAt: string;
  workspaceId: string;
  world: MapState;
};

function getDefaultName(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

async function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Could not read file."));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Invalid file content."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsText(file);
  });
}

function triggerJsonDownload(fileName: string, payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>("Checking account...");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [managedWorkspaceId, setManagedWorkspaceId] = useState<string | null>(null);
  const [managedWorkspaceMembers, setManagedWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [managedWorkspaceMaps, setManagedWorkspaceMaps] = useState<WorkspaceMapSummary[]>([]);
  const [openMap, setOpenMap] = useState<OpenMapState | null>(null);
  const [user, setUser] = useState<UserRecord | null>(null);

  const isBusy = busyMessage !== null;

  const syncWorkspaceSummary = useCallback((summary: WorkspaceSummary) => {
    setWorkspaces((current) => current.map((workspace) => (
      workspace.id === summary.id ? summary : workspace
    )));
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const nextWorkspaces = await listWorkspaces();
    setWorkspaces(nextWorkspaces);

    if (nextWorkspaces.length === 0) {
      setSelectedWorkspaceId(null);
      setManagedWorkspaceId(null);
      return;
    }

    setSelectedWorkspaceId((current) => {
      if (current && nextWorkspaces.some((workspace) => workspace.id === current)) {
        return current;
      }

      return nextWorkspaces[0].id;
    });

    setManagedWorkspaceId((current) => {
      if (current && nextWorkspaces.some((workspace) => workspace.id === current)) {
        return current;
      }

      return null;
    });
  }, []);

  const withBusyState = useCallback(async (message: string, action: () => Promise<void>) => {
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
  }, []);

  useEffect(() => {
    void withBusyState("Checking account...", async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);

      if (currentUser) {
        await refreshWorkspaces();
      }
    });
  }, [refreshWorkspaces, withBusyState]);

  const login = useCallback(async (username: string, password: string) => {
    await withBusyState("Signing in...", async () => {
      const authenticated = await loginAccount(username, password);
      setUser(authenticated);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaces, withBusyState]);

  const signup = useCallback(async (username: string, password: string) => {
    await withBusyState("Creating account...", async () => {
      const authenticated = await signupAccount(username, password);
      setUser(authenticated);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaces, withBusyState]);

  const logout = useCallback(async () => {
    await withBusyState("Signing out...", async () => {
      await logoutAccount();
      setOpenMap(null);
      setManagedWorkspaceId(null);
      setManagedWorkspaceMembers([]);
      setManagedWorkspaceMaps([]);
      setUser(null);
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
    });
  }, [withBusyState]);

  const createNewWorkspace = useCallback(async (name: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Creating workspace...", async () => {
      const created = await createWorkspace({
        name: getDefaultName(name, "Untitled workspace")
      });

      await refreshWorkspaces();
      setSelectedWorkspaceId(created.id);
    });
  }, [refreshWorkspaces, user, withBusyState]);

  const renameWorkspace = useCallback(async (workspaceId: string, name: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Renaming workspace...", async () => {
      const updated = await renameWorkspaceById(workspaceId, getDefaultName(name, "Untitled workspace"));

      syncWorkspaceSummary(updated);
      await refreshWorkspaces();
      setSelectedWorkspaceId(workspaceId);
    });
  }, [refreshWorkspaces, syncWorkspaceSummary, user, withBusyState]);

  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Removing workspace...", async () => {
      await deleteWorkspaceById(workspaceId);
      await refreshWorkspaces();

      if (managedWorkspaceId === workspaceId) {
        setManagedWorkspaceId(null);
        setManagedWorkspaceMembers([]);
        setManagedWorkspaceMaps([]);
      }
    });
  }, [managedWorkspaceId, refreshWorkspaces, user, withBusyState]);

  const refreshWorkspaceMembers = useCallback(async (workspaceId: string) => {
    const payload = await listWorkspaceMembersById(workspaceId);
    setManagedWorkspaceMembers(payload.members);
    syncWorkspaceSummary(payload.workspace);
  }, [syncWorkspaceSummary]);

  const refreshWorkspaceMaps = useCallback(async (workspaceId: string) => {
    const payload = await listWorkspaceMapsById(workspaceId);
    setManagedWorkspaceMaps(payload.maps);
    syncWorkspaceSummary(payload.workspace);
  }, [syncWorkspaceSummary]);

  const refreshWorkspaceManagement = useCallback(async (workspaceId: string) => {
    await Promise.all([
      refreshWorkspaceMembers(workspaceId),
      refreshWorkspaceMaps(workspaceId)
    ]);
  }, [refreshWorkspaceMaps, refreshWorkspaceMembers]);

  const openWorkspaceManagement = useCallback(async (workspaceId: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Loading workspace management...", async () => {
      await refreshWorkspaceManagement(workspaceId);
      setManagedWorkspaceId(workspaceId);
      setSelectedWorkspaceId(workspaceId);
    });
  }, [refreshWorkspaceManagement, user, withBusyState]);

  const refreshManagedWorkspace = useCallback(async (workspaceId: string) => {
    await withBusyState("Refreshing workspace...", async () => {
      await refreshWorkspaceManagement(workspaceId);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaceManagement, refreshWorkspaces, withBusyState]);

  const addWorkspaceMember = useCallback(async (workspaceId: string, username: string, role: "gm" | "player") => {
    if (!user) {
      return;
    }

    await withBusyState("Adding workspace member...", async () => {
      const payload = await addWorkspaceMemberByUsername(workspaceId, username, role);
      setManagedWorkspaceMembers(payload.members);
      syncWorkspaceSummary(payload.workspace);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaces, syncWorkspaceSummary, user, withBusyState]);

  const removeWorkspaceMember = useCallback(async (workspaceId: string, memberUserId: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Removing workspace member...", async () => {
      const payload = await removeWorkspaceMemberById(workspaceId, memberUserId);
      setManagedWorkspaceMembers(payload.members);
      syncWorkspaceSummary(payload.workspace);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaces, syncWorkspaceSummary, user, withBusyState]);

  const updateWorkspaceMemberRole = useCallback(async (workspaceId: string, memberUserId: string, role: "gm" | "player") => {
    if (!user) {
      return;
    }

    await withBusyState("Updating workspace member role...", async () => {
      const payload = await updateWorkspaceMemberRoleById(workspaceId, memberUserId, role);
      setManagedWorkspaceMembers(payload.members);
      syncWorkspaceSummary(payload.workspace);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaces, syncWorkspaceSummary, user, withBusyState]);

  const createWorkspaceMap = useCallback(async (workspaceId: string, name: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Creating map...", async () => {
      await createWorkspaceMapById(workspaceId, {
        content: serializeWorld(createInitialWorld(editorConfig.maxLevels)),
        name: getDefaultName(name, "Untitled map")
      });
      await refreshWorkspaceMaps(workspaceId);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaceMaps, refreshWorkspaces, user, withBusyState]);

  const importWorkspaceMap = useCallback(async (workspaceId: string, file: File) => {
    if (!user) {
      return;
    }

    await withBusyState("Importing map...", async () => {
      const text = await readFileText(file);
      let raw: unknown;

      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON map file.");
      }

      const content = parseMapDocument(raw);
      const normalizedName = file.name.replace(/\.json$/i, "").trim();

      await importWorkspaceMapById(workspaceId, {
        content,
        name: getDefaultName(normalizedName, "Imported map")
      });
      await refreshWorkspaceMaps(workspaceId);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaceMaps, refreshWorkspaces, user, withBusyState]);

  const exportWorkspaceMap = useCallback(async (mapId: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Exporting map...", async () => {
      const payload = await exportMapById(mapId);
      const fileName = payload.name.trim().replace(/\s+/g, "-").toLowerCase() || "map-export";
      triggerJsonDownload(fileName, payload.document);
    });
  }, [user, withBusyState]);

  const deleteWorkspaceMap = useCallback(async (workspaceId: string, mapId: string) => {
    if (!user) {
      return;
    }

    await withBusyState("Removing map...", async () => {
      await deleteMapById(mapId);
      await refreshWorkspaceMaps(workspaceId);
      await refreshWorkspaces();
    });
  }, [refreshWorkspaceMaps, refreshWorkspaces, user, withBusyState]);

  const openWorkspaceMap = useCallback(async (mapId: string, mode: MapOpenMode) => {
    if (!user) {
      return;
    }

    await withBusyState("Opening map...", async () => {
      const loadedMap = await loadMapById(mapId, mode);

      if (mode === "gm" && !canOpenWorkspaceAsGM(loadedMap)) {
        throw new Error("GM access denied.");
      }

      setOpenMap({
        id: loadedMap.id,
        name: loadedMap.name,
        role: mode,
        workspaceMembers: loadedMap.workspaceMembers,
        tokenPlacements: loadedMap.tokenPlacements,
        updatedAt: loadedMap.updatedAt,
        workspaceId: loadedMap.workspaceId,
        world: deserializeWorld(loadedMap.document)
      });
      setSelectedWorkspaceId(loadedMap.workspaceId);
      setManagedWorkspaceId(loadedMap.workspaceId);
    });
  }, [user, withBusyState]);

  const closeWorkspaceManagement = useCallback(() => {
    setManagedWorkspaceId(null);
    setManagedWorkspaceMembers([]);
    setManagedWorkspaceMaps([]);
  }, []);

  const closeEditor = useCallback(() => {
    if (openMap) {
      setSelectedWorkspaceId(openMap.workspaceId);
      setManagedWorkspaceId(openMap.workspaceId);
      void withBusyState("Refreshing workspace...", async () => {
        await refreshWorkspaceManagement(openMap.workspaceId);
        await refreshWorkspaces();
      });
    }

    setOpenMap(null);
  }, [openMap, refreshWorkspaceManagement, refreshWorkspaces, withBusyState]);

  const managedWorkspace = managedWorkspaceId
    ? workspaces.find((workspace) => workspace.id === managedWorkspaceId) ?? null
    : null;

  if (openMap && user) {
    return (
      <EditorScreen
        key={openMap.id}
        initialWorld={openMap.world}
        mapId={openMap.id}
        mapName={openMap.name}
        workspaceMembers={openMap.workspaceMembers}
        user={user}
        role={openMap.role}
        onBackToMaps={closeEditor}
      />
    );
  }

  if (!user) {
    return (
      <LoginScreen
        errorMessage={errorMessage}
        isBusy={isBusy}
        onLogin={login}
        onSignup={signup}
      />
    );
  }

  if (managedWorkspace) {
    return (
      <WorkspaceManagementScreen
        currentUser={user}
        errorMessage={errorMessage}
        isBusy={isBusy}
        maps={managedWorkspaceMaps}
        members={managedWorkspaceMembers}
        onAddMember={addWorkspaceMember}
        onBackToWorkspaces={closeWorkspaceManagement}
        onCreateMap={createWorkspaceMap}
        onDeleteMap={deleteWorkspaceMap}
        onExportMap={exportWorkspaceMap}
        onImportMap={importWorkspaceMap}
        onOpenMapAs={openWorkspaceMap}
        onRefresh={refreshManagedWorkspace}
        onRemoveMember={removeWorkspaceMember}
        onUpdateRole={updateWorkspaceMemberRole}
        workspace={managedWorkspace}
      />
    );
  }

  return (
    <WorkspaceListScreen
      errorMessage={errorMessage}
      isBusy={isBusy}
      onCreateWorkspace={createNewWorkspace}
      onDeleteWorkspace={deleteWorkspace}
      onLogout={logout}
      onManageWorkspace={openWorkspaceManagement}
      onRefresh={refreshWorkspaces}
      onRenameWorkspace={renameWorkspace}
      onSelectWorkspace={setSelectedWorkspaceId}
      selectedWorkspaceId={selectedWorkspaceId}
      user={user}
      workspaces={workspaces}
    />
  );
}
