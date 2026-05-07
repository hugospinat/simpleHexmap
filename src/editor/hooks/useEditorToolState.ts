import { useCallback, useMemo, useState } from "react";
import type { Axial } from "@/core/geometry/hex";
import { editorModeOrder, type EditorMode } from "@/editor/tools";
import type { FeatureKind } from "@/core/map/features";
import type { TerrainType } from "@/core/map/world";

export function useEditorToolState(canEdit: boolean) {
  const [activeMode, setActiveModeState] = useState<EditorMode>("terrain");
  const [activeType, setActiveType] = useState<TerrainType>("plain");
  const [activeFeatureKind, setActiveFeatureKind] =
    useState<FeatureKind>("city");
  const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
  const [activeNoteHex, setActiveNoteHex] = useState<Axial | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [hoveredHex, setHoveredHex] = useState<import("@/core/geometry/hex").Axial | null>(null);

  const chooseFeatureKind = useCallback(
    (type: FeatureKind) => {
      if (!canEdit) {
        return;
      }

      setActiveFeatureKind(type);
      setActiveModeState("feature");
    },
    [canEdit],
  );

  const setActiveMode = useCallback(
    (mode: EditorMode) => {
      if (!canEdit) {
        return;
      }

      setActiveModeState(mode);
    },
    [canEdit],
  );

  const changeToolByDelta = useCallback(
    (delta: 1 | -1) => {
      if (!canEdit) {
        return;
      }

      const currentIndex = editorModeOrder.indexOf(activeMode);
      const nextIndex =
        (currentIndex + delta + editorModeOrder.length) % editorModeOrder.length;
      setActiveMode(editorModeOrder[nextIndex]);
    },
    [activeMode, canEdit, setActiveMode],
  );

  const toggleCoordinates = useCallback(() => {
    setShowCoordinates((previous) => !previous);
  }, []);

  return useMemo(
    () => ({
      activeFactionId,
      activeFeatureKind,
      activeMode,
      activeNoteHex,
      activeType,
      changeToolByDelta,
      chooseFeatureKind,
      hoveredHex,
      setActiveFactionId,
      setActiveMode,
      setActiveNoteHex,
      setActiveType,
      setHoveredHex,
      showCoordinates,
      toggleCoordinates,
    }),
    [
      activeFactionId,
      activeFeatureKind,
      activeMode,
      activeNoteHex,
      activeType,
      changeToolByDelta,
      chooseFeatureKind,
      hoveredHex,
      setActiveFactionId,
      setActiveMode,
      setActiveNoteHex,
      setActiveType,
      setHoveredHex,
      showCoordinates,
      toggleCoordinates,
    ],
  );
}
