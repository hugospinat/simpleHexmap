import { AppShell } from "./AppShell";
import { BottomBar } from "@/ui/components/BottomBar/BottomBar";
import { MapPane } from "@/ui/components/MapCanvas/MapPane";
import { PlayerControls } from "@/ui/components/PlayerControls/PlayerControls";
import { Sidebar } from "@/ui/components/Sidebar/Sidebar";
import { useEditorController } from "@/editor/hooks/useEditorController";
import { MapAssetsProvider } from "@/editor/context/MapAssetsContext";
import type { MapState } from "@/core/map/world";
import type { MapOpenMode, UserRecord, WorkspaceMember } from "@/core/auth/authTypes";

type EditorScreenProps = {
  initialWorld: MapState;
  mapId: string;
  mapName: string;
  workspaceMembers: WorkspaceMember[];
  user: UserRecord;
  role: MapOpenMode;
  onBackToMaps: () => void;
};

export function EditorScreen({ initialWorld, mapId, mapName, workspaceMembers, user, role, onBackToMaps }: EditorScreenProps) {
  const editor = useEditorController({
    initialWorld,
    mapId,
    profile: user,
    role,
    workspaceMembers
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
          activeTokenUserId={editor.activeTokenUserId}
          activeType={editor.activeType}
          factions={editor.factions}
          workspaceMembers={editor.workspaceMembers}
          tokenPlacements={editor.tokenPlacements}
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
          onClearMapTokenSelection={editor.clearMapTokenSelection}
          onSelectMapToken={editor.selectWorkspaceMember}
          onTileTypeChange={editor.setActiveType}
          onUndo={editor.undoLastOperationBatch}
        />
        <MapPane {...editor.canvasProps} />
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
