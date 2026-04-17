import { useState, type ChangeEvent } from "react";
import type { MapSummary } from "@/shared/mapProtocol";

type MapBrowserProps = {
  errorMessage: string | null;
  loading: boolean;
  maps: MapSummary[];
  onCreateMap: (name: string) => Promise<void>;
  onImportMap: (name: string, file: File) => Promise<void>;
  onOpenMap: (mapId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
};

export function MapBrowser({
  errorMessage,
  loading,
  maps,
  onCreateMap,
  onImportMap,
  onOpenMap,
  onRefresh
}: MapBrowserProps) {
  const [createName, setCreateName] = useState("Nouvelle map");
  const [importName, setImportName] = useState("Map importée");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [busyAction, setBusyAction] = useState<"create" | "import" | "open" | null>(null);

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setImportFile(file);

    if (file) {
      const fileName = file.name.replace(/\.json$/i, "").trim();
      if (fileName) {
        setImportName(fileName);
      }
    }
  };

  return (
    <main className="map-browser">
      <section className="map-browser-panel">
        <h1>Maps</h1>
        <p>Choisis une map serveur, crée-en une nouvelle, ou importe un JSON.</p>
        {errorMessage ? <p className="map-browser-error">{errorMessage}</p> : null}
        <div className="map-browser-actions">
          <button
            className="compact-button"
            disabled={loading || busyAction !== null}
            onClick={() => {
              setBusyAction("create");
              onCreateMap(createName).finally(() => setBusyAction(null));
            }}
            type="button"
          >
            Nouvelle map
          </button>
          <input
            onChange={(event) => setCreateName(event.target.value)}
            placeholder="Nom de la map"
            value={createName}
          />
        </div>
        <div className="map-browser-actions">
          <input accept="application/json" onChange={handleImportFile} type="file" />
          <input
            onChange={(event) => setImportName(event.target.value)}
            placeholder="Nom de la map importée"
            value={importName}
          />
          <button
            className="compact-button"
            disabled={loading || busyAction !== null || !importFile}
            onClick={() => {
              if (!importFile) {
                return;
              }

              setBusyAction("import");
              onImportMap(importName, importFile).finally(() => setBusyAction(null));
            }}
            type="button"
          >
            Importer JSON
          </button>
        </div>
        <div className="map-browser-list-header">
          <h2>Maps existantes</h2>
          <button
            className="compact-button"
            disabled={loading || busyAction !== null}
            onClick={() => {
              setBusyAction("open");
              onRefresh().finally(() => setBusyAction(null));
            }}
            type="button"
          >
            Rafraîchir
          </button>
        </div>
        <ul className="map-browser-list">
          {maps.map((map) => (
            <li key={map.id}>
              <div>
                <strong>{map.name}</strong>
                <span>{new Date(map.updatedAt).toLocaleString()}</span>
              </div>
              <button
                className="compact-button"
                disabled={loading || busyAction !== null}
                onClick={() => {
                  setBusyAction("open");
                  onOpenMap(map.id).finally(() => setBusyAction(null));
                }}
                type="button"
              >
                Ouvrir
              </button>
            </li>
          ))}
          {maps.length === 0 ? <li>Aucune map</li> : null}
        </ul>
      </section>
    </main>
  );
}
