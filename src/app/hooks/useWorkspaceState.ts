import { useCallback, useMemo, useState } from "react";
import {
  addWorkspaceMemberByUsername,
  buildInviteUrl,
  createWorkspace,
  createWorkspaceInviteById,
  createWorkspaceMapById,
  deleteMapById,
  deleteWorkspaceById,
  exportMapById,
  importWorkspaceMapById,
  listWorkspaceInvitesById,
  listWorkspaceMapsById,
  listWorkspaceMembersById,
  listWorkspaces,
  loadMapById,
  removeWorkspaceMemberById,
  renameWorkspaceById,
  revokeWorkspaceInviteById,
  updateWorkspaceMemberRoleById,
  type WorkspaceMapSummary,
  type WorkspaceSummary,
} from "@/app/api";
import { deserializeWorld, serializeWorld } from "@/app/document";
import { getDefaultName, readFileText, triggerJsonDownload } from "@/app/appHelpers";
import type { OpenMapState } from "@/app/appTypes";
import { editorConfig } from "@/config/editorConfig";
import {
  canOpenWorkspaceAsGM,
  type MapOpenMode,
  type WorkspaceInviteSummary,
  type WorkspaceMember,
} from "@/core/auth/authTypes";
import { parseMapDocument } from "@/core/document/savedMapCodec";
import { createInitialWorld } from "@/core/map/world";

type BusyRunner = (message: string, action: () => Promise<void>) => Promise<void>;

type UseWorkspaceStateOptions = {
  withBusyState: BusyRunner;
};

type UseWorkspaceStateResult = {
  createNewWorkspace: (name: string) => Promise<void>;
  createWorkspaceInvite: (
    workspaceId: string,
    expiresInDays: number,
    maxUses: number,
  ) => Promise<string>;
  createWorkspaceMap: (workspaceId: string, name: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  deleteWorkspaceMap: (workspaceId: string, mapId: string) => Promise<void>;
  exportWorkspaceMap: (mapId: string) => Promise<void>;
  importWorkspaceMap: (workspaceId: string, file: File) => Promise<void>;
  managedWorkspace: WorkspaceSummary | null;
  managedWorkspaceId: string | null;
  managedWorkspaceInvites: WorkspaceInviteSummary[];
  managedWorkspaceMaps: WorkspaceMapSummary[];
  managedWorkspaceMembers: WorkspaceMember[];
  openMap: OpenMapState | null;
  openWorkspaceManagement: (workspaceId: string) => Promise<void>;
  openWorkspaceMap: (mapId: string, mode: MapOpenMode) => Promise<void>;
  refreshManagedWorkspace: (workspaceId: string) => Promise<void>;
  refreshWorkspaceManagement: (workspaceId: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  resetWorkspaceState: () => void;
  removeWorkspaceMember: (workspaceId: string, memberUserId: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  revokeWorkspaceInvite: (workspaceId: string, inviteId: string) => Promise<void>;
  selectedWorkspaceId: string | null;
  setManagedWorkspaceId: (workspaceId: string | null) => void;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  syncWorkspaceSummary: (summary: WorkspaceSummary) => void;
  updateWorkspaceMemberRole: (
    workspaceId: string,
    memberUserId: string,
    role: "gm" | "player",
  ) => Promise<void>;
  workspaces: WorkspaceSummary[];
  addWorkspaceMember: (
    workspaceId: string,
    username: string,
    role: "gm" | "player",
  ) => Promise<void>;
  closeEditor: (onClose?: (workspaceId: string) => Promise<void>) => void;
  closeWorkspaceManagement: () => void;
  setOpenMap: (map: OpenMapState | null) => void;
  setWorkspaces: (workspaces: WorkspaceSummary[]) => void;
};

export function useWorkspaceState({
  withBusyState,
}: UseWorkspaceStateOptions): UseWorkspaceStateResult {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [managedWorkspaceId, setManagedWorkspaceId] = useState<string | null>(null);
  const [managedWorkspaceInvites, setManagedWorkspaceInvites] = useState<
    WorkspaceInviteSummary[]
  >([]);
  const [managedWorkspaceMembers, setManagedWorkspaceMembers] = useState<
    WorkspaceMember[]
  >([]);
  const [managedWorkspaceMaps, setManagedWorkspaceMaps] = useState<
    WorkspaceMapSummary[]
  >([]);
  const [openMap, setOpenMap] = useState<OpenMapState | null>(null);

  const syncWorkspaceSummary = useCallback((summary: WorkspaceSummary) => {
    setWorkspaces((current) =>
      current.map((workspace) =>
        workspace.id === summary.id ? summary : workspace,
      ),
    );
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    const nextWorkspaces = await listWorkspaces();
    setWorkspaces(nextWorkspaces);

    if (nextWorkspaces.length === 0) {
      setSelectedWorkspaceId(null);
      setManagedWorkspaceId(null);
      setManagedWorkspaceInvites([]);
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

  const refreshWorkspaceMembers = useCallback(
    async (workspaceId: string) => {
      const payload = await listWorkspaceMembersById(workspaceId);
      setManagedWorkspaceMembers(payload.members);
      syncWorkspaceSummary(payload.workspace);
    },
    [syncWorkspaceSummary],
  );

  const refreshWorkspaceMaps = useCallback(
    async (workspaceId: string) => {
      const payload = await listWorkspaceMapsById(workspaceId);
      setManagedWorkspaceMaps(payload.maps);
      syncWorkspaceSummary(payload.workspace);
    },
    [syncWorkspaceSummary],
  );

  const refreshWorkspaceInvites = useCallback(async (workspaceId: string) => {
    try {
      const payload = await listWorkspaceInvitesById(workspaceId);
      setManagedWorkspaceInvites(payload.invites);
    } catch (error) {
      if (error instanceof Error && error.message === "Owner access denied.") {
        setManagedWorkspaceInvites([]);
        return;
      }

      throw error;
    }
  }, []);

  const refreshWorkspaceManagement = useCallback(
    async (workspaceId: string) => {
      await Promise.all([
        refreshWorkspaceInvites(workspaceId),
        refreshWorkspaceMembers(workspaceId),
        refreshWorkspaceMaps(workspaceId),
      ]);
    },
    [refreshWorkspaceInvites, refreshWorkspaceMaps, refreshWorkspaceMembers],
  );

  const createNewWorkspace = useCallback(
    async (name: string) => {
      await withBusyState("Creating workspace...", async () => {
        const created = await createWorkspace({
          name: getDefaultName(name, "Untitled workspace"),
        });

        await refreshWorkspaces();
        setSelectedWorkspaceId(created.id);
      });
    },
    [refreshWorkspaces, withBusyState],
  );

  const renameWorkspace = useCallback(
    async (workspaceId: string, name: string) => {
      await withBusyState("Renaming workspace...", async () => {
        const updated = await renameWorkspaceById(
          workspaceId,
          getDefaultName(name, "Untitled workspace"),
        );

        syncWorkspaceSummary(updated);
        await refreshWorkspaces();
        setSelectedWorkspaceId(workspaceId);
      });
    },
    [refreshWorkspaces, syncWorkspaceSummary, withBusyState],
  );

  const deleteWorkspace = useCallback(
    async (workspaceId: string) => {
      await withBusyState("Removing workspace...", async () => {
        await deleteWorkspaceById(workspaceId);
        await refreshWorkspaces();

        if (managedWorkspaceId === workspaceId) {
          setManagedWorkspaceId(null);
          setManagedWorkspaceInvites([]);
          setManagedWorkspaceMembers([]);
          setManagedWorkspaceMaps([]);
        }
      });
    },
    [managedWorkspaceId, refreshWorkspaces, withBusyState],
  );

  const openWorkspaceManagement = useCallback(
    async (workspaceId: string) => {
      await withBusyState("Loading workspace management...", async () => {
        await refreshWorkspaceManagement(workspaceId);
        setManagedWorkspaceId(workspaceId);
        setSelectedWorkspaceId(workspaceId);
      });
    },
    [refreshWorkspaceManagement, withBusyState],
  );

  const refreshManagedWorkspace = useCallback(
    async (workspaceId: string) => {
      await withBusyState("Refreshing workspace...", async () => {
        await refreshWorkspaceManagement(workspaceId);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaceManagement, refreshWorkspaces, withBusyState],
  );

  const addWorkspaceMember = useCallback(
    async (workspaceId: string, username: string, role: "gm" | "player") => {
      await withBusyState("Adding workspace member...", async () => {
        const payload = await addWorkspaceMemberByUsername(workspaceId, username, role);
        setManagedWorkspaceMembers(payload.members);
        syncWorkspaceSummary(payload.workspace);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaces, syncWorkspaceSummary, withBusyState],
  );

  const removeWorkspaceMember = useCallback(
    async (workspaceId: string, memberUserId: string) => {
      await withBusyState("Removing workspace member...", async () => {
        const payload = await removeWorkspaceMemberById(workspaceId, memberUserId);
        setManagedWorkspaceMembers(payload.members);
        syncWorkspaceSummary(payload.workspace);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaces, syncWorkspaceSummary, withBusyState],
  );

  const updateWorkspaceMemberRole = useCallback(
    async (workspaceId: string, memberUserId: string, role: "gm" | "player") => {
      await withBusyState("Updating workspace member role...", async () => {
        const payload = await updateWorkspaceMemberRoleById(
          workspaceId,
          memberUserId,
          role,
        );
        setManagedWorkspaceMembers(payload.members);
        syncWorkspaceSummary(payload.workspace);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaces, syncWorkspaceSummary, withBusyState],
  );

  const createWorkspaceInvite = useCallback(
    async (workspaceId: string, expiresInDays: number, maxUses: number) => {
      let inviteUrl = "";

      await withBusyState("Creating invite link...", async () => {
        const created = await createWorkspaceInviteById(workspaceId, {
          expiresInDays,
          maxUses,
        });
        inviteUrl = buildInviteUrl(created.token);
        await refreshWorkspaceInvites(workspaceId);
      });

      return inviteUrl;
    },
    [refreshWorkspaceInvites, withBusyState],
  );

  const revokeWorkspaceInvite = useCallback(
    async (workspaceId: string, inviteId: string) => {
      await withBusyState("Revoking invite link...", async () => {
        await revokeWorkspaceInviteById(workspaceId, inviteId);
        await refreshWorkspaceInvites(workspaceId);
      });
    },
    [refreshWorkspaceInvites, withBusyState],
  );

  const createWorkspaceMap = useCallback(
    async (workspaceId: string, name: string) => {
      await withBusyState("Creating map...", async () => {
        await createWorkspaceMapById(workspaceId, {
          content: serializeWorld(createInitialWorld(editorConfig.maxLevels)),
          name: getDefaultName(name, "Untitled map"),
        });
        await refreshWorkspaceMaps(workspaceId);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaceMaps, refreshWorkspaces, withBusyState],
  );

  const importWorkspaceMap = useCallback(
    async (workspaceId: string, file: File) => {
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
          name: getDefaultName(normalizedName, "Imported map"),
        });
        await refreshWorkspaceMaps(workspaceId);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaceMaps, refreshWorkspaces, withBusyState],
  );

  const exportWorkspaceMap = useCallback(
    async (mapId: string) => {
      await withBusyState("Exporting map...", async () => {
        const payload = await exportMapById(mapId);
        const fileName =
          payload.name.trim().replace(/\s+/g, "-").toLowerCase() || "map-export";
        triggerJsonDownload(fileName, payload.document);
      });
    },
    [withBusyState],
  );

  const deleteWorkspaceMap = useCallback(
    async (workspaceId: string, mapId: string) => {
      await withBusyState("Removing map...", async () => {
        await deleteMapById(mapId);
        await refreshWorkspaceMaps(workspaceId);
        await refreshWorkspaces();
      });
    },
    [refreshWorkspaceMaps, refreshWorkspaces, withBusyState],
  );

  const openWorkspaceMap = useCallback(
    async (mapId: string, mode: MapOpenMode) => {
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
          world: deserializeWorld(loadedMap.document),
        });
        setSelectedWorkspaceId(loadedMap.workspaceId);
        setManagedWorkspaceId(loadedMap.workspaceId);
      });
    },
    [withBusyState],
  );

  const closeWorkspaceManagement = useCallback(() => {
    setManagedWorkspaceId(null);
    setManagedWorkspaceInvites([]);
    setManagedWorkspaceMembers([]);
    setManagedWorkspaceMaps([]);
  }, []);

  const resetWorkspaceState = useCallback(() => {
    setOpenMap(null);
    setManagedWorkspaceId(null);
    setManagedWorkspaceInvites([]);
    setManagedWorkspaceMembers([]);
    setManagedWorkspaceMaps([]);
    setWorkspaces([]);
    setSelectedWorkspaceId(null);
  }, []);

  const closeEditor = useCallback(
    (onClose?: (workspaceId: string) => Promise<void>) => {
      if (openMap) {
        setSelectedWorkspaceId(openMap.workspaceId);
        setManagedWorkspaceId(openMap.workspaceId);
        void onClose?.(openMap.workspaceId);
      }

      setOpenMap(null);
    },
    [openMap],
  );

  const managedWorkspace = useMemo(
    () =>
      managedWorkspaceId
        ? workspaces.find((workspace) => workspace.id === managedWorkspaceId) ?? null
        : null,
    [managedWorkspaceId, workspaces],
  );

  return {
    addWorkspaceMember,
    closeEditor,
    closeWorkspaceManagement,
    createNewWorkspace,
    createWorkspaceInvite,
    createWorkspaceMap,
    deleteWorkspace,
    deleteWorkspaceMap,
    exportWorkspaceMap,
    importWorkspaceMap,
    managedWorkspace,
    managedWorkspaceId,
    managedWorkspaceInvites,
    managedWorkspaceMaps,
    managedWorkspaceMembers,
    openMap,
    openWorkspaceManagement,
    openWorkspaceMap,
    refreshManagedWorkspace,
    refreshWorkspaceManagement,
    refreshWorkspaces,
    resetWorkspaceState,
    removeWorkspaceMember,
    renameWorkspace,
    revokeWorkspaceInvite,
    selectedWorkspaceId,
    setManagedWorkspaceId,
    setOpenMap,
    setSelectedWorkspaceId,
    setWorkspaces,
    syncWorkspaceSummary,
    updateWorkspaceMemberRole,
    workspaces,
  };
}
