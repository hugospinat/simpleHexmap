import { useState } from "react";
import type { FeatureKind } from "@/domain/world/features";
import type { Faction, TerrainType } from "@/domain/world/world";
import type { EditorMode } from "@/editor/tools/editorTypes";
import { FeaturePalette } from "../FeaturePalette/FeaturePalette";
import { TilePalette } from "../TilePalette/TilePalette";
import { ToolTabs } from "../ToolTabs/ToolTabs";

type SidebarProps = {
  activeFactionId: string | null;
  activeFeatureKind: FeatureKind;
  activeMode: EditorMode;
  activeType: TerrainType;
  factions: Faction[];
  mapName: string;
  onBackToMaps: () => void;
  onCreateFaction: () => void;
  onDeleteFaction: (factionId: string) => void;
  onFeatureKindChange: (type: FeatureKind) => void;
  onModeChange: (mode: EditorMode) => void;
  onRecolorFaction: (factionId: string, color: string) => void;
  onRenameFaction: (factionId: string, name: string) => void;
  onSaveMap: () => void;
  onSelectFaction: (factionId: string | null) => void;
  onTileTypeChange: (type: TerrainType) => void;
};

export function Sidebar({
  activeFactionId,
  activeFeatureKind,
  activeMode,
  activeType,
  factions,
  mapName,
  onBackToMaps,
  onCreateFaction,
  onDeleteFaction,
  onFeatureKindChange,
  onModeChange,
  onRecolorFaction,
  onRenameFaction,
  onSaveMap,
  onSelectFaction,
  onTileTypeChange
}: SidebarProps) {
  const [editingFactionId, setEditingFactionId] = useState<string | null>(null);
  const [editingFactionName, setEditingFactionName] = useState("");

  const startFactionNameEdit = (factionId: string, currentName: string) => {
    setEditingFactionId(factionId);
    setEditingFactionName(currentName);
  };

  const cancelFactionNameEdit = () => {
    setEditingFactionId(null);
    setEditingFactionName("");
  };

  const commitFactionName = (factionId: string, rawName: string) => {
    const name = rawName.trim();

    if (!name) {
      cancelFactionNameEdit();
      return;
    }

    onRenameFaction(factionId, name);
    cancelFactionNameEdit();
  };

  return (
    <aside className="sidebar" aria-label="Map editor tools">
      <div className="brand">
        <span className="eyebrow">OSR CARTOGRAPHY</span>
        <h1>Hex Map</h1>
        <p>{mapName}</p>
        <button type="button" className="compact-button" onClick={onBackToMaps}>Back to maps</button>
      </div>

      <section className="panel tool-panel">
        <h2>Tool</h2>
        <ToolTabs activeMode={activeMode} onModeChange={onModeChange} />
      </section>

      {activeMode === "terrain" ? (
        <TilePalette activeType={activeType} onTypeChange={onTileTypeChange} />
      ) : activeMode === "feature" ? (
        <FeaturePalette
          activeKind={activeFeatureKind}
          onKindChange={onFeatureKindChange}
        />
      ) : activeMode === "river" ? (
        <section className="panel river-panel">
          <h2>Rivers</h2>
          <div className="active-tile">
            <span>Brush</span>
            <strong>Edge Flow</strong>
          </div>
          <p>Left click and drag to paint rivers on hex edges. Right click and drag to erase.</p>
        </section>
      ) : activeMode === "road" ? (
        <section className="panel road-panel">
          <h2>Roads</h2>
          <div className="active-tile">
            <span>Brush</span>
            <strong>Edge Path</strong>
          </div>
          <p>Left click and drag across neighboring hexes to place road edges. Right click a road hex to remove it.</p>
        </section>
      ) : (
        <section className="panel faction-panel">
          <h2>Factions</h2>
          <div className="faction-actions">
            <button type="button" className="compact-button" onClick={onCreateFaction}>Create faction</button>
            {activeFactionId ? (
              <button type="button" className="compact-button" onClick={() => onSelectFaction(null)}>Clear selection</button>
            ) : null}
          </div>
          {factions.length === 0 ? (
            <p>No factions yet. Create one, then paint with left click.</p>
          ) : (
            <ul className="faction-list" aria-label="Faction list">
              {factions.map((faction) => (
                <li
                  key={faction.id}
                  className={activeFactionId === faction.id ? "faction-item is-active" : "faction-item"}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeleteFaction(faction.id);
                  }}
                >
                  <div className="faction-row">
                    <button
                      type="button"
                      className="faction-select-box"
                      aria-label={`Select ${faction.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectFaction(faction.id);
                      }}
                    />
                    {editingFactionId === faction.id ? (
                      <input
                        type="text"
                        className="faction-name-input"
                        value={editingFactionName}
                        autoFocus
                        onChange={(event) => setEditingFactionName(event.currentTarget.value)}
                        onBlur={() => commitFactionName(faction.id, editingFactionName)}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            commitFactionName(faction.id, editingFactionName);
                            return;
                          }

                          if (event.key === "Escape") {
                            cancelFactionNameEdit();
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="faction-name-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startFactionNameEdit(faction.id, faction.name);
                        }}
                      >
                        {faction.name}
                      </button>
                    )}
                    <input
                      type="color"
                      className="faction-color-input"
                      value={faction.color}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onRecolorFaction(faction.id, event.currentTarget.value)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p>Left click assigns the selected faction, right click clears the faction mark.</p>
        </section>
      )}

      <section className="panel data-panel">
        <h2>Data</h2>
        <div className="data-actions">
          <button type="button" className="compact-button" onClick={onSaveMap}>Save</button>
        </div>
      </section>
    </aside>
  );
}
