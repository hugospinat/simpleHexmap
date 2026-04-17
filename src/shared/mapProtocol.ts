import type { SerializedWorld } from "@/domain/world/worldSerialization";

export type MapSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

export type MapDocument = MapSummary & {
  world: SerializedWorld;
};

export type JoinMapMessage = {
  type: "join_map";
  mapId: string;
};

export type MapStateMessage = {
  type: "map_state";
  map: MapDocument;
};

export type MapUpdateMessage = {
  type: "map_update";
  mapId: string;
  world: SerializedWorld;
  updatedAt?: string;
};

export type MapSocketMessage = JoinMapMessage | MapStateMessage | MapUpdateMessage;
