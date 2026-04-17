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
      await writeMapToFile(session.map);
    } catch (error) {
      console.error("Failed to persist map", session.map.id, error);
    }
  }, persistDebounceMs);
}
