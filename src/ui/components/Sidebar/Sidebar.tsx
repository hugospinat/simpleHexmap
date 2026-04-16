import type { FeatureKind } from "@/domain/world/features";
import type { TerrainType } from "@/domain/world/world";
import type { EditorMode } from "@/editor/tools/editorTypes";
import { FeaturePalette } from "../FeaturePalette/FeaturePalette";
import { TilePalette } from "../TilePalette/TilePalette";
import { ToolTabs } from "../ToolTabs/ToolTabs";

type SidebarProps = {
  activeFeatureKind: FeatureKind;
  activeMode: EditorMode;
  activeType: TerrainType;
  onFeatureKindChange: (type: FeatureKind) => void;
  onModeChange: (mode: EditorMode) => void;
  onTileTypeChange: (type: TerrainType) => void;
};

export function Sidebar({
  activeFeatureKind,
  activeMode,
  activeType,
  onFeatureKindChange,
  onModeChange,
  onTileTypeChange
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Map editor tools">
      <div className="brand">
        <span className="eyebrow">OSR CARTOGRAPHY</span>
        <h1>Hex Map</h1>
        <p>Ink terrain and notes onto sparse nested levels.</p>
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
      ) : (
        <section className="panel road-panel">
          <h2>Roads</h2>
          <div className="active-tile">
            <span>Brush</span>
            <strong>Edge Path</strong>
          </div>
          <p>Left click and drag across neighboring hexes to place road edges. Right click a road hex to remove it.</p>
        </section>
      )}
    </aside>
  );
}
