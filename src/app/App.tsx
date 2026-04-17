import { useCallback, useEffect, useState } from "react";
import { MapBrowser } from "./MapBrowser";
import { ConnectedEditor } from "./ConnectedEditor";
import { createMap, getMap, importMap, listMaps } from "@/client/mapsApi";
import type { MapSummary } from "@/shared/mapProtocol";

export default function App() {
  const [maps, setMaps] = useState<MapSummary[]>([]);
  const [activeMap, setActiveMap] = useState<Awaited<ReturnType<typeof getMap>> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMaps = useCallback(async () => {
    setLoading(true);

    try {
      setErrorMessage(null);
      setMaps(await listMaps());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de charger les maps.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMaps();
  }, [refreshMaps]);

  const openMap = useCallback(async (mapId: string) => {
    setLoading(true);

    try {
      setErrorMessage(null);
      setActiveMap(await getMap(mapId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'ouvrir la map.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateMap = useCallback(async (name: string) => {
    try {
      setErrorMessage(null);
      const created = await createMap({ name });
      await refreshMaps();
      await openMap(created.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible de créer la map.");
    }
  }, [openMap, refreshMaps]);

  const handleImportMap = useCallback(async (name: string, file: File) => {
    try {
      setErrorMessage(null);
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      const imported = await importMap({ name, json });
      await refreshMaps();
      await openMap(imported.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Impossible d'importer le JSON.");
    }
  }, [openMap, refreshMaps]);

  if (activeMap) {
    return <ConnectedEditor map={activeMap} onBack={() => {
      setActiveMap(null);
      void refreshMaps();
    }} />;
  }

  return (
    <MapBrowser
      errorMessage={errorMessage}
      loading={loading}
      maps={maps}
      onCreateMap={handleCreateMap}
      onImportMap={handleImportMap}
      onOpenMap={openMap}
      onRefresh={refreshMaps}
    />
  );
}
