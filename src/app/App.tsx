import { useCallback, useEffect, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { createEmptyWorld, createInitialWorld, type MapState } from "@/core/map/world";
import { EditorScreen } from "@/app/EditorScreen";
import { MapMenu, type ViewerRole } from "@/ui/components/MapMenu/MapMenu";
import { LoginScreen } from "@/ui/components/LoginScreen/LoginScreen";
import {
  createProfile,
  getStoredProfileId,
  listProfiles as listUserProfiles,
  rememberProfileId
} from "@/app/api/profileApi";
import {
  createMap,
  deleteMapById as deleteMapRecordById,
  listMaps,
  loadMapById,
  renameMapById as renameMapRecordById,
  type MapSummary
} from "@/app/api/mapApi";
import type { ProfileRecord } from "@/core/profile/profileTypes";
import { downloadSavedMapContentFile, readSavedMapContentFile } from "@/app/document/mapFile";
import { serializeWorld } from "@/app/document/worldMapCodec";

type OpenMapState = {
  id: string;
  name: string;
  role: ViewerRole;
  updatedAt: string;
  world: MapState;
};

function getDefaultMapName(baseName: string): string {
  const trimmed = baseName.trim();
  return trimmed || "Untitled map";
}

function fileBaseName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

function toOpenMap(map: MapSummary, role: ViewerRole): OpenMapState {
  return {
    id: map.id,
    name: map.name,
    role,
    updatedAt: map.updatedAt,
    world: createEmptyWorld()
  };
}

export default function App() {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<OpenMapState | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [storedProfileId, setStoredProfileId] = useState<string | null>(() => getStoredProfileId());

  const isBusy = busyMessage !== null;

  const refreshMaps = useCallback(async () => {
    const nextMaps = await listMaps();
    setMaps(nextMaps);

    if (nextMaps.length === 0) {
      setSelectedMapId(null);
      return;
    }

    setSelectedMapId((current) => {
      if (current && nextMaps.some((map) => map.id === current)) {
        return current;
      }

      return nextMaps[0].id;
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

  const refreshProfiles = useCallback(async () => {
    const nextProfiles = await listUserProfiles();
    setProfiles(nextProfiles);
    setStoredProfileId(getStoredProfileId());
  }, []);

  useEffect(() => {
    void withBusyState("Loading profiles...", refreshProfiles);
  }, [refreshProfiles, withBusyState]);

  const selectProfile = useCallback(async (nextProfile: ProfileRecord) => {
    await withBusyState("Opening profile...", async () => {
      rememberProfileId(nextProfile.id);
      setStoredProfileId(nextProfile.id);
      setProfile(nextProfile);
      await refreshMaps();
    });
  }, [refreshMaps, withBusyState]);

  const createNewProfile = useCallback(async (username: string) => {
    await withBusyState("Creating player...", async () => {
      const createdProfile = await createProfile(username);
      setProfiles((current) => {
        const others = current.filter((candidate) => candidate.id !== createdProfile.id);
        return [...others, createdProfile];
      });
      setStoredProfileId(createdProfile.id);
      setProfile(createdProfile);
      await refreshMaps();
    });
  }, [refreshMaps, withBusyState]);

  const createNewMap = useCallback(async (name: string) => {
    if (!profile) {
      return;
    }

    await withBusyState("Creating map...", async () => {
      const created = await createMap({
        name: getDefaultMapName(name),
        content: serializeWorld(createInitialWorld(editorConfig.maxLevels))
      }, profile.id);

      await refreshMaps();
      setSelectedMapId(created.id);
    });
  }, [profile, refreshMaps, withBusyState]);

  const openExistingMap = useCallback(async (mapId: string, role: ViewerRole) => {
    if (!profile) {
      return;
    }

    await withBusyState("Opening map...", async () => {
      const map = maps.find((candidate) => candidate.id === mapId);

      if (!map) {
        throw new Error("Map not found.");
      }

      setOpenMap(toOpenMap(map, role));
      setSelectedMapId(map.id);
    });
  }, [maps, profile, withBusyState]);

  const importMapFile = useCallback(async (file: File) => {
    if (!profile) {
      return;
    }

    await withBusyState("Importing map...", async () => {
      const map = await readSavedMapContentFile(file);
      const created = await createMap({
        name: getDefaultMapName(fileBaseName(file.name)),
        content: map
      }, profile.id);

      await refreshMaps();
      setSelectedMapId(created.id);
    });
  }, [profile, refreshMaps, withBusyState]);

  const exportMapById = useCallback(async (mapId: string) => {
    if (!profile) {
      return;
    }

    await withBusyState("Exporting map...", async () => {
      const map = await loadMapById(mapId, "player", profile.id);
      downloadSavedMapContentFile(map.name, map.content);
    });
  }, [profile, withBusyState]);

  const renameMapById = useCallback(async (mapId: string, name: string) => {
    if (!profile) {
      return;
    }

    await withBusyState("Renaming map...", async () => {
      await renameMapRecordById(mapId, getDefaultMapName(name), profile.id);

      await refreshMaps();
      setSelectedMapId(mapId);
    });
  }, [profile, refreshMaps, withBusyState]);

  const deleteMapById = useCallback(async (mapId: string) => {
    if (!profile) {
      return;
    }

    await withBusyState("Removing map...", async () => {
      await deleteMapRecordById(mapId, profile.id);
      await refreshMaps();
    });
  }, [profile, refreshMaps, withBusyState]);

  const closeEditor = useCallback(() => {
    if (openMap) {
      setSelectedMapId(openMap.id);
    }

    setOpenMap(null);
    void withBusyState("Refreshing maps...", refreshMaps);
  }, [openMap, refreshMaps, withBusyState]);

  const returnToLogin = useCallback(() => {
    setOpenMap(null);
    setProfile(null);
    setMaps([]);
    setSelectedMapId(null);
    setErrorMessage(null);
    void withBusyState("Loading profiles...", refreshProfiles);
  }, [refreshProfiles, withBusyState]);

  if (openMap && profile) {
    return (
      <EditorScreen
        key={openMap.id}
        initialWorld={openMap.world}
        mapId={openMap.id}
        mapName={openMap.name}
        profile={profile}
        role={openMap.role}
        onBackToMaps={closeEditor}
      />
    );
  }

  if (!profile) {
    return (
      <LoginScreen
        errorMessage={errorMessage}
        isBusy={isBusy}
        profiles={profiles}
        storedProfileId={storedProfileId}
        onCreateProfile={createNewProfile}
        onSelectProfile={selectProfile}
      />
    );
  }

  return (
    <MapMenu
      errorMessage={errorMessage}
      isBusy={isBusy}
      maps={maps}
      onCreateMap={createNewMap}
      onExportMap={exportMapById}
      onImportMap={importMapFile}
      onDeleteMap={deleteMapById}
      onChangeProfile={returnToLogin}
      onOpenMap={openExistingMap}
      onRenameMap={renameMapById}
      onRefresh={refreshMaps}
      onSelectMap={setSelectedMapId}
      profile={profile}
      selectedMapId={selectedMapId}
    />
  );
}
