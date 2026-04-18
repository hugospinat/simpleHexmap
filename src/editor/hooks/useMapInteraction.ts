import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
  type SyntheticEvent
} from "react";
import {
  getNearestRiverEdgeAtPoint,
  getRiverEdgesAlongPointerMove,
  riverEdgesEqual
} from "@/core/geometry/edgeDetection";
import type { Viewport } from "@/render/renderTypes";
import { findMapTokenProfileAtPoint } from "@/editor/tokens/mapTokenHitTest";
import {
  getAxialLine,
  panCenterByScreenDelta,
  roundAxial,
  screenPixelToAxial,
  type Axial,
  type Pixel
} from "@/core/geometry/hex";
import type { EditGestureAction } from "@/editor/tools/editGesture";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { RiverEdgeRef, MapState } from "@/core/map/world";
import type { MapTokenRecord } from "@/core/protocol";
import { useLatestRef } from "./useLatestRef";
import { getPointerAction, getPointerTarget, type PointerSession } from "./mapPointerIntent";

type UseMapInteractionOptions = {
  activeTokenProfileId: string | null;
  canEdit: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  center: Axial;
  editMode: EditorMode;
  level: number;
  onCenterChange: (center: Axial) => void;
  onEditGestureEnd: () => void;
  onEditGestureMove: (axials: Axial[]) => void;
  onEditGestureStart: (action: EditGestureAction, axials: Axial[]) => void;
  onRiverGestureEnd: () => void;
  onRiverGestureMove: (edges: RiverEdgeRef[]) => void;
  onRiverGestureStart: (action: EditGestureAction, edges: RiverEdgeRef[]) => void;
  onHoveredHexChange: (axial: Axial | null) => void;
  onGmTokenPlace: (axial: Axial) => void;
  onGmTokenRemove: (profileId: string) => void;
  onPlayerTokenPlace: (axial: Axial) => void;
  mapTokens: readonly MapTokenRecord[];
  playerMode: boolean;
  viewport: Viewport;
  visualZoom: number;
  world: MapState;
};

export function useMapInteraction({
  activeTokenProfileId,
  canEdit,
  canvasRef,
  center,
  editMode,
  level,
  onCenterChange,
  onEditGestureEnd,
  onEditGestureMove,
  onEditGestureStart,
  onRiverGestureEnd,
  onRiverGestureMove,
  onRiverGestureStart,
  onHoveredHexChange,
  onGmTokenPlace,
  onGmTokenRemove,
  onPlayerTokenPlace,
  mapTokens,
  playerMode,
  viewport,
  visualZoom,
  world
}: UseMapInteractionOptions) {
  const [hoverRiverEdge, setHoverRiverEdge] = useState<RiverEdgeRef | null>(null);
  const pointerRef = useRef<PointerSession | null>(null);
  const hoveredHexRef = useRef<Axial | null>(null);
  const hoverRiverEdgeRef = useRef<RiverEdgeRef | null>(null);
  const pendingPanRef = useRef({ x: 0, y: 0 });
  const panFrameRef = useRef(0);
  const pendingEditAxialsRef = useRef<Axial[]>([]);
  const editFrameRef = useRef(0);
  const pendingRiverEdgesRef = useRef<RiverEdgeRef[]>([]);
  const riverFrameRef = useRef(0);

  const centerRef = useLatestRef(center);
  const editModeRef = useLatestRef(editMode);
  const activeTokenProfileIdRef = useLatestRef(activeTokenProfileId);
  const levelRef = useLatestRef(level);
  const zoomRef = useLatestRef(visualZoom);
  const viewportRef = useLatestRef(viewport);
  const onCenterChangeRef = useLatestRef(onCenterChange);
  const onEditGestureMoveRef = useLatestRef(onEditGestureMove);
  const onHoveredHexChangeRef = useLatestRef(onHoveredHexChange);
  const onRiverGestureMoveRef = useLatestRef(onRiverGestureMove);
  const onEditGestureEndRef = useLatestRef(onEditGestureEnd);
  const onRiverGestureEndRef = useLatestRef(onRiverGestureEnd);
  const onGmTokenPlaceRef = useLatestRef(onGmTokenPlace);
  const onGmTokenRemoveRef = useLatestRef(onGmTokenRemove);
  const mapTokensRef = useLatestRef(mapTokens);
  const worldRef = useLatestRef(world);

  const setHoveredHexIfChanged = useCallback((next: Axial | null) => {
    const previous = hoveredHexRef.current;

    if (
      (!previous && !next) ||
      (previous && next && previous.q === next.q && previous.r === next.r)
    ) {
      return;
    }

    hoveredHexRef.current = next;
    onHoveredHexChangeRef.current(next);
  }, [onHoveredHexChangeRef]);

  const setHoverRiverEdgeIfChanged = useCallback((next: RiverEdgeRef | null) => {
    if (riverEdgesEqual(hoverRiverEdgeRef.current, next)) {
      return;
    }

    hoverRiverEdgeRef.current = next;
    setHoverRiverEdge(next);
  }, []);

  useEffect(() => {
    if (editMode === "river") {
      setHoveredHexIfChanged(null);
    } else {
      setHoverRiverEdgeIfChanged(null);
    }
  }, [editMode, setHoveredHexIfChanged, setHoverRiverEdgeIfChanged]);

  const getCanvasPoint = useCallback(
    (event: PointerEvent<HTMLCanvasElement>): Pixel => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return { x: 0, y: 0 };
      }

      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    },
    [canvasRef]
  );

  const pointToAxial = useCallback(
    (point: Pixel): Axial => {
      const latestViewport = viewportRef.current;

      return roundAxial(
        screenPixelToAxial(point, centerRef.current, levelRef.current, zoomRef.current, {
          x: latestViewport.width,
          y: latestViewport.height
        })
      );
    },
    [centerRef, levelRef, viewportRef, zoomRef]
  );

  const updateHoveredHexFromPoint = useCallback(
    (point: Pixel) => {
      if (editModeRef.current === "river") {
        setHoveredHexIfChanged(null);
        return;
      }

      setHoveredHexIfChanged(pointToAxial(point));
    },
    [editModeRef, pointToAxial, setHoveredHexIfChanged]
  );

  const getEditLine = useCallback((pointer: PointerSession, axial: Axial): Axial[] => {
    return pointer.lastAxial ? getAxialLine(pointer.lastAxial, axial) : [axial];
  }, []);

  const getRiverEdgesFromPointerMove = useCallback(
    (pointer: PointerSession, fromPoint: Pixel, point: Pixel): RiverEdgeRef[] => {
      const result = getRiverEdgesAlongPointerMove(
        fromPoint,
        point,
        centerRef.current,
        levelRef.current,
        zoomRef.current,
        viewportRef.current,
        pointer.lastRiverEdge
      );
      pointer.lastRiverEdge = result.lastEdge;
      return result.edges;
    },
    [centerRef, levelRef, viewportRef, zoomRef]
  );

  const flushPendingEditMoves = useCallback(() => {
    const pending = pendingEditAxialsRef.current;

    if (pending.length === 0) {
      return;
    }

    pendingEditAxialsRef.current = [];
    onEditGestureMoveRef.current(pending);
  }, [onEditGestureMoveRef]);

  const flushPendingRiverMoves = useCallback(() => {
    const pending = pendingRiverEdgesRef.current;

    if (pending.length === 0) {
      return;
    }

    pendingRiverEdgesRef.current = [];
    onRiverGestureMoveRef.current(pending);
  }, [onRiverGestureMoveRef]);

  const scheduleEditMoveFlush = useCallback(() => {
    if (editFrameRef.current) {
      return;
    }

    editFrameRef.current = requestAnimationFrame(() => {
      editFrameRef.current = 0;
      flushPendingEditMoves();
    });
  }, [flushPendingEditMoves]);

  const scheduleRiverMoveFlush = useCallback(() => {
    if (riverFrameRef.current) {
      return;
    }

    riverFrameRef.current = requestAnimationFrame(() => {
      riverFrameRef.current = 0;
      flushPendingRiverMoves();
    });
  }, [flushPendingRiverMoves]);

  const schedulePanCenterUpdate = useCallback(() => {
    if (panFrameRef.current) {
      return;
    }

    panFrameRef.current = requestAnimationFrame(() => {
      panFrameRef.current = 0;
      const delta = pendingPanRef.current;
      pendingPanRef.current = { x: 0, y: 0 };

      if (delta.x === 0 && delta.y === 0) {
        return;
      }

      const nextCenter = panCenterByScreenDelta(
        centerRef.current,
        delta,
        levelRef.current,
        zoomRef.current
      );
      centerRef.current = nextCenter;
      onCenterChangeRef.current(nextCenter);
    });
  }, [centerRef, levelRef, onCenterChangeRef, zoomRef]);

  const stopPointerSession = useCallback(() => {
    const pointer = pointerRef.current;
    pointerRef.current = null;

    if (editFrameRef.current) {
      cancelAnimationFrame(editFrameRef.current);
      editFrameRef.current = 0;
    }

    if (panFrameRef.current) {
      cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = 0;
      pendingPanRef.current = { x: 0, y: 0 };
    }

    if (riverFrameRef.current) {
      cancelAnimationFrame(riverFrameRef.current);
      riverFrameRef.current = 0;
    }

    flushPendingEditMoves();
    flushPendingRiverMoves();

    if (pointer?.action === "paint" || pointer?.action === "erase") {
      if (pointer.target === "river") {
        onRiverGestureEndRef.current();
      } else {
        onEditGestureEndRef.current();
      }
    }
  }, [flushPendingEditMoves, flushPendingRiverMoves, onEditGestureEndRef, onRiverGestureEndRef]);

  useEffect(() => {
    return () => {
      stopPointerSession();
    };
  }, [stopPointerSession]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const pointerAction = getPointerAction(event.button);
      const playerPointerAction = playerMode
        ? event.button === 2
          ? "pan"
          : event.button === 0
            ? "paint"
            : null
        : pointerAction;

      if (!playerPointerAction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = getCanvasPoint(event);

      if (playerPointerAction === "pan") {
        pointerRef.current = {
          ...point,
          action: "pan",
          lastAxial: null,
          lastRiverEdge: null,
          moved: false,
          target: "cells"
        };
        return;
      }

      if (playerMode) {
        const axial = pointToAxial(point);
        setHoveredHexIfChanged(axial);
        onPlayerTokenPlace(axial);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }

      if (!canEdit) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }

      if (editModeRef.current === "fog" && activeTokenProfileIdRef.current && (event.button === 0 || event.button === 2)) {
        if (event.button === 0) {
          const axial = pointToAxial(point);
          setHoveredHexIfChanged(axial);
          onGmTokenPlaceRef.current(axial);
        } else {
          const profileId = findMapTokenProfileAtPoint({
            center: centerRef.current,
            level: levelRef.current,
            point,
            tokens: mapTokensRef.current,
            viewport: viewportRef.current,
            visualZoom: zoomRef.current,
            world: worldRef.current
          });

          if (profileId) {
            onGmTokenRemoveRef.current(profileId);
          }
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }

      const action: EditGestureAction = playerPointerAction;
      const target = getPointerTarget(editModeRef.current, action);

      if (target === "river") {
        const riverEdge = getNearestRiverEdgeAtPoint(
          point,
          centerRef.current,
          levelRef.current,
          zoomRef.current,
          viewportRef.current
        );

        if (!riverEdge) {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          return;
        }

        pointerRef.current = {
          ...point,
          action,
          lastAxial: null,
          lastRiverEdge: riverEdge,
          moved: false,
          target: "river"
        };
        setHoverRiverEdgeIfChanged(riverEdge);
        onRiverGestureStart(action, [riverEdge]);
        return;
      }

      const axial = pointToAxial(point);
      setHoveredHexIfChanged(axial);
      pointerRef.current = {
        ...point,
        action,
        lastAxial: axial,
        lastRiverEdge: null,
        moved: false,
        target: "cells"
      };
      onEditGestureStart(action, [axial]);
    },
    [
      canEdit,
      activeTokenProfileIdRef,
      centerRef,
      editModeRef,
      getCanvasPoint,
      levelRef,
      mapTokensRef,
      onEditGestureStart,
      onGmTokenPlaceRef,
      onGmTokenRemoveRef,
      onRiverGestureStart,
      onPlayerTokenPlace,
      pointToAxial,
      playerMode,
      setHoveredHexIfChanged,
      setHoverRiverEdgeIfChanged,
      viewportRef,
      worldRef,
      zoomRef
    ]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const pointer = pointerRef.current;

      if (!pointer) {
        if (editModeRef.current === "river") {
          const point = getCanvasPoint(event);
          const riverEdge = getNearestRiverEdgeAtPoint(
            point,
            centerRef.current,
            levelRef.current,
            zoomRef.current,
            viewportRef.current
          );
          setHoverRiverEdgeIfChanged(riverEdge);
        } else {
          updateHoveredHexFromPoint(getCanvasPoint(event));
        }
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const point = getCanvasPoint(event);
      updateHoveredHexFromPoint(point);
      const fromPoint = { x: pointer.x, y: pointer.y };
      const delta = {
        x: point.x - pointer.x,
        y: point.y - pointer.y
      };

      pointer.x = point.x;
      pointer.y = point.y;

      if (pointer.action === "pan" && (delta.x !== 0 || delta.y !== 0)) {
        pointer.moved = true;
        pendingPanRef.current = {
          x: pendingPanRef.current.x + delta.x,
          y: pendingPanRef.current.y + delta.y
        };
        schedulePanCenterUpdate();
        return;
      }

      if (pointer.action === "paint" || pointer.action === "erase") {
        if (pointer.target === "river") {
          const edges = getRiverEdgesFromPointerMove(pointer, fromPoint, point);

          if (edges.length > 0) {
            pointer.moved = true;
            pendingRiverEdgesRef.current.push(...edges);
            setHoverRiverEdgeIfChanged(edges[edges.length - 1]);
            scheduleRiverMoveFlush();
          } else {
            setHoverRiverEdgeIfChanged(pointer.lastRiverEdge);
          }

          return;
        }

        const axial = pointToAxial(point);
        const line = getEditLine(pointer, axial);
        pointer.lastAxial = axial;

        if (line.length > 0) {
          pointer.moved = true;
          pendingEditAxialsRef.current.push(...line);
          scheduleEditMoveFlush();
        }
      }
    },
    [
      centerRef,
      editModeRef,
      getCanvasPoint,
      getEditLine,
      getRiverEdgesFromPointerMove,
      levelRef,
      pointToAxial,
      scheduleEditMoveFlush,
      schedulePanCenterUpdate,
      scheduleRiverMoveFlush,
      setHoverRiverEdgeIfChanged,
      updateHoveredHexFromPoint,
      viewportRef,
      zoomRef
    ]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const point = getCanvasPoint(event);
      const pointer = pointerRef.current;

      if (!pointer) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }

      if (pointer.action === "paint" || pointer.action === "erase") {
        if (pointer.target === "river") {
          const edges = getRiverEdgesFromPointerMove(pointer, { x: pointer.x, y: pointer.y }, point);

          if (edges.length > 0) {
            pendingRiverEdgesRef.current.push(...edges);
            setHoverRiverEdgeIfChanged(edges[edges.length - 1]);
          } else {
            setHoverRiverEdgeIfChanged(pointer.lastRiverEdge);
          }
        } else {
          const axial = pointToAxial(point);
          const line = getEditLine(pointer, axial);
          setHoveredHexIfChanged(axial);

          if (line.length > 0) {
            pendingEditAxialsRef.current.push(...line);
          }
        }
      }

      stopPointerSession();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [
      getCanvasPoint,
      getEditLine,
      getRiverEdgesFromPointerMove,
      pointToAxial,
      setHoveredHexIfChanged,
      setHoverRiverEdgeIfChanged,
      stopPointerSession
    ]
  );

  const handlePointerLeave = useCallback(() => {
    if (editModeRef.current === "river") {
      if (!pointerRef.current) {
        setHoverRiverEdgeIfChanged(null);
      }
      return;
    }

    setHoveredHexIfChanged(null);
  }, [editModeRef, setHoveredHexIfChanged, setHoverRiverEdgeIfChanged]);

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.stopPropagation();
      stopPointerSession();
      if (editModeRef.current === "river") {
        setHoverRiverEdgeIfChanged(null);
      } else {
        setHoveredHexIfChanged(null);
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [editModeRef, setHoveredHexIfChanged, setHoverRiverEdgeIfChanged, stopPointerSession]
  );

  const preventDefault = useCallback((event: SyntheticEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    handlers: {
      onAuxClick: preventDefault,
      onContextMenu: preventDefault,
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerLeave: handlePointerLeave,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp
    },
    hoverRiverEdge
  };
}
