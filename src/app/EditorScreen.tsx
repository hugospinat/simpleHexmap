import { AppShell } from "./AppShell";
import { BottomBar } from "@/ui/components/BottomBar/BottomBar";
import { FeatureLabelPopup } from "@/ui/components/FeatureLabelPopup/FeatureLabelPopup";
import { MapPane } from "@/ui/components/MapCanvas/MapPane";
import { PlayerControls } from "@/ui/components/PlayerControls/PlayerControls";
import { Sidebar } from "@/ui/components/Sidebar/Sidebar";
import { useEditorController } from "@/editor/hooks/useEditorController";
import { MapAssetsProvider } from "@/editor/context/MapAssetsContext";
import type { MapState } from "@/core/map/world";
import type { ProfileRecord } from "@/core/profile/profileTypes";
import type { ViewerRole } from "@/ui/components/MapMenu/MapMenu";

type EditorScreenProps = {
  initialWorld: MapState;
  mapId: string;
  mapName: string;
  profile: ProfileRecord;
  role: ViewerRole;
  onBackToMaps: () => void;
};

export function EditorScreen({ initialWorld, mapId, mapName, profile, role, onBackToMaps }: EditorScreenProps) {
  const editor = useEditorController({
    initialWorld,
    mapId,
    profile,
    role
  });

  if (role === "player") {
    return (
      <MapAssetsProvider>
        <AppShell appRef={editor.appRef} playerMode>
          <MapPane {...editor.canvasProps} />
          <PlayerControls
            tokenColor={editor.playerTokenColor}
            onBackToMaps={onBackToMaps}
            onTokenColorChange={editor.setPlayerTokenColor}
          />
        </AppShell>
      </MapAssetsProvider>
    );
  }

  return (
    <MapAssetsProvider>
      <AppShell appRef={editor.appRef}>
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
          onRedo={editor.redoLastOperationBatch}
          onRenameFaction={editor.renameFaction}
          onSelectFaction={editor.selectFaction}
          onTileTypeChange={editor.setActiveType}
          onUndo={editor.undoLastOperationBatch}
        />
        <MapPane {...editor.canvasProps} />
        {editor.selectedFeature ? (
          <FeatureLabelPopup
            feature={editor.selectedFeature}
            onChange={editor.updateSelectedFeatureLabels}
            onClose={editor.clearSelectedFeature}
          />
        ) : null}
        <BottomBar
          center={editor.view.center}
          hoveredHex={editor.hoveredHex}
          level={editor.view.level}
          maxLevels={editor.maxLevels}
          syncStatus={editor.syncStatus}
          visualZoom={editor.visualZoom}
        />
      </AppShell>
    </MapAssetsProvider>
  );
}
