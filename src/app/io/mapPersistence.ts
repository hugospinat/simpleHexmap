import type { World } from "@/domain/world/world";
import {
  deserializeWorld,
  parseSavedMapText,
  serializeWorld,
  type SavedMap,
  type MapFactionRecord,
  type MapFactionTerritoryRecord,
  type MapFeatureRecord,
  type MapRiverRecord,
  type MapTileRecord
} from "@/app/io/mapFormat";
import { downloadSavedMapFile } from "@/app/io/mapFile";

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read map file."));
    reader.readAsText(file);
  });
}

export function saveMap(mapState: World): void {
  downloadSavedMapFile("map", serializeWorld(mapState));
}

export async function loadMap(file: File): Promise<World> {
  const text = await readFileAsText(file);
  const parsed = parseSavedMapText(text);

  return deserializeWorld(parsed);
}

export type {
  SavedMap,
  MapFactionRecord,
  MapFactionTerritoryRecord,
  MapFeatureRecord,
  MapRiverRecord,
  MapTileRecord
};
