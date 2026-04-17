import { writeMapToFile } from "./mapStorage.js";
import type { MapSession } from "./types.js";

export const persistDebounceMs = 400;

export function schedulePersist(session: MapSession): void {
  if (session.persistTimer) {
    clearTimeout(session.persistTimer);
  }

  session.persistTimer = setTimeout(async () => {
    session.persistTimer = null;

    try {
      const startedAtMs = performance.now();
      await writeMapToFile(session.map);
      const durationMs = performance.now() - startedAtMs;

      if (process.env.HEXMAP_PERF_DEBUG === "1" || durationMs >= 50) {
        console.info("[MapSyncServer] perf", {
          event: "persist_map",
          durationMs: Number(durationMs.toFixed(2)),
          mapId: session.map.id,
          tileCount: session.map.content.tiles.length,
          byteEstimate: Buffer.byteLength(JSON.stringify(session.map), "utf8")
        });
      }
    } catch (error) {
      console.error("Failed to persist map", session.map.id, error);
    }
  }, persistDebounceMs);
}
