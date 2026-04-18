import HexCanvas from "./HexCanvas";
import PixiHexCanvas from "./PixiHexCanvas";
import type { HexCanvasProps } from "./types";

export function MapPane(props: HexCanvasProps) {
  const renderer = import.meta.env.VITE_RENDERER ?? "pixi";

  return (
    <section className="map-pane" aria-label="Map view">
      {renderer === "pixi" ? <PixiHexCanvas {...props} /> : <HexCanvas {...props} />}
    </section>
  );
}
