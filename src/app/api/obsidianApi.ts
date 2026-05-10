import { buildApiUrl } from "@/app/api/apiBase";
import type { ObsidianNoteLaunchPayload } from "@/core/protocol";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseObsidianLaunchPayload(payload: unknown): ObsidianNoteLaunchPayload {
  if (
    !isObject(payload) ||
    typeof payload.protocolUrl !== "string" ||
    typeof payload.noteUrl !== "string" ||
    typeof payload.tokenExpiresAt !== "string" ||
    !isObject(payload.snapshot)
  ) {
    throw new Error("Invalid Obsidian launch response.");
  }

  return payload as unknown as ObsidianNoteLaunchPayload;
}

export async function requestObsidianNoteLaunch(
  mapId: string,
  q: number,
  r: number,
): Promise<ObsidianNoteLaunchPayload> {
  const response = await fetch(
    buildApiUrl(`/api/maps/${encodeURIComponent(mapId)}/obsidian/launch`),
    {
      body: JSON.stringify({ q, r }),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const errorMessage =
      isObject(payload) && typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}.`;
    throw new Error(errorMessage);
  }

  return parseObsidianLaunchPayload(payload);
}

export function openObsidianProtocolUrl(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noreferrer";
  link.target = "_blank";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

