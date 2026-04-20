import type { SavedMapContent } from "../../../src/core/protocol/index.js";
import { canOpenAsGm, type WorkspaceMapRecord } from "./workspaceRepository.js";

export type MapVisibilityMode = "gm" | "player";

const axialDirections = [
  { q: 1, r: 0 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
];
const riverEdgeDirectionIndex = [2, 5, 1, 3, 4, 0] as const;
const roadEdgeToDirectionIndex = [2, 5, 1, 3, 4, 0] as const;

function cellKey(cell: { q: number; r: number }): string {
  return `${cell.q},${cell.r}`;
}

function getNeighborForRiverEdge(
  cell: { q: number; r: number },
  edge: number,
): { q: number; r: number } {
  const direction = axialDirections[riverEdgeDirectionIndex[edge] ?? 0];
  return { q: cell.q + direction.q, r: cell.r + direction.r };
}

function getNeighborForRoadEdge(
  cell: { q: number; r: number },
  edge: number,
): { q: number; r: number } {
  const direction = axialDirections[roadEdgeToDirectionIndex[edge] ?? 0];
  return { q: cell.q + direction.q, r: cell.r + direction.r };
}

export function getVisibilityModeForMapRole(
  map: Pick<WorkspaceMapRecord, "currentUserRole">,
): MapVisibilityMode {
  return canOpenAsGm(map.currentUserRole) ? "gm" : "player";
}

export function filterSavedMapContentForPlayer(
  content: SavedMapContent,
): SavedMapContent {
  const tiles = content.tiles.filter((tile) => !tile.hidden);
  const visibleCellKeys = new Set(tiles.map((tile) => cellKey(tile)));
  const factionTerritories = content.factionTerritories.filter((territory) =>
    visibleCellKeys.has(cellKey(territory)),
  );
  const visibleFactionIds = new Set(
    factionTerritories.map((territory) => territory.factionId),
  );

  return {
    ...content,
    tiles,
    features: content.features
      .filter(
        (feature) =>
          visibleCellKeys.has(cellKey(feature)) &&
          feature.visibility === "visible",
      )
      .map((feature) => ({
        ...feature,
        gmLabel: null,
      })),
    rivers: content.rivers.filter((river) => {
      if (!visibleCellKeys.has(cellKey(river))) {
        return false;
      }

      const neighbor = getNeighborForRiverEdge(river, river.edge);
      return visibleCellKeys.has(cellKey(neighbor));
    }),
    roads: content.roads
      .filter((road) => visibleCellKeys.has(cellKey(road)))
      .map((road) => ({
        ...road,
        edges: road.edges.filter((edge) => {
          const neighbor = getNeighborForRoadEdge(road, edge);
          return visibleCellKeys.has(cellKey(neighbor));
        }),
      }))
      .filter((road) => road.edges.length > 0),
    factions: content.factions.filter((faction) =>
      visibleFactionIds.has(faction.id),
    ),
    factionTerritories,
    tokens: content.tokens.filter((token) =>
      visibleCellKeys.has(cellKey(token)),
    ),
  };
}

export function filterMapRecordForVisibilityMode(
  map: WorkspaceMapRecord,
  visibilityMode: MapVisibilityMode,
): WorkspaceMapRecord {
  if (visibilityMode === "gm") {
    return map;
  }

  return {
    ...map,
    content: filterSavedMapContentForPlayer(map.content),
  };
}
