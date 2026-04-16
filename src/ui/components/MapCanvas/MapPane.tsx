import HexCanvas from "./HexCanvas";
import type { HexCanvasProps } from "./types";

export function MapPane(props: HexCanvasProps) {
  return (
    <section className="map-pane" aria-label="Map view">
      <HexCanvas {...props} />
    </section>
  );
}
