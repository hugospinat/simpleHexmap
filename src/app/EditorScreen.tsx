import { AppShell } from "./AppShell";
import { BottomBar } from "@/ui/components/BottomBar/BottomBar";
import { FeatureInspector } from "@/ui/components/FeatureInspector/FeatureInspector";
import { MapPane } from "@/ui/components/MapCanvas/MapPane";
import { Sidebar } from "@/ui/components/Sidebar/Sidebar";
import { useEditorState } from "@/editor/hooks/useEditorState";
import { MapAssetsProvider } from "@/editor/context/MapAssetsContext";
import { SOURCE_LEVEL } from "@/domain/world/mapRules";
import type { World } from "@/domain/world/world";
import type { ViewerRole } from "@/ui/components/MapMenu/MapMenu";

type EditorScreenProps = {
  initialWorld: World;
  mapId: string;
  mapName: string;
  role: ViewerRole;
  onBackToMaps: () => void;
};

export function EditorScreen({ initialWorld, mapId, mapName, role, onBackToMaps }: EditorScreenProps) {
  const editor = useEditorState({
    initialWorld,
    mapId,
    role
  });

  if (role === "player") {
    return (
      <MapAssetsProvider>
        <AppShell appRef={editor.appRef} playerMode>
          <MapPane {...editor.canvasProps} />
        </AppShell>
      </MapAssetsProvider>
    );
  }

  return (
    <MapAssetsProvider>
      <AppShell appRef={editor.appRef} inspectorOpen={Boolean(editor.selectedFeature)}>
        <Sidebar
          activeFactionId={editor.activeFactionId}
          activeFeatureKind={editor.activeFeatureKind}
          activeMode={editor.activeMode}
          activeType={editor.activeType}
          factions={editor.factions}
          mapName={mapName}
          onBackToMaps={onBackToMaps}
          onCreateFaction={editor.createFaction}
          onDeleteFaction={editor.deleteFaction}
          onFeatureKindChange={editor.chooseFeatureKind}
          onModeChange={editor.setActiveMode}
          onRecolorFaction={editor.recolorFaction}
          onRenameFaction={editor.renameFaction}
          onSelectFaction={editor.selectFaction}
          syncStatus={editor.syncStatus}
          onTileTypeChange={editor.setActiveType}
        />
        <MapPane {...editor.canvasProps} />
        {editor.selectedFeature ? (
          <FeatureInspector
            canEditStructure={editor.view.level === SOURCE_LEVEL}
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
    </MapAssetsProvider>
  );
}
