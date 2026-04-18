import type { SavedMapContent } from "@/core/document/savedMapTypes";
import { parseSavedMapContentText } from "@/core/document/savedMapCodec";

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
  const normalized = trimmed
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "map";
}

export async function readSavedMapContentFile(file: File): Promise<SavedMapContent> {
  const text = await readFileAsText(file);
  return parseSavedMapContentText(text);
}

export function downloadSavedMapContentFile(name: string, map: SavedMapContent): void {
  const fileName = `${sanitizeFileName(name)}.json`;
  const blob = new Blob([`${JSON.stringify(map, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
