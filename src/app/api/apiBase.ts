function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function parseAbsoluteHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return trimTrailingSlash(configured);
  }

  return "";
}

export function buildApiUrl(path: string): string {
  const normalizedPath = normalizePath(path);
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return normalizedPath;
  }

  const absolute = parseAbsoluteHttpUrl(baseUrl);

  if (!absolute) {
    return `${trimTrailingSlash(baseUrl)}${normalizedPath}`;
  }

  return new URL(normalizedPath, absolute).toString();
}

export function buildWebSocketUrl(path: string): string {
  const apiUrl = buildApiUrl(path);
  const normalizedPath = normalizePath(path);
  const absolute = parseAbsoluteHttpUrl(apiUrl);

  if (absolute) {
    absolute.protocol = absolute.protocol === "https:" ? "wss:" : "ws:";
    return absolute.toString();
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${normalizedPath}`;
}
