import type { EditorMode } from "@/editor/tools/editorTypes";

type ToolTabsProps = {
  activeMode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
};

const tabs: { label: string; mode: EditorMode }[] = [
  { label: "Terrain", mode: "terrain" },
  { label: "Features", mode: "feature" },
  { label: "Rivers", mode: "river" },
  { label: "Roads", mode: "road" },
  { label: "Factions", mode: "faction" }
];

export function ToolTabs({ activeMode, onModeChange }: ToolTabsProps) {
  return (
    <div className="tool-tabs" role="tablist" aria-label="Editing mode">
      {tabs.map(({ label, mode }) => (
        <button
          type="button"
          key={mode}
          role="tab"
          aria-selected={activeMode === mode}
          className={activeMode === mode ? "tab-button is-active" : "tab-button"}
          onClick={() => onModeChange(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
