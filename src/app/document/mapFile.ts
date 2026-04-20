import type { MapDocument } from "@/core/protocol";
import { parseMapDocumentText } from "@/core/document/savedMapCodec";

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

export async function readMapDocumentFile(file: File): Promise<MapDocument> {
  const text = await readFileAsText(file);
  return parseMapDocumentText(text);
}

export function downloadMapDocumentFile(name: string, map: MapDocument): void {
  const fileName = `${sanitizeFileName(name)}.json`;
  const blob = new Blob([`${JSON.stringify(map, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
