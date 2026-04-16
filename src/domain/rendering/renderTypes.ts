import type { Axial } from "@/domain/geometry/hex";
import type { HexCell } from "@/domain/world/world";

export type VisibleCell = {
  axial: Axial;
  cell: HexCell;
  key: string;
};

export type RenderStats = {
  featureHexes: number;
  features: number;
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
