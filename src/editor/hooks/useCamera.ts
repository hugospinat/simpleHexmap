import { useCallback, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import {
  convertAxialBetweenLevels,
  type Axial
} from "@/core/geometry/hex";

type LevelView = {
  level: number;
  center: Axial;
};

export function useCamera(initialLevel = 1) {
  const clampedInitialLevel = Math.min(editorConfig.maxLevels, Math.max(1, initialLevel));
  const [view, setView] = useState<LevelView>({
    level: clampedInitialLevel,
    center: { q: 0, r: 0 }
  });
  const [visualZoom, setVisualZoom] = useState(1);

  const setCenter = useCallback((center: Axial) => {
    setView((previous) => ({ ...previous, center }));
  }, []);

  const changeVisualZoom = useCallback((nextZoom: number) => {
    setVisualZoom(nextZoom);
  }, []);

  const changeLevelByDelta = useCallback((delta: -1 | 1) => {
    setView((previous) => {
      const nextLevel = Math.min(editorConfig.maxLevels, Math.max(1, previous.level + delta));

      if (nextLevel === previous.level) {
        return previous;
      }

      return {
        ...previous,
        center: convertAxialBetweenLevels(previous.center, previous.level, nextLevel),
        level: nextLevel
      };
    });
  }, []);

  return {
    changeLevelByDelta,
    changeVisualZoom,
    setCenter,
    view,
    visualZoom
  };
}
