import type { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import type { Axial, HexId, Pixel } from "@/core/geometry/hex";
import type { FeatureVisibilityMode } from "@/core/map/features";
import type { MapLevel } from "@/core/map/mapRules";
import type { HexCell, MapState, MapStateVersions, RiverEdgeRef, RiverEdgeSet } from "@/core/map/worldTypes";
import type { Feature } from "@/core/map/features";
import type { RoadEdgeSet } from "@/core/map/roads";
import type { MapOperation } from "@/core/protocol/types";
import type { RenderWorldPatch } from "@/render/renderWorldPatch";
import type { RenderCell, RenderStats, Viewport } from "@/render/renderTypes";

export type RendererBackend = "canvas" | "pixi";

export type PixiLayerTimings = {
  background?: number;
  terrain?: number;
  boundaries?: number;
  rivers?: number;
  roads?: number;
  factions?: number;
  features?: number;
  overlay?: number;
  preview?: number;
};

export type PixiRenderStats = RenderStats & {
  activeWindowMs?: number;
  cameraMs?: number;
  graphicsCount: number;
  layerTimings: PixiLayerTimings;
  layerPatchMs?: number;
  pixiUpdateMs: number;
  pixiRenderMs?: number;
  sceneUpdateMs?: number;
  spriteCount: number;
  visibleCellCount: number;
};

export type PixiRenderBaseOptions = {
  featureVisibilityMode: FeatureVisibilityMode;
  fogEditingActive: boolean;
  showCoordinates: boolean;
};

export type PixiRenderOverlayOptions = {
  featureVisibilityMode: FeatureVisibilityMode;
  fogEditingActive: boolean;
};

export type MapInteractionOverlay = {
  brushCells: RenderCell[];
  cursorMode: string;
  highlightedHex: HexId | null;
  hoverRiverEdge: RiverEdgeRef | null;
  previewCells: RenderCell[];
  selectedHexes: HexId[];
};

export type { RenderWorldPatch };

export type PixiCameraState = {
  center: Axial;
  featureVisibilityMode: FeatureVisibilityMode;
  fogEditingActive: boolean;
  level: MapLevel;
  showCoordinates: boolean;
  viewport: Viewport;
  visualZoom: number;
};

export type PixiSceneCellRecord = {
  axial: Axial;
  boundsHeight: number;
  boundsWidth: number;
  cell: HexCell;
  center: Pixel;
  corners: Pixel[];
  factionColor: string | null;
  feature: Feature | null;
  featureImage: null;
  featureTerrainOverrideImage: null;
  hexId: HexId;
  key: HexId;
  riverEdges: RiverEdgeSet;
  roadEdges: RoadEdgeSet;
  terrainImage: null;
  worldCenter: Pixel;
  worldCorners: Pixel[];
};

export type PixiSceneRenderFrame = {
  cameraWorldCenter: Pixel;
  factionOverlayColorMap: Map<string, string>;
  featureVisibleKeys: ReadonlySet<string>;
  hiddenCells: PixiSceneCellRecord[];
  highlightedHex: Axial | null;
  hoverRiverEdge: RiverEdgeRef | null;
  renderCells: PixiSceneCellRecord[];
  transform: {
    level: MapLevel;
    mapScale: number;
    scaleMapLength: (length: number) => number;
    viewport: Viewport;
    zoom: number;
  };
  visibleTerrainCells: PixiSceneCellRecord[];
  visibleTerrainKeys: ReadonlySet<string>;
  world: MapState;
};

export type MapRendererAdapter = {
  destroy: () => void;
  resize: (width: number, height: number, devicePixelRatio: number) => void;
  clearPreview: () => PixiRenderStats;
  setCamera: (camera: PixiCameraState) => PixiRenderStats;
  setOverlay: (overlay: MapInteractionOverlay, options: PixiRenderOverlayOptions) => PixiRenderStats;
  setPreviewOperations: (operations: readonly MapOperation[]) => PixiRenderStats;
  setWorld: (world: MapState, patch?: RenderWorldPatch) => PixiRenderStats;
};

export type LayerInvalidationKey = {
  level: number;
  mapVersions: MapStateVersions;
  visibilityMode: FeatureVisibilityMode;
  visibleCellHash: string;
};

export type PixiAssetCatalog = {
  fallbackTextures: Map<string, Texture>;
  featureTerrainOverrideTextures: Map<string, Texture>;
  featureTextures: Map<string, Texture>;
  ready: boolean;
  roadTexture: Texture | null;
  terrainTextures: Map<string, Texture>;
};

export type PixiObjectPools = {
  coordinateTexts: TextPool;
  featureSprites: SpritePool;
  labelTexts: TextPool;
  roadSprites: SpritePool;
  terrainSprites: SpritePool;
  previewTerrainSprites: SpritePool;
};

export type PixiLayerContext = {
  app: Application;
  assets: PixiAssetCatalog;
  camera: Container;
  pools: PixiObjectPools;
};

export type PixiLayer<TInput> = {
  clear: () => void;
  destroy: () => void;
  update: (input: TInput, context: PixiLayerContext) => Partial<PixiRenderStats>;
};

export type PixiStageLayers = {
  background: Graphics;
  boundary: Graphics;
  camera: Container;
  faction: Graphics;
  feature: Container;
  fog: Graphics;
  overlay: Graphics;
  preview: Container;
  river: Graphics;
  road: Container;
  terrain: Container;
};

export type SpritePool = {
  acquire: (key: string, parent: Container) => Sprite;
  destroy: () => void;
  releaseUnused: (visibleKeys: ReadonlySet<string>) => void;
  size: () => number;
};

export type TextPool = {
  acquire: (key: string, parent: Container) => Text;
  destroy: () => void;
  releaseUnused: (visibleKeys: ReadonlySet<string>) => void;
  size: () => number;
};
