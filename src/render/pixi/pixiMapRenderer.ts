import { Application, Graphics } from "pixi.js";
import { axialToWorldPixel, getLevelScale } from "@/core/geometry/hex";
import type { MapState } from "@/core/map/worldTypes";
import type { MapOperation } from "@/core/protocol/types";
import { nowForRenderTiming } from "@/render/renderPerformance";
import {
  createPixiActiveRenderWindow,
  shouldReusePixiActiveWindow,
  type PixiActiveRenderWindow,
} from "./pixiActiveWindow";
import {
  createEmptyPixiAssetCatalog,
  loadPixiAssetCatalog,
} from "./pixiAssets";
import {
  createPixiMapSceneCache,
  type PixiLevelScene,
  type PixiMapSceneCache,
} from "./pixiMapSceneCache";
import { buildPixiSceneRenderFrame } from "./pixiRenderFrame";
import { getWorldVisibleCellHash } from "./pixiLayers";
import {
  countPixiRendererSprites,
  createPixiRendererPools,
  destroyPixiRendererPools,
} from "./pixiRendererResources";
import { createPixiStage } from "./pixiStage";
import {
  drawPixiBoundaryLayer,
  resetPixiBoundaryLayerInvalidation,
} from "./pixiBoundaryLayer";
import { drawPixiFactionLayer } from "./pixiFactionLayer";
import { drawPixiFeatureLayer } from "./pixiFeatureLayer";
import { drawPixiFogVisibilityLayer } from "./pixiFogVisibilityLayer";
import { drawPixiOverlayLayer } from "./pixiOverlayLayer";
import {
  clearPixiPreviewLayer,
  drawPixiPreviewLayer,
} from "./pixiPreviewLayer";
import { drawPixiRiverLayer } from "./pixiRiverLayer";
import { drawPixiRoadLayer } from "./pixiRoadLayer";
import { drawPixiTerrainLayer } from "./pixiTerrainLayer";
import { drawPixiTokenLayer } from "./pixiTokenLayer";
import type {
  MapInteractionOverlay,
  MapTokenRenderable,
  PixiAssetCatalog,
  PixiCameraState,
  PixiLayerTimings,
  PixiObjectPools,
  PixiRenderStats,
  PixiSceneRenderFrame,
  PixiStageLayers,
  RenderWorldPatch,
} from "./pixiTypes";

function createEmptyStats(
  layerTimings: PixiLayerTimings = {},
): PixiRenderStats {
  return {
    activeWindowMs: 0,
    boundaries: 0,
    cameraMs: 0,
    factions: 0,
    featureHexes: 0,
    features: 0,
    fogCells: 0,
    fogCacheHit: false,
    graphicsCount: 0,
    labels: 0,
    layerPatchMs: 0,
    layerTimings,
    pixiRenderMs: 0,
    pixiUpdateMs: 0,
    roads: 0,
    rivers: 0,
    sceneUpdateMs: 0,
    spriteCount: 0,
    tiles: 0,
    visibleCellCount: 0,
  };
}

function timeLayer<T>(
  timings: PixiLayerTimings,
  name: keyof PixiLayerTimings,
  draw: () => T,
): T {
  const start = nowForRenderTiming();
  const result = draw();
  timings[name] = Number((nowForRenderTiming() - start).toFixed(2));
  return result;
}

function drawBackground(
  background: Graphics,
  width: number,
  height: number,
): void {
  background.clear();
  background.rect(0, 0, width, height);
  background.fill({ color: 0xffffff });
}

function updateCameraTransform(
  layers: PixiStageLayers,
  camera: PixiCameraState,
): number {
  const start = nowForRenderTiming();
  const worldCenter = axialToWorldPixel(camera.center, camera.level);
  const zoom = camera.visualZoom;
  layers.camera.scale.set(zoom);
  layers.camera.position.set(
    camera.viewport.width / 2 - worldCenter.x * zoom,
    camera.viewport.height / 2 - worldCenter.y * zoom,
  );
  return Number((nowForRenderTiming() - start).toFixed(2));
}

function isCoordinateLayerVisible(camera: PixiCameraState): boolean {
  return (
    camera.showCoordinates &&
    getLevelScale(camera.level) * camera.visualZoom * 32 > 14
  );
}

type LayerCache = {
  key: string;
  stats: number;
};

type TerrainLayerCache = {
  key: string;
  stats: ReturnType<typeof drawPixiTerrainLayer>;
};

type FeatureLayerCache = {
  key: string;
  stats: ReturnType<typeof drawPixiFeatureLayer>;
};

export type PixiMapRenderer = {
  destroy: () => void;
  mount: (container: HTMLElement) => Promise<void>;
  resize: (width: number, height: number, devicePixelRatio: number) => void;
  clearPreview: () => PixiRenderStats;
  setCamera: (camera: PixiCameraState) => PixiRenderStats;
  setOverlay: (overlay: MapInteractionOverlay) => PixiRenderStats;
  setPreviewOperations: (
    operations: readonly MapOperation[],
  ) => PixiRenderStats;
  setTokens: (tokens: readonly MapTokenRenderable[]) => PixiRenderStats;
  setWorld: (world: MapState, patch?: RenderWorldPatch) => PixiRenderStats;
};

export function createPixiMapRenderer(): PixiMapRenderer {
  let app: Application | null = null;
  let layers: PixiStageLayers | null = null;
  let terrainFill: Graphics | null = null;
  let previewGraphics: Graphics | null = null;
  let assets: PixiAssetCatalog = createEmptyPixiAssetCatalog();
  let pools: PixiObjectPools = createPixiRendererPools();
  let viewport = { width: 1, height: 1, dpr: 1 };
  let destroyed = false;
  let sceneCache: PixiMapSceneCache | null = null;
  let cameraState: PixiCameraState | null = null;
  let activeWindow: PixiActiveRenderWindow | null = null;
  let activeFrame: PixiSceneRenderFrame | null = null;
  let contentDirty = true;
  let terrainCache: TerrainLayerCache | null = null;
  let boundaryCache: LayerCache | null = null;
  let riverCache: LayerCache | null = null;
  let factionCache: LayerCache | null = null;
  let fogCache: LayerCache | null = null;
  let roadCache: LayerCache | null = null;
  let featureCache: FeatureLayerCache | null = null;
  let tokenCache: LayerCache | null = null;
  let mapTokens: readonly MapTokenRenderable[] = [];
  let backgroundKey = "";
  let renderFrameId: number | null = null;

  function invalidateLayerCaches(): void {
    resetPixiBoundaryLayerInvalidation();
    terrainCache = null;
    boundaryCache = null;
    riverCache = null;
    factionCache = null;
    fogCache = null;
    roadCache = null;
    featureCache = null;
    tokenCache = null;
  }

  function scheduleRender(): void {
    if (!app || renderFrameId !== null) {
      return;
    }

    renderFrameId = requestAnimationFrame(() => {
      renderFrameId = null;
      app?.render();
    });
  }

  function requireMounted(): {
    app: Application;
    layers: PixiStageLayers;
    terrainFill: Graphics;
    previewGraphics: Graphics;
    assets: PixiAssetCatalog;
    pools: PixiObjectPools;
  } | null {
    if (!app || !layers || !terrainFill || !previewGraphics) {
      return null;
    }

    return { app, assets, layers, pools, previewGraphics, terrainFill };
  }

  function syncBaseLayers(
    reason: "camera" | "world" | "resize",
  ): PixiRenderStats {
    const mounted = requireMounted();

    if (!mounted || !sceneCache || !cameraState) {
      return createEmptyStats();
    }

    const start = nowForRenderTiming();
    const layerTimings: PixiLayerTimings = {};
    const cameraMs = updateCameraTransform(mounted.layers, cameraState);
    const sceneStart = nowForRenderTiming();
    const scene = sceneCache.getLevelScene(cameraState.level, sceneCache.world);
    const sceneUpdateMs = Number(
      (nowForRenderTiming() - sceneStart).toFixed(2),
    );
    let activeWindowMs = 0;
    const canReuseWindow = shouldReusePixiActiveWindow(
      activeWindow,
      cameraState,
    );

    if (
      !canReuseWindow ||
      !activeWindow ||
      contentDirty ||
      reason === "resize"
    ) {
      const activeWindowStart = nowForRenderTiming();
      activeWindow = createPixiActiveRenderWindow(scene, cameraState);
      activeWindowMs = Number(
        (nowForRenderTiming() - activeWindowStart).toFixed(2),
      );
      activeFrame = buildPixiSceneRenderFrame(
        sceneCache.world,
        scene,
        activeWindow,
        cameraState,
      );
    } else if (activeFrame) {
      const nextMapScale =
        getLevelScale(cameraState.level) * cameraState.visualZoom;
      activeFrame = {
        ...activeFrame,
        cameraWorldCenter: axialToWorldPixel(
          cameraState.center,
          cameraState.level,
        ),
        transform: {
          ...activeFrame.transform,
          mapScale: nextMapScale,
          scaleMapLength: (length) => length * nextMapScale,
          viewport: cameraState.viewport,
          zoom: cameraState.visualZoom,
        },
      };
    }

    if (
      !activeFrame ||
      (!contentDirty && canReuseWindow && reason === "camera")
    ) {
      scheduleRender();
      return {
        ...createEmptyStats(layerTimings),
        cameraMs,
        pixiUpdateMs: Number((nowForRenderTiming() - start).toFixed(2)),
        sceneUpdateMs,
        spriteCount: countPixiRendererSprites(mounted.pools),
        visibleCellCount: activeFrame?.visibleTerrainCells.length ?? 0,
      };
    }

    const nextBackgroundKey = `${viewport.width}x${viewport.height}`;

    if (backgroundKey !== nextBackgroundKey) {
      timeLayer(layerTimings, "background", () => {
        drawBackground(
          mounted.layers.background,
          viewport.width,
          viewport.height,
        );
      });
      backgroundKey = nextBackgroundKey;
    }

    const visibleCellHash = getWorldVisibleCellHash(
      activeFrame.visibleTerrainCells,
    );
    const versions = sceneCache.world.versions;
    const terrainKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      versions.terrain,
      versions.features,
      cameraState.featureVisibilityMode,
      cameraState.showCoordinates &&
        activeFrame.transform.scaleMapLength(32) > 14,
      mounted.assets.ready,
    ].join("|");
    const terrainStats =
      terrainCache?.key === terrainKey
        ? terrainCache.stats
        : timeLayer(layerTimings, "terrain", () => {
            const stats = drawPixiTerrainLayer(
              mounted.terrainFill,
              mounted.layers.terrain,
              activeFrame as PixiSceneRenderFrame,
              mounted.assets,
              mounted.pools,
              cameraState?.showCoordinates ?? false,
            );
            terrainCache = { key: terrainKey, stats };
            return stats;
          });

    const boundaryKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      versions.terrain,
      cameraState.featureVisibilityMode,
    ].join("|");
    const boundaryCount =
      boundaryCache?.key === boundaryKey
        ? boundaryCache.stats
        : timeLayer(layerTimings, "boundaries", () => {
            const stats = drawPixiBoundaryLayer(
              mounted.layers.boundary,
              activeFrame as PixiSceneRenderFrame,
            );
            boundaryCache = { key: boundaryKey, stats };
            return stats;
          });

    const riverKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      versions.rivers,
      cameraState.featureVisibilityMode,
    ].join("|");
    const riverCount =
      riverCache?.key === riverKey
        ? riverCache.stats
        : timeLayer(layerTimings, "rivers", () => {
            const stats = drawPixiRiverLayer(
              mounted.layers.river,
              activeFrame as PixiSceneRenderFrame,
            );
            riverCache = { key: riverKey, stats };
            return stats;
          });

    const factionKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      versions.factions,
      cameraState.featureVisibilityMode,
    ].join("|");
    let factionCount = 0;

    if (cameraState.featureVisibilityMode === "player") {
      if (factionCache?.key !== factionKey) {
        timeLayer(layerTimings, "factions", () => {
          mounted.layers.faction.clear();
          factionCache = { key: factionKey, stats: 0 };
          return 0;
        });
      }
    } else {
      factionCount =
        factionCache?.key === factionKey
          ? factionCache.stats
          : timeLayer(layerTimings, "factions", () => {
              const stats = drawPixiFactionLayer(
                mounted.layers.faction,
                activeFrame as PixiSceneRenderFrame,
              );
              factionCache = { key: factionKey, stats };
              return stats;
            });
    }

    const roadKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      versions.roads,
      cameraState.featureVisibilityMode,
      Boolean(mounted.assets.roadTexture),
    ].join("|");
    const roadCount =
      roadCache?.key === roadKey
        ? roadCache.stats
        : timeLayer(layerTimings, "roads", () => {
            const stats = drawPixiRoadLayer(
              activeFrame as PixiSceneRenderFrame,
              mounted.pools,
              mounted.assets.roadTexture,
              mounted.layers.road,
            );
            roadCache = { key: roadKey, stats };
            return stats;
          });

    const featureKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      versions.features,
      terrainKey,
      cameraState.featureVisibilityMode,
      cameraState.fogEditingActive,
      mounted.assets.ready,
    ].join("|");
    const featureStats =
      featureCache?.key === featureKey
        ? featureCache.stats
        : timeLayer(layerTimings, "features", () => {
            const stats = drawPixiFeatureLayer(
              activeFrame as PixiSceneRenderFrame,
              mounted.assets,
              mounted.pools,
              mounted.layers.feature,
              terrainStats.terrainOverriddenHexes,
              cameraState?.featureVisibilityMode ?? "gm",
              Boolean(
                cameraState?.fogEditingActive &&
                cameraState.featureVisibilityMode === "gm",
              ),
            );
            featureCache = { key: featureKey, stats };
            return stats;
          });

    const fogVisibilityMode = cameraState.featureVisibilityMode;
    const fogEditingActive = cameraState.fogEditingActive;
    const fogKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      versions.terrain,
      versions.features,
      fogVisibilityMode,
      fogEditingActive,
    ].join("|");
    const fogCacheHit = fogCache?.key === fogKey;
    const fogCount = fogCacheHit
      ? (fogCache?.stats ?? 0)
      : timeLayer(layerTimings, "fog", () => {
          const stats = drawPixiFogVisibilityLayer(
            mounted.layers.fog,
            activeFrame as PixiSceneRenderFrame,
            fogVisibilityMode,
            fogEditingActive,
          );
          fogCache = { key: fogKey, stats };
          return stats;
        });

    const tokenKey = [
      activeFrame.transform.level,
      activeWindow?.key ?? visibleCellHash,
      cameraState.featureVisibilityMode,
      mapTokens
        .map((token) => `${token.userId}:${token.q},${token.r}:${token.color}`)
        .sort()
        .join(";"),
    ].join("|");
    const tokenCount =
      tokenCache?.key === tokenKey
        ? tokenCache.stats
        : timeLayer(layerTimings, "tokens", () => {
            const stats = drawPixiTokenLayer(
              mounted.layers.token,
              activeFrame as PixiSceneRenderFrame,
              mapTokens,
            );
            tokenCache = { key: tokenKey, stats };
            return stats;
          });

    contentDirty = false;

    const layerPatchMs = Object.values(layerTimings).reduce(
      (total, value) => total + (value ?? 0),
      0,
    );
    const stats: PixiRenderStats = {
      activeWindowMs,
      boundaries: boundaryCount,
      cameraMs,
      factions: factionCount,
      featureHexes: featureStats.hexes,
      features: featureStats.features,
      fogCacheHit,
      fogCells: fogCount,
      graphicsCount: 6,
      labels: terrainStats.labels,
      layerPatchMs: Number(layerPatchMs.toFixed(2)),
      layerTimings,
      pixiRenderMs: 0,
      pixiUpdateMs: Number((nowForRenderTiming() - start).toFixed(2)),
      roads: roadCount,
      rivers: riverCount,
      sceneUpdateMs,
      spriteCount: countPixiRendererSprites(mounted.pools),
      tiles: terrainStats.tiles,
      tokens: tokenCount,
      visibleCellCount: activeFrame.visibleTerrainCells.length,
    };

    scheduleRender();
    return stats;
  }

  return {
    destroy: () => {
      destroyed = true;
      resetPixiBoundaryLayerInvalidation();
      destroyPixiRendererPools(pools);
      pools = createPixiRendererPools();
      invalidateLayerCaches();
      activeWindow = null;
      activeFrame = null;
      sceneCache = null;
      backgroundKey = "";

      if (renderFrameId !== null) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = null;
      }

      if (app) {
        app.destroy({ removeView: true }, { children: true });
      }

      app = null;
      layers = null;
      terrainFill = null;
      previewGraphics = null;
    },
    mount: async (container) => {
      const nextApp = new Application();
      await nextApp.init({
        antialias: true,
        autoStart: false,
        backgroundAlpha: 1,
        backgroundColor: 0xffffff,
        height: viewport.height,
        preference: "webgl",
        resolution: viewport.dpr,
        width: viewport.width,
      });

      if (destroyed) {
        nextApp.destroy({ removeView: true }, { children: true });
        return;
      }

      nextApp.canvas.className = "hex-canvas pixi-hex-canvas";
      nextApp.canvas.setAttribute("aria-hidden", "true");
      container.appendChild(nextApp.canvas as HTMLCanvasElement);
      app = nextApp;
      layers = createPixiStage(nextApp);
      terrainFill = new Graphics();
      previewGraphics = new Graphics();
      layers.terrain.addChild(terrainFill);
      layers.preview.addChild(previewGraphics);
      assets = await loadPixiAssetCatalog();
      contentDirty = true;
      invalidateLayerCaches();

      if (!destroyed) {
        syncBaseLayers("world");
        scheduleRender();
      }
    },
    resize: (width, height, devicePixelRatio) => {
      viewport = {
        dpr: devicePixelRatio,
        height,
        width,
      };

      if (!app) {
        return;
      }

      app.renderer.resize(width, height, devicePixelRatio);
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      activeWindow = null;
      contentDirty = true;
      syncBaseLayers("resize");
      scheduleRender();
    },
    clearPreview: () => {
      const mounted = requireMounted();

      if (!mounted) {
        return createEmptyStats();
      }

      const start = nowForRenderTiming();
      const layerTimings: PixiLayerTimings = {};
      timeLayer(layerTimings, "preview", () =>
        clearPixiPreviewLayer(mounted.previewGraphics, mounted.pools),
      );
      scheduleRender();

      return {
        ...createEmptyStats(layerTimings),
        graphicsCount: 1,
        pixiUpdateMs: Number((nowForRenderTiming() - start).toFixed(2)),
        spriteCount: countPixiRendererSprites(mounted.pools),
        visibleCellCount: activeFrame?.visibleTerrainCells.length ?? 0,
      };
    },
    setCamera: (camera) => {
      const previousCamera = cameraState;

      if (
        previousCamera &&
        (previousCamera.level !== camera.level ||
          previousCamera.featureVisibilityMode !==
            camera.featureVisibilityMode ||
          previousCamera.fogEditingActive !== camera.fogEditingActive ||
          isCoordinateLayerVisible(previousCamera) !==
            isCoordinateLayerVisible(camera))
      ) {
        contentDirty = true;
        activeWindow = null;
        invalidateLayerCaches();
      }

      cameraState = camera;
      return syncBaseLayers("camera");
    },
    setOverlay: (overlay) => {
      const mounted = requireMounted();

      if (!mounted || !activeFrame) {
        return createEmptyStats();
      }

      const start = nowForRenderTiming();
      const layerTimings: PixiLayerTimings = {};
      if (cameraState) {
        updateCameraTransform(mounted.layers, cameraState);
      }
      timeLayer(layerTimings, "overlay", () =>
        drawPixiOverlayLayer(
          mounted.layers.overlay,
          activeFrame as PixiSceneRenderFrame,
          overlay,
        ),
      );
      scheduleRender();

      return {
        ...createEmptyStats(layerTimings),
        graphicsCount: 1,
        pixiUpdateMs: Number((nowForRenderTiming() - start).toFixed(2)),
        spriteCount: countPixiRendererSprites(mounted.pools),
        visibleCellCount: activeFrame.visibleTerrainCells.length,
      };
    },
    setPreviewOperations: (operations) => {
      const mounted = requireMounted();

      if (!mounted || !activeFrame) {
        return createEmptyStats();
      }

      const start = nowForRenderTiming();
      const layerTimings: PixiLayerTimings = {};
      if (cameraState) {
        updateCameraTransform(mounted.layers, cameraState);
      }
      const count = timeLayer(layerTimings, "preview", () =>
        drawPixiPreviewLayer(
          mounted.previewGraphics,
          mounted.layers.preview,
          activeFrame as PixiSceneRenderFrame,
          operations,
          mounted.assets,
          mounted.pools,
        ),
      );
      scheduleRender();

      return {
        ...createEmptyStats(layerTimings),
        graphicsCount: 1,
        pixiUpdateMs: Number((nowForRenderTiming() - start).toFixed(2)),
        spriteCount: countPixiRendererSprites(mounted.pools),
        tiles: count,
        visibleCellCount: activeFrame.visibleTerrainCells.length,
      };
    },
    setTokens: (tokens) => {
      mapTokens = tokens;
      tokenCache = null;
      const mounted = requireMounted();

      if (!mounted || !activeFrame) {
        return createEmptyStats();
      }

      const start = nowForRenderTiming();
      const layerTimings: PixiLayerTimings = {};
      const count = timeLayer(layerTimings, "tokens", () =>
        drawPixiTokenLayer(
          mounted.layers.token,
          activeFrame as PixiSceneRenderFrame,
          mapTokens,
        ),
      );
      tokenCache = {
        key: `${activeFrame.transform.level}|manual|${mapTokens
          .map(
            (token) => `${token.userId}:${token.q},${token.r}:${token.color}`,
          )
          .sort()
          .join(";")}`,
        stats: count,
      };
      scheduleRender();

      return {
        ...createEmptyStats(layerTimings),
        graphicsCount: 1,
        pixiUpdateMs: Number((nowForRenderTiming() - start).toFixed(2)),
        spriteCount: countPixiRendererSprites(mounted.pools),
        tokens: count,
        visibleCellCount: activeFrame.visibleTerrainCells.length,
      };
    },
    setWorld: (world, patch) => {
      const start = nowForRenderTiming();

      if (!sceneCache) {
        sceneCache = createPixiMapSceneCache(world);
      } else if (!patch || patch.type === "snapshot") {
        sceneCache.markSnapshot(world);
      } else {
        sceneCache.applyOperations(world, patch.operations);
      }

      contentDirty = true;
      activeWindow = null;
      invalidateLayerCaches();
      const stats = syncBaseLayers("world");
      stats.sceneUpdateMs = Number(
        ((stats.sceneUpdateMs ?? 0) + nowForRenderTiming() - start).toFixed(2),
      );
      return stats;
    },
  };
}
