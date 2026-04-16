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
} from "@/domain/geometry/edgeDetection";
import type { Viewport } from "@/domain/rendering/renderTypes";
import {
  getAxialLine,
  panCenterByScreenDelta,
  roundAxial,
  screenPixelToAxial,
  type Axial,
  type Pixel
} from "@/domain/geometry/hex";
import type { EditGestureAction } from "@/editor/tools/editGesture";
import type { EditorMode } from "@/editor/tools/editorTypes";
import type { RiverEdgeRef } from "@/domain/world/world";
import { useLatestRef } from "./useLatestRef";

type PointerAction = EditGestureAction | "pan";

type PointerSession = {
  action: PointerAction;
  target: "cells" | "river";
  lastAxial: Axial | null;
  lastRiverEdge: RiverEdgeRef | null;
  moved: boolean;
  x: number;
  y: number;
};

type UseMapInteractionOptions = {
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
  viewport: Viewport;
  visualZoom: number;
};

export function useMapInteraction({
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
  viewport,
  visualZoom
}: UseMapInteractionOptions) {
  const [hoverRiverEdge, setHoverRiverEdge] = useState<RiverEdgeRef | null>(null);
  const pointerRef = useRef<PointerSession | null>(null);
  const hoverRiverEdgeRef = useRef<RiverEdgeRef | null>(null);
  const pendingPanRef = useRef({ x: 0, y: 0 });
  const panFrameRef = useRef(0);
  const pendingEditAxialsRef = useRef<Axial[]>([]);
  const editFrameRef = useRef(0);
  const pendingRiverEdgesRef = useRef<RiverEdgeRef[]>([]);
  const riverFrameRef = useRef(0);

  const centerRef = useLatestRef(center);
  const editModeRef = useLatestRef(editMode);
  const levelRef = useLatestRef(level);
  const zoomRef = useLatestRef(visualZoom);
  const viewportRef = useLatestRef(viewport);
  const onCenterChangeRef = useLatestRef(onCenterChange);
  const onEditGestureMoveRef = useLatestRef(onEditGestureMove);
  const onHoveredHexChangeRef = useLatestRef(onHoveredHexChange);
  const onRiverGestureMoveRef = useLatestRef(onRiverGestureMove);
  const onEditGestureEndRef = useLatestRef(onEditGestureEnd);
  const onRiverGestureEndRef = useLatestRef(onRiverGestureEnd);

  const setHoverRiverEdgeIfChanged = useCallback((next: RiverEdgeRef | null) => {
    if (riverEdgesEqual(hoverRiverEdgeRef.current, next)) {
      return;
    }

    hoverRiverEdgeRef.current = next;
    setHoverRiverEdge(next);
  }, []);

  useEffect(() => {
    if (editMode === "river") {
      onHoveredHexChangeRef.current(null);
    } else {
      setHoverRiverEdgeIfChanged(null);
    }
  }, [editMode, onHoveredHexChangeRef, setHoverRiverEdgeIfChanged]);

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
        onHoveredHexChangeRef.current(null);
        return;
      }

      onHoveredHexChangeRef.current(pointToAxial(point));
    },
    [editModeRef, onHoveredHexChangeRef, pointToAxial]
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
      if (![0, 1, 2].includes(event.button)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = getCanvasPoint(event);

      if (event.button === 1) {
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

      const action: EditGestureAction = event.button === 0 ? "paint" : "erase";

      if (editModeRef.current === "river") {
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
      onHoveredHexChangeRef.current(axial);
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
      centerRef,
      editModeRef,
      getCanvasPoint,
      levelRef,
      onEditGestureStart,
      onRiverGestureStart,
      onHoveredHexChangeRef,
      pointToAxial,
      setHoverRiverEdgeIfChanged,
      viewportRef,
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
          onHoveredHexChangeRef.current(axial);

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
      onHoveredHexChangeRef,
      pointToAxial,
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

    onHoveredHexChangeRef.current(null);
  }, [editModeRef, onHoveredHexChangeRef, setHoverRiverEdgeIfChanged]);

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.stopPropagation();
      stopPointerSession();
      if (editModeRef.current === "river") {
        setHoverRiverEdgeIfChanged(null);
      } else {
        onHoveredHexChangeRef.current(null);
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [editModeRef, onHoveredHexChangeRef, setHoverRiverEdgeIfChanged, stopPointerSession]
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
