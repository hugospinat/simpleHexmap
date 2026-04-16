import type { Axial } from "@/domain/geometry/hex";

type BottomBarProps = {
  center: Axial;
  hoveredHex: Axial | null;
  level: number;
  maxLevels: number;
  visualZoom: number;
};

function formatCenter(axial: Axial): string {
  return `${axial.q.toFixed(2)}, ${axial.r.toFixed(2)}`;
}

export function BottomBar({ center, hoveredHex, level, maxLevels, visualZoom }: BottomBarProps) {
  return (
    <footer className="status-bar" aria-label="Map status">
      <span>Level {level}/{maxLevels}</span>
      <span>Center {formatCenter(center)}</span>
      <span>{hoveredHex ? `Hex ${hoveredHex.q}, ${hoveredHex.r}` : "Hex -"}</span>
      <span>Zoom {visualZoom.toFixed(2)}x</span>
    </footer>
  );
}
