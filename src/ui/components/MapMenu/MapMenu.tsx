import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import type { MapSummary } from "@/app/io/mapApi";

export type OpenMapRole = "gm" | "player";

type MapMenuProps = {
  errorMessage: string | null;
  isBusy: boolean;
  maps: MapSummary[];
  selectedMapId: string | null;
  onCreateMap: (name: string) => Promise<void>;
  onExportMap: (mapId: string) => Promise<void>;
  onImportMap: (file: File) => Promise<void>;
  onOpenMap: (mapId: string, role: OpenMapRole) => Promise<void>;
  onRenameMap: (mapId: string, name: string) => Promise<void>;
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
  onRenameMap,
  onRefresh,
  onSelectMap
}: MapMenuProps) {
  const [newMapName, setNewMapName] = useState("");
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
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

  const beginRename = (map: MapSummary) => {
    onSelectMap(map.id);
    setEditingMapId(map.id);
    setEditingName(map.name);
  };

  const cancelRename = () => {
    setEditingMapId(null);
    setEditingName("");
  };

  const commitRename = async (map: MapSummary) => {
    const trimmedName = editingName.trim();

    if (!trimmedName || trimmedName === map.name) {
      cancelRename();
      return;
    }

    await onRenameMap(map.id, trimmedName);
    cancelRename();
  };

  const onRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, map: MapSummary) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename(map);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
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
            onClick={() => selectedMap ? void onOpenMap(selectedMap.id, "player") : undefined}
            disabled={isBusy || !selectedMap}
          >
            Open selected
          </button>
          <button
            type="button"
            className="compact-button"
            onClick={() => selectedMap ? void onOpenMap(selectedMap.id, "gm") : undefined}
            disabled={isBusy || !selectedMap}
          >
            Open selected as GM
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
                const isRenaming = editingMapId === map.id;

                return (
                  <li
                    key={map.id}
                    className={isSelected ? "map-list-item is-selected" : "map-list-item"}
                    onClick={() => onSelectMap(map.id)}
                  >
                    <div className="map-list-main">
                      <input
                        className="map-list-select"
                        type="radio"
                        name="selected-map"
                        checked={isSelected}
                        onChange={() => onSelectMap(map.id)}
                      />
                      {isRenaming ? (
                        <input
                          className="map-name-input"
                          type="text"
                          value={editingName}
                          autoFocus
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => setEditingName(event.currentTarget.value)}
                          onBlur={() => {
                            void commitRename(map);
                          }}
                          onKeyDown={(event) => onRenameKeyDown(event, map)}
                          disabled={isBusy}
                        />
                      ) : (
                        <button
                          type="button"
                          className="map-name-button"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginRename(map);
                          }}
                          disabled={isBusy}
                        >
                          {map.name}
                        </button>
                      )}
                    </div>
                    <span className="map-list-date">{formatUpdatedAt(map.updatedAt)}</span>
                    <button
                      type="button"
                      className="compact-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onOpenMap(map.id, "player");
                      }}
                      disabled={isBusy}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="compact-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onOpenMap(map.id, "gm");
                      }}
                      disabled={isBusy}
                    >
                      Open as GM
                    </button>
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
