import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { MapSummary } from "@/app/io/mapApi";

type MapMenuProps = {
  errorMessage: string | null;
  isBusy: boolean;
  maps: MapSummary[];
  selectedMapId: string | null;
  onCreateMap: (name: string) => Promise<void>;
  onExportMap: (mapId: string) => Promise<void>;
  onImportMap: (file: File) => Promise<void>;
  onOpenMap: (mapId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectMap: (mapId: string) => void;
};

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export function MapMenu({
  errorMessage,
  isBusy,
  maps,
  selectedMapId,
  onCreateMap,
  onExportMap,
  onImportMap,
  onOpenMap,
  onRefresh,
  onSelectMap
}: MapMenuProps) {
  const [newMapName, setNewMapName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreateMap(newMapName);
    setNewMapName("");
  };

  const selectedMap = selectedMapId ? maps.find((map) => map.id === selectedMapId) ?? null : null;

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await onImportMap(file);
    event.currentTarget.value = "";
  };

  return (
    <main className="map-menu" aria-label="Map browser">
      <section className="map-menu-panel">
        <header className="map-menu-header">
          <span className="eyebrow">OSR CARTOGRAPHY</span>
          <h1>Maps</h1>
          <p>Choose a map to edit, create a new one, or import/export JSON files.</p>
        </header>

        <form className="map-create-form" onSubmit={submitCreate}>
          <label htmlFor="new-map-name">New map</label>
          <div className="map-create-row">
            <input
              id="new-map-name"
              type="text"
              value={newMapName}
              placeholder="Map name"
              onChange={(event) => setNewMapName(event.currentTarget.value)}
            />
            <button type="submit" className="compact-button" disabled={isBusy}>Create</button>
          </div>
        </form>

        <section className="map-menu-actions" aria-label="Map actions">
          <button type="button" className="compact-button" onClick={() => void onRefresh()} disabled={isBusy}>Refresh</button>
          <button
            type="button"
            className="compact-button"
            onClick={() => selectedMap ? void onOpenMap(selectedMap.id) : undefined}
            disabled={isBusy || !selectedMap}
          >
            Open selected
          </button>
          <button
            type="button"
            className="compact-button"
            onClick={() => selectedMap ? void onExportMap(selectedMap.id) : undefined}
            disabled={isBusy || !selectedMap}
          >
            Export selected
          </button>
          <button type="button" className="compact-button" onClick={() => fileInputRef.current?.click()} disabled={isBusy}>Import JSON</button>
          <input
            ref={fileInputRef}
            className="file-input-hidden"
            type="file"
            accept="application/json,.json"
            onChange={onFileSelected}
          />
        </section>

        {errorMessage ? <p className="map-menu-error">{errorMessage}</p> : null}

        <section className="map-list-panel" aria-label="Available maps">
          {maps.length === 0 ? (
            <p>No maps yet. Create one or import a JSON map.</p>
          ) : (
            <ul className="map-list">
              {maps.map((map) => {
                const isSelected = selectedMapId === map.id;

                return (
                  <li key={map.id} className={isSelected ? "map-list-item is-selected" : "map-list-item"}>
                    <label>
                      <input
                        type="radio"
                        name="selected-map"
                        checked={isSelected}
                        onChange={() => onSelectMap(map.id)}
                      />
                      <span className="map-list-name">{map.name}</span>
                    </label>
                    <span className="map-list-date">{formatUpdatedAt(map.updatedAt)}</span>
                    <button type="button" className="compact-button" onClick={() => void onOpenMap(map.id)} disabled={isBusy}>Open</button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
