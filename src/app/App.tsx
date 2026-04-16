import { AppShell } from "./AppShell";
import { BottomBar } from "@/ui/components/BottomBar/BottomBar";
import { FeatureInspector } from "@/ui/components/FeatureInspector/FeatureInspector";
import { MapPane } from "@/ui/components/MapCanvas/MapPane";
import { Sidebar } from "@/ui/components/Sidebar/Sidebar";
import { useEditorState } from "@/editor/hooks/useEditorState";

export default function App() {
  const editor = useEditorState();

  return (
    <AppShell appRef={editor.appRef} inspectorOpen={Boolean(editor.selectedFeature)}>
      <Sidebar
        activeFeatureKind={editor.activeFeatureKind}
        activeMode={editor.activeMode}
        activeType={editor.activeType}
        onFeatureKindChange={editor.chooseFeatureKind}
        onModeChange={editor.setActiveMode}
        onTileTypeChange={editor.setActiveType}
      />
      <MapPane {...editor.canvasProps} />
      {editor.selectedFeature ? (
        <FeatureInspector
          canEditStructure={editor.view.level === 3}
          feature={editor.selectedFeature}
          onChange={editor.updateSelectedFeature}
          onClose={editor.clearSelectedFeature}
          onDelete={editor.deleteSelectedFeature}
        />
      ) : null}
      <BottomBar
        center={editor.view.center}
        hoveredHex={editor.hoveredHex}
        level={editor.view.level}
        maxLevels={editor.maxLevels}
        visualZoom={editor.visualZoom}
      />
    </AppShell>
  );
}
