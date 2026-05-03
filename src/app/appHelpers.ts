export function getDefaultName(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

export function readInviteTokenFromLocation(): string | null {
  const value = new URLSearchParams(window.location.search).get("invite");
  return value?.trim() || null;
}

export function clearInviteTokenFromLocation(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("invite");
  window.history.replaceState({}, "", url);
}

export async function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Could not read file."));
    };

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Invalid file content."));
        return;
      }

      resolve(reader.result);
    };

    reader.readAsText(file);
  });
}

export function triggerJsonDownload(fileName: string, payload: unknown): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
