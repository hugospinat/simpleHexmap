import type { SavedMap } from "@/app/io/mapFormat";
import { parseSavedMapText } from "@/app/io/mapFormat";

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read map file."));
    reader.readAsText(file);
  });
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim();
  const normalized = trimmed.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "");
  return normalized || "map";
}

export async function readSavedMapFile(file: File): Promise<SavedMap> {
  const text = await readFileAsText(file);
  return parseSavedMapText(text);
}

export function downloadSavedMapFile(name: string, map: SavedMap): void {
  const fileName = `${sanitizeFileName(name)}.json`;
  const blob = new Blob([`${JSON.stringify(map, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
