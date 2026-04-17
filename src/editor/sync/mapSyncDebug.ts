export function isMapSyncDebugEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }

  try {
    return window.localStorage.getItem("hexmap:sync-debug") === "1";
  } catch {
    return false;
  }
}

export function logMapSync(event: string, payload: Record<string, unknown>): void {
  if (!isMapSyncDebugEnabled()) {
    return;
  }

  console.info(`[MapSync] ${event}`, payload);
}

export function toRoundedMs(durationMs: number): number {
  return Number(durationMs.toFixed(2));
}
