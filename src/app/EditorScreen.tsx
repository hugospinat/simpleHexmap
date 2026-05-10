import { AppShell } from "./AppShell";
import { MapAssetsProvider } from "@/editor/context";
import { useEditorController } from "@/editor/hooks";
import { useObsidianNoteLauncher } from "@/app/hooks/useObsidianNoteLauncher";
import { BottomBar, MapPane, PlayerControls, Sidebar } from "@/ui/components";
import type { MapState } from "@/core/map/world";
import type { MapDocument } from "@/core/protocol";
import type { MapOpenMode, UserRecord, WorkspaceMember } from "@/core/auth/authTypes";

type EditorScreenProps = {
  initialDocument: MapDocument;
  initialWorld: MapState;
  mapId: string;
  mapName: string;
  workspaceMembers: WorkspaceMember[];
  user: UserRecord;
  role: MapOpenMode;
  onBackToMaps: () => void;
};

export function EditorScreen({
  initialDocument,
  initialWorld,
  mapId,
  mapName,
  workspaceMembers,
  user,
  role,
  onBackToMaps,
}: EditorScreenProps) {
  const editor = useEditorController({
    initialDocument,
    initialWorld,
    mapId,
    profile: user,
    role,
    workspaceMembers,
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

  const obsidianNotes = useObsidianNoteLauncher({
    activeMode: editor.activeMode,
    mapId,
    selectedHex: editor.selectedNoteHex,
  });

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
          onOpenSelectedNoteInObsidian={obsidianNotes.openSelectedNoteInObsidian}
          onRecolorFaction={editor.recolorFaction}
          onRedo={editor.redoLastOperationBatch}
          onRenameFaction={editor.renameFaction}
          onSelectFaction={editor.selectFaction}
          onClearMapTokenSelection={editor.clearMapTokenSelection}
          onMapTokenColorChange={editor.setMapTokenColor}
          onSelectMapToken={editor.selectWorkspaceMember}
          noteLaunchStatus={obsidianNotes.noteStatus}
          noteLaunchInFlight={obsidianNotes.isLaunching}
          selectedNoteHex={editor.selectedNoteHex}
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
