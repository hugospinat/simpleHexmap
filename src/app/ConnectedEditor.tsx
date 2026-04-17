import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "./AppShell";
import { BottomBar } from "@/ui/components/BottomBar/BottomBar";
import { FeatureInspector } from "@/ui/components/FeatureInspector/FeatureInspector";
import { MapPane } from "@/ui/components/MapCanvas/MapPane";
import { Sidebar } from "@/ui/components/Sidebar/Sidebar";
import { useEditorState } from "@/editor/hooks/useEditorState";
import type { World } from "@/domain/world/world";
import { openMapSocket } from "@/client/mapSocket";

type ConnectedEditorProps = {
  map: {
    id: string;
    name: string;
    updatedAt: string;
    world: World;
  };
  onBack: () => void;
};

export function ConnectedEditor({ map, onBack }: ConnectedEditorProps) {
  const [serverWorld, setServerWorld] = useState<World>(map.world);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(map.updatedAt);
  const socketRef = useRef<ReturnType<typeof openMapSocket> | null>(null);
  const handleWorldCommitted = useCallback((nextWorld: World) => {
    socketRef.current?.sendMapUpdate(nextWorld);
  }, []);
  const editor = useEditorState({
    initialWorld: serverWorld,
    onWorldCommitted: handleWorldCommitted
  });

  useEffect(() => {
    setServerWorld(map.world);
    setLastUpdatedAt(map.updatedAt);
  }, [map.id, map.updatedAt, map.world]);

  useEffect(() => {
    setStatus("connecting");
    const socket = openMapSocket({
      mapId: map.id,
      onWorld: (nextWorld, updatedAt) => {
        setServerWorld(nextWorld);
        if (updatedAt) {
          setLastUpdatedAt(updatedAt);
        }
      }
    });
    socketRef.current = socket;

    const timer = window.setTimeout(() => setStatus("connected"), 300);

    return () => {
      window.clearTimeout(timer);
      socketRef.current = null;
      socket.close();
      setStatus("disconnected");
    };
  }, [map.id]);

  return (
    <>
      <div className="map-session-bar">
        <button className="compact-button" onClick={onBack} type="button">← Retour aux maps</button>
        <strong>{map.name}</strong>
        <span>{status} · maj {new Date(lastUpdatedAt).toLocaleString()}</span>
      </div>
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
    </>
  );
}
