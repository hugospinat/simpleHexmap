import type { Axial } from "@/core/geometry/hex";

type BottomBarProps = {
  center: Axial;
  hoveredHex: Axial | null;
  level: number;
  maxLevels: number;
  syncStatus: "connecting" | "saving" | "saved" | "error";
  visualZoom: number;
};

function formatCenter(axial: Axial): string {
  return `${axial.q.toFixed(2)}, ${axial.r.toFixed(2)}`;
}

function formatSyncStatus(syncStatus: BottomBarProps["syncStatus"]): string {
  switch (syncStatus) {
    case "connecting":
      return "Connecting...";
    case "saving":
      return "Saving...";
    case "error":
      return "Sync error";
    case "saved":
      return "Saved";
    default: {
      const exhaustive: never = syncStatus;
      return exhaustive;
    }
  }
}

export function BottomBar({ center, hoveredHex, level, maxLevels, syncStatus, visualZoom }: BottomBarProps) {
  return (
    <footer className="status-bar" aria-label="Map status">
      <span>Level {level}/{maxLevels}</span>
      <span>Center {formatCenter(center)}</span>
      <span>{hoveredHex ? `Hex ${hoveredHex.q}, ${hoveredHex.r}` : "Hex -"}</span>
      <span>Data {formatSyncStatus(syncStatus)}</span>
      <span>Zoom {visualZoom.toFixed(2)}x</span>
    </footer>
  );
}
