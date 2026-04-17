export const TERRAIN_TYPES = [
  "empty",
  "water",
  "plain",
  "forest",
  "hill",
  "mountain",
  "desert",
  "swamp",
  "tundra",
  "wasteland"
] as const;

export type TerrainType = typeof TERRAIN_TYPES[number];

export const terrainTypes = TERRAIN_TYPES;

export const terrainColors: Record<TerrainType, string> = {
  empty: "#ffffff",
  water: "#ffffff",
  plain: "#ffffff",
  forest: "#ffffff",
  hill: "#ffffff",
  mountain: "#ffffff",
  desert: "#ffffff",
  swamp: "#ffffff",
  tundra: "#ffffff",
  wasteland: "#ffffff"
};
