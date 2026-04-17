import { useEffect, useRef, type RefObject } from "react";
import { panCenterByScreenDelta, type Axial } from "@/core/geometry/hex";

type KeyboardNavigationOptions = {
  center: Axial;
  enabled?: boolean;
  level: number;
  panPixelsPerSecond: number;
  visualZoom: number;
  onCenterChange: (center: Axial) => void;
  onLevelStep: (delta: -1 | 1) => void;
  onRedo: () => void;
  onToggleCoordinates: () => void;
  onUndo: () => void;
  rootRef?: RefObject<HTMLElement | null>;
};

const movementKeys = new Set(["z", "q", "s", "d"]);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function isAppFocused(root: HTMLElement | null): boolean {
  if (!root) {
    return true;
  }

  const activeElement = document.activeElement;
  return activeElement === document.body || activeElement === root || root.contains(activeElement);
}

export function useKeyboardNavigation({
  center,
  enabled = true,
  level,
  panPixelsPerSecond,
  visualZoom,
  onCenterChange,
  onLevelStep,
  onRedo,
  onToggleCoordinates,
  onUndo,
  rootRef
}: KeyboardNavigationOptions) {
  const centerRef = useRef(center);
  const levelRef = useRef(level);
  const visualZoomRef = useRef(visualZoom);
  const onCenterChangeRef = useRef(onCenterChange);
  const onLevelStepRef = useRef(onLevelStep);
  const onRedoRef = useRef(onRedo);
  const onToggleCoordinatesRef = useRef(onToggleCoordinates);
  const onUndoRef = useRef(onUndo);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    visualZoomRef.current = visualZoom;
  }, [visualZoom]);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    onLevelStepRef.current = onLevelStep;
  }, [onLevelStep]);

  useEffect(() => {
    onRedoRef.current = onRedo;
  }, [onRedo]);

  useEffect(() => {
    onToggleCoordinatesRef.current = onToggleCoordinates;
  }, [onToggleCoordinates]);

  useEffect(() => {
    onUndoRef.current = onUndo;
  }, [onUndo]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const pressedKeys = new Set<string>();
    let animationFrame = 0;
    let lastTimestamp: number | null = null;

    const stopAnimation = () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      lastTimestamp = null;
    };

    const tick = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const elapsedSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;

      const xDirection = (pressedKeys.has("d") ? 1 : 0) - (pressedKeys.has("q") ? 1 : 0);
      const yDirection = (pressedKeys.has("s") ? 1 : 0) - (pressedKeys.has("z") ? 1 : 0);

      if (xDirection !== 0 || yDirection !== 0) {
        const diagonalScale = xDirection !== 0 && yDirection !== 0 ? Math.SQRT1_2 : 1;
        const distance = panPixelsPerSecond * elapsedSeconds * diagonalScale;
        const nextCenter = panCenterByScreenDelta(
          centerRef.current,
          {
            x: -xDirection * distance,
            y: -yDirection * distance
          },
          levelRef.current,
          visualZoomRef.current
        );
        centerRef.current = nextCenter;
        onCenterChangeRef.current(nextCenter);
      }

      if ([...pressedKeys].some((key) => movementKeys.has(key))) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        stopAnimation();
      }
    };

    const ensureAnimation = () => {
      if (!animationFrame) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (!isAppFocused(rootRef?.current ?? null)) {
        return;
      }

      const key = event.key.toLowerCase();
      const isModifierShortcut = event.ctrlKey || event.metaKey;

      if (isModifierShortcut && key === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          onRedoRef.current();
        } else {
          onUndoRef.current();
        }

        return;
      }

      if (!isModifierShortcut && key === "w") {
        event.preventDefault();
        onToggleCoordinatesRef.current();
        return;
      }

      if (!isModifierShortcut && key === "a") {
        event.preventDefault();
        onLevelStepRef.current(-1);
        return;
      }

      if (!isModifierShortcut && key === "e") {
        event.preventDefault();
        onLevelStepRef.current(1);
        return;
      }

      if (!movementKeys.has(key)) {
        return;
      }

      event.preventDefault();

      pressedKeys.add(key);
      ensureAnimation();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (!movementKeys.has(key)) {
        return;
      }

      event.preventDefault();
      pressedKeys.delete(key);
    };

    const handleBlur = () => {
      pressedKeys.clear();
      stopAnimation();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      stopAnimation();
    };
  }, [enabled, panPixelsPerSecond, rootRef]);
}
