import {
  getAncestorAtLevel,
  getDescendantsAtLevel,
  hexKey,
  parseHexKey,
  type Axial
} from "@/domain/geometry/hex";
import type { World } from "./worldTypes";
import { SOURCE_LEVEL } from "./mapRules";

export type Faction = {
  id: string;
  name: string;
  color: string;
};

export type FactionMap = Map<string, Faction>;
export type FactionLevelMap = Map<string, string>;

function cloneFactionMap(factionMap: FactionMap): FactionMap {
  return new Map(
    Array.from(factionMap.entries(), ([id, faction]) => [id, { ...faction }])
  );
}

function cloneFactionLevelMap(levelMap: FactionLevelMap): FactionLevelMap {
  return new Map(levelMap);
}

function getStoredFactionMap(world: World): FactionMap {
  return world.factions ? cloneFactionMap(world.factions) : new Map();
}

function getStoredFactionLevelMap(world: World, level: number): FactionLevelMap {
  return world.factionAssignmentsByLevel?.[level]
    ? cloneFactionLevelMap(world.factionAssignmentsByLevel[level])
    : new Map();
}

function sourceHasTile(world: World, key: string): boolean {
  return Boolean(world.levels[SOURCE_LEVEL]?.has(key));
}

function sanitizeSourceAssignments(world: World): FactionLevelMap {
  const factionMap = getStoredFactionMap(world);
  const sourceAssignments = getStoredFactionLevelMap(world, SOURCE_LEVEL);
  const sanitized = new Map<string, string>();

  for (const [hexId, factionId] of sourceAssignments.entries()) {
    if (!factionMap.has(factionId)) {
      continue;
    }

    if (!sourceHasTile(world, hexId)) {
      continue;
    }

    sanitized.set(hexId, factionId);
  }

  return sanitized;
}

export function getFactions(world: World): Faction[] {
  return Array.from(getStoredFactionMap(world).values())
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

export function getFactionById(world: World, factionId: string): Faction | null {
  return getStoredFactionMap(world).get(factionId) ?? null;
}

export function addFaction(world: World, faction: Faction): World {
  const factions = getStoredFactionMap(world);

  if (factions.has(faction.id)) {
    return world;
  }

  factions.set(faction.id, { ...faction });

  return {
    ...world,
    factions
  };
}

export function updateFaction(
  world: World,
  factionId: string,
  updates: Partial<Pick<Faction, "name" | "color">>
): World {
  const factions = getStoredFactionMap(world);
  const current = factions.get(factionId);

  if (!current) {
    return world;
  }

  const next: Faction = {
    ...current,
    ...updates
  };

  if (next.name === current.name && next.color === current.color) {
    return world;
  }

  factions.set(factionId, next);

  return {
    ...world,
    factions
  };
}

export function removeFaction(world: World, factionId: string): World {
  const factions = getStoredFactionMap(world);

  if (!factions.has(factionId)) {
    return world;
  }

  factions.delete(factionId);

  const nextAssignmentsByLevel: Record<number, FactionLevelMap> = {
    ...world.factionAssignmentsByLevel
  };

  for (const [levelKey, levelMap] of Object.entries(world.factionAssignmentsByLevel ?? {})) {
    const level = Number(levelKey);
    const nextLevelMap = new Map(levelMap);
    let changed = false;

    for (const [hexId, assignedFactionId] of levelMap.entries()) {
      if (assignedFactionId !== factionId) {
        continue;
      }

      nextLevelMap.delete(hexId);
      changed = true;
    }

    if (!changed) {
      continue;
    }

    nextAssignmentsByLevel[level] = nextLevelMap;
  }

  return {
    ...world,
    factions,
    factionAssignmentsByLevel: nextAssignmentsByLevel
  };
}

function setSourceFactionAssignment(
  world: World,
  axial: Axial,
  factionId: string | null
): { changed: boolean; world: World } {
  const factions = getStoredFactionMap(world);

  if (factionId && !factions.has(factionId)) {
    return { changed: false, world };
  }

  const sourceAssignments = sanitizeSourceAssignments(world);
  const key = hexKey(axial);

  if (!sourceHasTile(world, key)) {
    return { changed: false, world };
  }

  const current = sourceAssignments.get(key);

  if (factionId === null) {
    if (!current) {
      return { changed: false, world };
    }

    sourceAssignments.delete(key);
  } else {
    if (current === factionId) {
      return { changed: false, world };
    }

    sourceAssignments.set(key, factionId);
  }

  return {
    changed: true,
    world: {
      ...world,
      factionAssignmentsByLevel: {
        ...world.factionAssignmentsByLevel,
        [SOURCE_LEVEL]: sourceAssignments
      }
    }
  };
}

function assignFactionAcrossDescendants(
  world: World,
  level: number,
  axial: Axial,
  factionId: string | null
): World {
  let nextWorld = world;
  let changed = false;

  for (const descendant of getDescendantsAtLevel(axial, level, SOURCE_LEVEL)) {
    const result = setSourceFactionAssignment(nextWorld, descendant, factionId);

    if (!result.changed) {
      continue;
    }

    nextWorld = result.world;
    changed = true;
  }

  return changed ? nextWorld : world;
}

export function assignFactionAt(world: World, level: number, axial: Axial, factionId: string): World {
  if (level === SOURCE_LEVEL) {
    return setSourceFactionAssignment(world, axial, factionId).world;
  }

  return assignFactionAcrossDescendants(world, level, axial, factionId);
}

export function clearFactionAt(world: World, level: number, axial: Axial): World {
  if (level === SOURCE_LEVEL) {
    return setSourceFactionAssignment(world, axial, null).world;
  }

  return assignFactionAcrossDescendants(world, level, axial, null);
}

function pickDominantFaction(countsByFactionId: Map<string, number>): string | null {
  let winner: string | null = null;
  let bestCount = -1;

  for (const [factionId, count] of countsByFactionId.entries()) {
    if (count > bestCount) {
      winner = factionId;
      bestCount = count;
      continue;
    }

    if (count === bestCount && winner && factionId < winner) {
      winner = factionId;
    }
  }

  return winner;
}

function deriveFactionLevelMapFromSource(world: World, level: number): FactionLevelMap {
  const sourceAssignments = sanitizeSourceAssignments(world);
  const grouped = new Map<string, Map<string, number>>();

  for (const [hexId, factionId] of sourceAssignments.entries()) {
    const parent = getAncestorAtLevel(parseHexKey(hexId), SOURCE_LEVEL, level);
    const parentKey = hexKey(parent);
    const counts = grouped.get(parentKey) ?? new Map<string, number>();
    counts.set(factionId, (counts.get(factionId) ?? 0) + 1);
    grouped.set(parentKey, counts);
  }

  const derived = new Map<string, string>();

  for (const [parentKey, counts] of grouped.entries()) {
    const winner = pickDominantFaction(counts);

    if (!winner) {
      continue;
    }

    derived.set(parentKey, winner);
  }

  return derived;
}

export function getFactionLevelMap(world: World, level: number): FactionLevelMap {
  if (level === SOURCE_LEVEL) {
    return sanitizeSourceAssignments(world);
  }

  return deriveFactionLevelMapFromSource(world, level);
}

export function getFactionOverlayColorMap(world: World, level: number): Map<string, string> {
  const assignments = getFactionLevelMap(world, level);
  const factions = getStoredFactionMap(world);
  const colorMap = new Map<string, string>();

  for (const [hexId, factionId] of assignments.entries()) {
    const faction = factions.get(factionId);

    if (!faction) {
      continue;
    }

    colorMap.set(hexId, faction.color);
  }

  return colorMap;
}
