export const SOURCE_LEVEL = 3;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = SOURCE_LEVEL;
export const MAP_LEVELS = [1, 2, 3] as const;

export type MapLevel = typeof MAP_LEVELS[number];

export function isSourceLevel(level: number): boolean {
  return level === SOURCE_LEVEL;
}
