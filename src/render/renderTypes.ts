import type { Axial } from "@/core/geometry/hex";
import type { Pixel } from "@/core/geometry/hex";
import type { Feature } from "@/core/map/features";
import type { RiverEdgeSet } from "@/core/map/world";
import type { HexCell } from "@/core/map/world";
import type { RoadEdgeSet } from "@/core/map/roads";

export type VisibleCell = {
  axial: Axial;
  cell: HexCell;
  key: string;
};

export type RenderCell = VisibleCell & {
  center: Pixel;
  corners: Pixel[];
  factionColor: string | null;
  feature: Feature | null;
  riverEdges: RiverEdgeSet;
  roadEdges: RoadEdgeSet;
};

export type RenderStats = {
  featureHexes: number;
  features: number;
  factions: number;
  boundaries: number;
  labels: number;
  roads: number;
  rivers: number;
  tiles: number;
};

export type Viewport = {
  width: number;
  height: number;
};
