import { useState } from "react";
import type { FeatureKind } from "@/core/map/features";
import type { Faction, TerrainType } from "@/core/map/world";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { MapTokenRecord } from "@/core/protocol";
import type { WorkspaceTokenMemberRecord } from "@/core/auth/authTypes";
import { FeaturePalette } from "../FeaturePalette/FeaturePalette";
import { TilePalette } from "../TilePalette/TilePalette";
import { ToolTabs } from "../ToolTabs/ToolTabs";

type SidebarProps = {
  activeFactionId: string | null;
  activeFeatureKind: FeatureKind;
  activeMode: EditorMode;
  activeTokenProfileId: string | null;
  activeType: TerrainType;
  factions: Faction[];
  mapTokens: MapTokenRecord[];
  tokenMembers: WorkspaceTokenMemberRecord[];
  mapName: string;
  onBackToMaps: () => void;
  onCreateFaction: () => void;
  onDeleteFaction: (factionId: string) => void;
  onFeatureKindChange: (type: FeatureKind) => void;
  onModeChange: (mode: EditorMode) => void;
  onRecolorFaction: (factionId: string, color: string) => void;
  onRedo: () => void;
  onRenameFaction: (factionId: string, name: string) => void;
  onClearMapTokenSelection: () => void;
  onSelectFaction: (factionId: string | null) => void;
  onSelectMapToken: (member: WorkspaceTokenMemberRecord) => void;
  onTileTypeChange: (type: TerrainType) => void;
  onUndo: () => void;
};

export function Sidebar({
  activeFactionId,
  activeFeatureKind,
  activeMode,
  activeTokenProfileId,
  activeType,
  factions,
  mapTokens,
  tokenMembers,
  mapName,
  onBackToMaps,
  onCreateFaction,
  onDeleteFaction,
  onFeatureKindChange,
  onModeChange,
  onRecolorFaction,
  onRedo,
  onRenameFaction,
  onClearMapTokenSelection,
  onSelectFaction,
  onSelectMapToken,
  onTileTypeChange,
  onUndo
}: SidebarProps) {
  const [editingFactionId, setEditingFactionId] = useState<string | null>(null);
  const [editingFactionName, setEditingFactionName] = useState("");

  const getTokenDisplayName = (profileId: string): string => {
    return tokenMembers.find((member) => member.userId === profileId)?.username ?? profileId;
  };

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
        <h1>Simple Hex</h1>
        <p>{mapName}</p>
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
      ) : activeMode === "fog" ? (
        <section className="panel fog-panel">
          <h2>Fog</h2>
          <div className="active-tile">
            <span>Brush</span>
            <strong>Visibility</strong>
          </div>
          {activeTokenProfileId ? (
            <>
              <div className="active-tile">
                <span>Selected token</span>
                <strong>{getTokenDisplayName(activeTokenProfileId)}</strong>
              </div>
              <div className="faction-actions">
                <button type="button" className="compact-button" onClick={onClearMapTokenSelection}>Clear selection</button>
              </div>
              <p>Token selected: left click places it on level 3, right click removes the clicked visible token. Click the same token in the list to deselect.</p>
            </>
          ) : (
            <p>Left click toggles terrain fog for a cell. Right click toggles hidden state on features in the cell.</p>
          )}

          {tokenMembers.length === 0 ? (
            <p>No workspace member available for token placement.</p>
          ) : (
            <ul className="token-list" aria-label="Map token list">
              {tokenMembers.map((member) => {
                const placedToken = mapTokens.find((token) => token.profileId === member.userId);

                return (
                <li
                  key={member.userId}
                  className={activeTokenProfileId === member.userId ? "token-item is-active" : "token-item"}
                >
                  <button
                    type="button"
                    className="token-select-button"
                    onClick={() => onSelectMapToken(member)}
                  >
                    <span
                      className="token-color-swatch"
                      aria-hidden="true"
                      style={{ backgroundColor: member.color }}
                    />
                    <span className="token-profile-id">{member.username}</span>
                    <span className="token-status">{placedToken ? "Placed" : "Not placed"}</span>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
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

      <section className="sidebar-footer" aria-label="History actions">
        <button type="button" className="compact-button sidebar-back-button" onClick={onBackToMaps}>Back to maps</button>
        <div className="sidebar-history-actions">
          <button type="button" className="compact-button" onClick={onUndo}>Undo</button>
          <button type="button" className="compact-button" onClick={onRedo}>Redo</button>
        </div>
      </section>
    </aside>
  );
}
