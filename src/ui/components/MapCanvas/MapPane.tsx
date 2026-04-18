import MapCanvas from "./MapCanvas";
import type { MapCanvasProps } from "./types";

export function MapPane(props: MapCanvasProps) {
  return (
    <section className="map-pane" aria-label="Map view">
      <MapCanvas {...props} />
    </section>
  );
}
