import { useCallback, useState } from "react";
import { editorConfig } from "@/config/editorConfig";
import {
  convertAxialBetweenLevels,
  type Axial
} from "@/domain/geometry/hex";
import { getLevelFromZoom } from "@/editor/tools/levelAutoSwitch";

type LevelView = {
  level: number;
  center: Axial;
};

export function useCamera() {
  const [view, setView] = useState<LevelView>({ level: 1, center: { q: 0, r: 0 } });
  const [visualZoom, setVisualZoom] = useState(1);

  const setCenter = useCallback((center: Axial) => {
    setView((previous) => ({ ...previous, center }));
  }, []);

  const changeVisualZoom = useCallback((nextZoom: number) => {
    setVisualZoom(nextZoom);

    setView((previous) => {
      const targetLevel = getLevelFromZoom(nextZoom, editorConfig.levelZoomThresholds);

      if (targetLevel === previous.level) {
        return previous;
      }

      return {
        ...previous,
        center: convertAxialBetweenLevels(previous.center, previous.level, targetLevel),
        level: targetLevel
      };
    });
  }, []);

  return {
    changeVisualZoom,
    setCenter,
    view,
    visualZoom
  };
}
