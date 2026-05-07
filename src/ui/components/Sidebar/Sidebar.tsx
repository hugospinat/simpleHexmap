import { useState } from "react";
import type { FeatureKind } from "@/core/map/features";
import type { Faction, TerrainType } from "@/core/map/world";
import type { EditorMode } from "@/editor/tools";
import type { MapTokenPlacement } from "@/core/protocol";
import type { WorkspaceMember } from "@/core/auth/authTypes";
import { FeaturePalette } from "../FeaturePalette/FeaturePalette";
import { TilePalette } from "../TilePalette/TilePalette";
import { ToolTabs } from "../ToolTabs/ToolTabs";

type SidebarProps = {
  activeFactionId: string | null;
  activeFeatureKind: FeatureKind;
  activeMode: EditorMode;
  activeTokenUserId: string | null;
  activeType: TerrainType;
  factions: Faction[];
  tokenPlacements: MapTokenPlacement[];
  workspaceMembers: WorkspaceMember[];
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
  onSelectMapToken: (member: WorkspaceMember) => void;
  onTileTypeChange: (type: TerrainType) => void;
  onUndo: () => void;
};

export function Sidebar({
  activeFactionId,
  activeFeatureKind,
  activeMode,
  activeTokenUserId,
  activeType,
  factions,
  tokenPlacements,
  workspaceMembers,
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

  const getTokenDisplayName = (userId: string): string => {
    return workspaceMembers.find((member) => member.userId === userId)?.username ?? userId;
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

  const tokenPanel = (
    <section className="panel token-panel">
      <h2>Tokens</h2>
      {activeTokenUserId ? (
        <>
          <div className="active-tile">
            <span>Selected token</span>
            <strong>{getTokenDisplayName(activeTokenUserId)}</strong>
          </div>
          <div className="faction-actions">
            <button type="button" className="compact-button" onClick={onClearMapTokenSelection}>Clear selection</button>
          </div>
          <p>Left click places the selected token on level 3. Right click removes the clicked visible token.</p>
        </>
      ) : (
        <p>Select a workspace member, then left click on level 3 to place that token. Right click a visible token to remove it.</p>
      )}

      {workspaceMembers.length === 0 ? (
        <p>No workspace member available for token placement.</p>
      ) : (
        <ul className="token-list" aria-label="Map token list">
          {workspaceMembers.map((member) => {
            const placedToken = tokenPlacements.find((token) => token.userId === member.userId);

            return (
            <li
              key={member.userId}
              className={activeTokenUserId === member.userId ? "token-item is-active" : "token-item"}
            >
              <button
                type="button"
                className="token-select-button"
                onClick={() => onSelectMapToken(member)}
              >
                <span
                  className="token-color-swatch"
                  aria-hidden="true"
                  style={{ backgroundColor: member.tokenColor }}
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
  );

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
          <p>Left click edits terrain fog. Right click edits feature visibility. The first valid cell locks hide or reveal for the whole drag.</p>
        </section>
      ) : activeMode === "token" ? (
        tokenPanel
      ) : activeMode === "notes" ? (
        <section className="panel note-tool-panel">
          <h2>Notes</h2>
          <div className="active-tile">
            <span>Mode</span>
            <strong>GM markdown notes</strong>
          </div>
          <p>Left click a hex to open its note in the right panel. Save or clear the note from that panel.</p>
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
