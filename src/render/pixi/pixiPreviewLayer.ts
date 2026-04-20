import { Graphics, type Container } from "pixi.js";
import {
  getAncestorAtLevel,
  hexKey,
  type Axial,
  type HexId,
  type Pixel,
} from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { type RoadEdgeIndex } from "@/core/map/roads";
import {
  featureHexIdToAxial,
  getFeatureById,
  tileColors,
} from "@/core/map/world";
import type { MapOperation } from "@/core/protocol/types";
import { getWorldHexGeometry } from "./pixiGeometry";
import {
  getWorldHexCorners,
  parseCssColor,
  pathPolygon,
  scaleWorldLength,
} from "./pixiLayers";
import type {
  PixiAssetCatalog,
  PixiObjectPools,
  PixiSceneCellRecord,
  PixiSceneRenderFrame,
} from "./pixiTypes";

const previewTerrainAlpha = 0.72;
const previewFogAlpha = 0.38;
const previewFactionAlpha = 0.42;

function fitTextureSizePreservingAspect(
  textureWidth: number,
  textureHeight: number,
  maxWidth: number,
  maxHeight: number,
): { height: number; width: number } {
  const sourceWidth = Math.max(1, textureWidth);
  const sourceHeight = Math.max(1, textureHeight);
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);

  return {
    height: sourceHeight * scale,
    width: sourceWidth * scale,
  };
}

function sourceAxialToFrameHexId(
  axial: Axial,
  frame: PixiSceneRenderFrame,
): HexId {
  const frameAxial =
    frame.transform.level === SOURCE_LEVEL
      ? axial
      : getAncestorAtLevel(axial, SOURCE_LEVEL, frame.transform.level);

  return hexKey(frameAxial);
}

function getFrameCellForSourceAxial(
  frame: PixiSceneRenderFrame,
  axial: Axial,
): PixiSceneCellRecord | null {
  const hexId = sourceAxialToFrameHexId(axial, frame);
  return frame.renderCells.find((cell) => cell.key === hexId) ?? null;
}

type PreviewHexGeometry = {
  boundsHeight: number;
  boundsWidth: number;
  key: HexId;
  worldCenter: Pixel;
  worldCorners: Pixel[];
};

function getPreviewGeometryForSourceAxial(
  frame: PixiSceneRenderFrame,
  axial: Axial,
): PreviewHexGeometry {
  const hexId = sourceAxialToFrameHexId(axial, frame);
  const existingCell = frame.renderCells.find((cell) => cell.key === hexId);

  if (existingCell) {
    return existingCell;
  }

  const frameAxial =
    frame.transform.level === SOURCE_LEVEL
      ? axial
      : getAncestorAtLevel(axial, SOURCE_LEVEL, frame.transform.level);
  const geometry = getWorldHexGeometry(frameAxial, frame.transform.level);

  return {
    boundsHeight: geometry.boundsHeight,
    boundsWidth: geometry.boundsWidth,
    key: hexId,
    worldCenter: geometry.worldCenter,
    worldCorners: geometry.worldCorners,
  };
}

function pathEdge(
  graphics: Graphics,
  axial: Axial,
  edge: number,
  frame: PixiSceneRenderFrame,
): void {
  const frameAxial =
    frame.transform.level === SOURCE_LEVEL
      ? axial
      : getAncestorAtLevel(axial, SOURCE_LEVEL, frame.transform.level);
  const corners = getWorldHexCorners(frameAxial, frame.transform.level);
  const start = corners[edge];
  const end = corners[(edge + 1) % corners.length];
  graphics.moveTo(start.x, start.y);
  graphics.lineTo(end.x, end.y);
}

function getMidpoint(a: Pixel, b: Pixel): Pixel {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function drawPreviewTerrain(
  graphics: Graphics,
  parent: Container,
  frame: PixiSceneRenderFrame,
  assets: PixiAssetCatalog,
  pools: PixiObjectPools,
  visibleSpriteKeys: Set<string>,
  tile: { q: number; r: number; terrain: string | null; hidden: boolean },
): number {
  const cell = getPreviewGeometryForSourceAxial(frame, tile);
  const terrain = tile.terrain;

  if (!terrain) {
    pathPolygon(graphics, cell.worldCorners);
    graphics.fill({ alpha: 0.66, color: 0xffffff });
    return 1;
  }

  const texture = assets.terrainTextures.get(terrain);

  if (texture) {
    const spriteKey = `preview:terrain:${cell.key}`;
    visibleSpriteKeys.add(spriteKey);
    const sprite = pools.previewTerrainSprites.acquire(spriteKey, parent);
    sprite.texture = texture;
    sprite.anchor.set(0.5);
    sprite.position.set(cell.worldCenter.x, cell.worldCenter.y);
    const fitted = fitTextureSizePreservingAspect(
      texture.width,
      texture.height,
      cell.boundsWidth * 0.92,
      cell.boundsHeight * 0.92,
    );
    sprite.width = fitted.width;
    sprite.height = fitted.height;
    sprite.rotation = 0;
    sprite.alpha = previewTerrainAlpha;
    return 1;
  }

  pathPolygon(graphics, cell.worldCorners);
  graphics.fill({
    alpha: previewTerrainAlpha,
    color: parseCssColor(
      tileColors[terrain as keyof typeof tileColors] ?? "#ffffff",
    ),
  });
  return 1;
}

function drawPreviewFog(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  cellUpdate: { q: number; r: number; hidden: boolean },
): number {
  const cell = getFrameCellForSourceAxial(frame, cellUpdate);

  if (!cell) {
    return 0;
  }

  pathPolygon(graphics, cell.worldCorners);
  graphics.fill({
    alpha: previewFogAlpha,
    color: cellUpdate.hidden ? 0x000000 : 0xffffff,
  });
  return 1;
}

function drawPreviewFeatureFog(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  operation: Extract<MapOperation, { type: "set_feature_hidden" }>,
): number {
  const feature = getFeatureById(
    frame.world,
    SOURCE_LEVEL,
    operation.featureId,
  );

  if (!feature) {
    return 0;
  }

  const cell = getFrameCellForSourceAxial(
    frame,
    featureHexIdToAxial(feature.hexId),
  );

  if (!cell) {
    return 0;
  }

  const radius = Math.min(cell.boundsWidth, cell.boundsHeight) * 0.24;
  graphics.circle(cell.worldCenter.x, cell.worldCenter.y, radius);
  graphics.fill({
    alpha: previewFogAlpha,
    color: operation.hidden ? 0x000000 : 0xffffff,
  });
  graphics.circle(cell.worldCenter.x, cell.worldCenter.y, radius);
  graphics.stroke({
    alpha: 0.55,
    color: operation.hidden ? 0xffffff : 0x000000,
    width: scaleWorldLength(frame, 2),
  });
  return 1;
}

function drawPreviewFaction(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  territoryUpdate: { q: number; r: number; factionId: string | null },
): number {
  const cell = getFrameCellForSourceAxial(frame, territoryUpdate);

  if (!cell || territoryUpdate.factionId === null) {
    return 0;
  }

  const faction = frame.world.factions.get(territoryUpdate.factionId);

  if (!faction) {
    return 0;
  }

  pathPolygon(graphics, cell.worldCorners);
  graphics.fill({
    alpha: previewFactionAlpha,
    color: parseCssColor(faction.color),
  });
  return 1;
}

function drawRoadEdge(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  from: Axial,
  edge: RoadEdgeIndex,
  erase: boolean,
): number {
  const cell = getFrameCellForSourceAxial(frame, from);

  if (!cell) {
    return 0;
  }

  const start = cell.worldCorners[edge];
  const end = cell.worldCorners[(edge + 1) % cell.worldCorners.length];
  const center = getMidpoint(start, end);
  const angle = Math.atan2(
    center.y - cell.worldCenter.y,
    center.x - cell.worldCenter.x,
  );
  const length = scaleWorldLength(frame, erase ? 26 : 20);
  const halfLength = length / 2;
  const dx = Math.cos(angle) * halfLength;
  const dy = Math.sin(angle) * halfLength;

  graphics.moveTo(center.x - dx, center.y - dy);
  graphics.lineTo(center.x + dx, center.y + dy);
  graphics.stroke({
    alpha: erase ? 0.9 : 0.75,
    color: erase ? 0xffffff : 0x2d2016,
    width: scaleWorldLength(frame, erase ? 8 : 4),
  });
  return 1;
}

function drawPreviewRoad(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  operation: Extract<MapOperation, { type: "set_road_edges" }>,
): number {
  if (operation.edges.length > 0) {
    let count = 0;
    for (const edge of operation.edges) {
      count += drawRoadEdge(
        graphics,
        frame,
        operation.cell,
        edge as RoadEdgeIndex,
        false,
      );
    }
    return count;
  }

  const cell = getFrameCellForSourceAxial(frame, operation.cell);

  if (!cell || cell.roadEdges.size === 0) {
    return 0;
  }

  let count = 0;

  for (const edge of cell.roadEdges as Set<RoadEdgeIndex>) {
    count += drawRoadEdge(graphics, frame, operation.cell, edge, true);
  }

  return count;
}

function drawPreviewRiver(
  graphics: Graphics,
  frame: PixiSceneRenderFrame,
  operation: Extract<
    MapOperation,
    { type: "add_river_data" | "remove_river_data" }
  >,
): number {
  pathEdge(graphics, operation.river, operation.river.edge, frame);
  graphics.stroke({
    alpha: operation.type === "remove_river_data" ? 0.9 : 0.95,
    color: operation.type === "remove_river_data" ? 0xffffff : 0x267fcc,
    width: scaleWorldLength(
      frame,
      operation.type === "remove_river_data" ? 7 : 4,
    ),
  });
  return 1;
}

export function drawPixiPreviewLayer(
  graphics: Graphics,
  parent: Container,
  frame: PixiSceneRenderFrame,
  operations: readonly MapOperation[],
  assets: PixiAssetCatalog,
  pools: PixiObjectPools,
): number {
  graphics.clear();

  const visibleSpriteKeys = new Set<string>();
  let count = 0;

  for (const operation of operations) {
    switch (operation.type) {
      case "paint_cells":
        for (const cell of operation.cells) {
          count += drawPreviewTerrain(
            graphics,
            parent,
            frame,
            assets,
            pools,
            visibleSpriteKeys,
            {
              q: cell.q,
              r: cell.r,
              terrain: operation.terrain,
              hidden: operation.hidden,
            },
          );
        }
        break;
      case "set_tiles":
        for (const tile of operation.tiles) {
          count += drawPreviewTerrain(
            graphics,
            parent,
            frame,
            assets,
            pools,
            visibleSpriteKeys,
            {
              q: tile.q,
              r: tile.r,
              terrain: tile.terrain,
              hidden: tile.hidden,
            },
          );
        }
        break;
      case "set_cells_hidden":
        for (const cell of operation.cells) {
          count += drawPreviewFog(graphics, frame, {
            q: cell.q,
            r: cell.r,
            hidden: operation.hidden,
          });
        }
        break;
      case "assign_faction_cells":
        for (const cell of operation.cells) {
          count += drawPreviewFaction(graphics, frame, {
            q: cell.q,
            r: cell.r,
            factionId: operation.factionId,
          });
        }
        break;
      case "set_faction_territories":
        for (const territory of operation.territories) {
          count += drawPreviewFaction(graphics, frame, {
            q: territory.q,
            r: territory.r,
            factionId: territory.factionId,
          });
        }
        break;
      case "set_feature_hidden":
        count += drawPreviewFeatureFog(graphics, frame, operation);
        break;
      case "set_road_edges":
        count += drawPreviewRoad(graphics, frame, operation);
        break;
      case "add_river_data":
      case "remove_river_data":
        count += drawPreviewRiver(graphics, frame, operation);
        break;
      default:
        break;
    }
  }

  pools.previewTerrainSprites.releaseUnused(visibleSpriteKeys);
  return count;
}

export function clearPixiPreviewLayer(
  graphics: Graphics,
  pools: PixiObjectPools,
): void {
  graphics.clear();
  pools.previewTerrainSprites.releaseUnused(new Set());
}
