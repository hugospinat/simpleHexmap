import type { Axial } from "@/core/geometry/hex";
import type { HexCell } from "@/core/map/world";

export type VisibleCell = {
  axial: Axial;
  cell: HexCell;
  key: string;
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
