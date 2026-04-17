import { deserializeWorld, serializeWorld, type SerializedWorld } from "@/domain/world/worldSerialization";
import type { World } from "@/domain/world/world";
import type { MapDocument, MapSummary } from "@/shared/mapProtocol";

type CreateMapInput = {
  name: string;
  world?: World;
};

type ImportMapInput = {
  name: string;
  json: unknown;
};

const DEFAULT_LOCAL_API_BASE = "http://localhost:3001";

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (window.location.hostname === "localhost" && window.location.port === "5173") {
    return DEFAULT_LOCAL_API_BASE;
  }

  return "";
}

function getEndpoint(path: string): string {
  const base = getApiBaseUrl();
  return base ? `${base}${path}` : path;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listMaps(): Promise<MapSummary[]> {
  const response = await fetch(getEndpoint("/maps"));
  return readJson<MapSummary[]>(response);
}

export async function getMap(mapId: string): Promise<{ id: string; name: string; updatedAt: string; world: World; }> {
  const response = await fetch(getEndpoint(`/maps/${mapId}`));
  const map = await readJson<MapDocument>(response);

  return {
    id: map.id,
    name: map.name,
    updatedAt: map.updatedAt,
    world: deserializeWorld(map.world)
  };
}

export async function createMap({ name, world }: CreateMapInput): Promise<MapSummary> {
  const payload = {
    name,
    world: world ? serializeWorld(world) : undefined
  };
  const response = await fetch(getEndpoint("/maps"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return readJson<MapSummary>(response);
}

export async function importMap({ name, json }: ImportMapInput): Promise<MapSummary> {
  const response = await fetch(getEndpoint("/maps/import"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, json })
  });

  return readJson<MapSummary>(response);
}

export async function updateMap(mapId: string, world: World): Promise<void> {
  await fetch(getEndpoint(`/maps/${mapId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ world: serializeWorld(world) satisfies SerializedWorld })
  });
}
