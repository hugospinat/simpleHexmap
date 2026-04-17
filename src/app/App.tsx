import { useCallback, useEffect, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { createInitialWorld, type MapState } from "@/core/map/world";
import { EditorScreen } from "@/app/EditorScreen";
import { MapMenu, type ViewerRole } from "@/ui/components/MapMenu/MapMenu";
import { createMap, listMaps, loadMapById, renameMapById as renameMapRecordById, type MapRecord, type MapSummary } from "@/app/api/mapApi";
import { downloadSavedMapContentFile, readSavedMapContentFile } from "@/app/document/mapFile";
import { deserializeWorld, serializeWorld } from "@/app/document/worldMapCodec";

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

function toOpenMap(map: MapRecord, role: ViewerRole): OpenMapState {
  return {
    id: map.id,
    name: map.name,
    role,
    updatedAt: map.updatedAt,
    world: deserializeWorld(map.content)
  };
}

export default function App() {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<OpenMapState | null>(null);

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

  useEffect(() => {
    void withBusyState("Loading maps...", refreshMaps);
  }, [refreshMaps, withBusyState]);

  const createNewMap = useCallback(async (name: string) => {
    await withBusyState("Creating map...", async () => {
      const created = await createMap({
        name: getDefaultMapName(name),
        content: serializeWorld(createInitialWorld(editorConfig.maxLevels))
      });

      await refreshMaps();
      setSelectedMapId(created.id);
    });
  }, [refreshMaps, withBusyState]);

  const openExistingMap = useCallback(async (mapId: string, role: ViewerRole) => {
    await withBusyState("Opening map...", async () => {
      const map = await loadMapById(mapId);
      setOpenMap(toOpenMap(map, role));
      setSelectedMapId(map.id);
    });
  }, [withBusyState]);

  const importMapFile = useCallback(async (file: File) => {
    await withBusyState("Importing map...", async () => {
      const map = await readSavedMapContentFile(file);
      const created = await createMap({
        name: getDefaultMapName(fileBaseName(file.name)),
        content: map
      });

      await refreshMaps();
      setSelectedMapId(created.id);
    });
  }, [refreshMaps, withBusyState]);

  const exportMapById = useCallback(async (mapId: string) => {
    await withBusyState("Exporting map...", async () => {
      const map = await loadMapById(mapId);
      downloadSavedMapContentFile(map.name, map.content);
    });
  }, [withBusyState]);

  const renameMapById = useCallback(async (mapId: string, name: string) => {
    await withBusyState("Renaming map...", async () => {
      await renameMapRecordById(mapId, getDefaultMapName(name));

      await refreshMaps();
      setSelectedMapId(mapId);
    });
  }, [refreshMaps, withBusyState]);

  const closeEditor = useCallback(() => {
    if (openMap) {
      setSelectedMapId(openMap.id);
    }

    setOpenMap(null);
    void withBusyState("Refreshing maps...", refreshMaps);
  }, [openMap, refreshMaps, withBusyState]);

  if (openMap) {
    return (
      <EditorScreen
        key={openMap.id}
        initialWorld={openMap.world}
        mapId={openMap.id}
        mapName={openMap.name}
        role={openMap.role}
        onBackToMaps={closeEditor}
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
      onOpenMap={openExistingMap}
      onRenameMap={renameMapById}
      onRefresh={refreshMaps}
      onSelectMap={setSelectedMapId}
      selectedMapId={selectedMapId}
    />
  );
}
