import { useCallback, useEffect, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import { createInitialWorld, type World } from "@/domain/world/world";
import { EditorScreen } from "@/app/EditorScreen";
import { MapMenu } from "@/ui/components/MapMenu/MapMenu";
import { createMap, listMaps, loadMapById, saveMapById, type MapRecord, type MapSummary } from "@/app/io/mapApi";
import { downloadSavedMapFile, readSavedMapFile } from "@/app/io/mapFile";
import { deserializeWorld, serializeWorld } from "@/app/io/mapFormat";

type OpenMapState = {
  id: string;
  name: string;
  updatedAt: string;
  world: World;
};

function getDefaultMapName(baseName: string): string {
  const trimmed = baseName.trim();
  return trimmed ? trimmed : "Untitled map";
}

function fileBaseName(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, "");
}

function toOpenMap(map: MapRecord): OpenMapState {
  return {
    id: map.id,
    name: map.name,
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

  const openExistingMap = useCallback(async (mapId: string) => {
    await withBusyState("Opening map...", async () => {
      const map = await loadMapById(mapId);
      setOpenMap(toOpenMap(map));
      setSelectedMapId(map.id);
    });
  }, [withBusyState]);

  const importMapFile = useCallback(async (file: File) => {
    await withBusyState("Importing map...", async () => {
      const map = await readSavedMapFile(file);
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
      downloadSavedMapFile(map.name, map.content);
    });
  }, [withBusyState]);

  const saveOpenMap = useCallback(async (world: World) => {
    const currentOpenMap = openMap;

    if (!currentOpenMap) {
      return;
    }

    await withBusyState("Saving map...", async () => {
      const saved = await saveMapById(currentOpenMap.id, {
        name: currentOpenMap.name,
        content: serializeWorld(world)
      });

      setOpenMap({
        id: saved.id,
        name: saved.name,
        updatedAt: saved.updatedAt,
        world
      });
      await refreshMaps();
    });
  }, [openMap, refreshMaps, withBusyState]);

  const closeEditor = useCallback(() => {
    if (openMap) {
      setSelectedMapId(openMap.id);
    }

    setOpenMap(null);
  }, [openMap]);

  if (openMap) {
    return (
      <EditorScreen
        key={openMap.id}
        initialWorld={openMap.world}
        mapName={openMap.name}
        onBackToMaps={closeEditor}
        onSaveMap={saveOpenMap}
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
      onRefresh={refreshMaps}
      onSelectMap={setSelectedMapId}
      selectedMapId={selectedMapId}
    />
  );
}
