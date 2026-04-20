import { useCallback, useEffect, useState } from "react";
import { hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { getLevelMap } from "@/core/map/world";
import type { MapState } from "@/core/map/world";
import type {
  MapOpenMode,
  WorkspaceTokenMemberRecord,
} from "@/core/auth/authTypes";
import { defaultWorkspaceTokenColor } from "@/core/auth/authTypes";
import type { MapTokenOperation, MapTokenRecord } from "@/core/protocol";

type UseTokenControlsOptions = {
  canEdit: boolean;
  mapId: string;
  mapTokens: readonly MapTokenRecord[];
  role: MapOpenMode;
  profileId: string;
  sendTokenOperation: (operation: MapTokenOperation) => void;
  viewLevel: number;
  visibleWorld: MapState;
};

type UseTokenControlsResult = {
  activeTokenProfileId: string | null;
  clearMapTokenSelection: () => void;
  placePlayerToken: (axial: Axial) => void;
  placeSelectedMapToken: (axial: Axial) => void;
  playerTokenColor: string;
  removeMapToken: (profileId: string) => void;
  selectMapTokenMember: (member: WorkspaceTokenMemberRecord) => void;
  setPlayerTokenColor: (color: string) => void;
};

export function useTokenControls({
  canEdit,
  mapId,
  mapTokens,
  profileId,
  role,
  sendTokenOperation,
  viewLevel,
  visibleWorld,
}: UseTokenControlsOptions): UseTokenControlsResult {
  const [activeTokenProfileId, setActiveTokenProfileId] = useState<
    string | null
  >(null);
  const [activeTokenColor, setActiveTokenColor] = useState(
    defaultWorkspaceTokenColor,
  );
  const [playerTokenColor, setPlayerTokenColorState] = useState(() => {
    try {
      return (
        window.localStorage.getItem("simplehex:token-color") ??
        defaultWorkspaceTokenColor
      );
    } catch {
      return defaultWorkspaceTokenColor;
    }
  });

  const setPlayerTokenColor = useCallback(
    (color: string) => {
      setPlayerTokenColorState(color);

      try {
        window.localStorage.setItem("simplehex:token-color", color);
      } catch {
        // Ignore storage failures; the selected color still works for this session.
      }

      sendTokenOperation({
        type: "set_map_token_color",
        profileId,
        color,
      });
    },
    [profileId, sendTokenOperation],
  );

  const placePlayerToken = useCallback(
    (axial: Axial) => {
      if (role !== "player") {
        return;
      }

      if (viewLevel !== SOURCE_LEVEL) {
        return;
      }

      const cell = getLevelMap(visibleWorld, viewLevel).get(hexKey(axial));

      if (!cell || cell.hidden) {
        return;
      }

      sendTokenOperation({
        type: "set_map_token",
        token: {
          profileId,
          q: axial.q,
          r: axial.r,
          color: playerTokenColor,
        },
      });
    },
    [
      playerTokenColor,
      profileId,
      role,
      sendTokenOperation,
      viewLevel,
      visibleWorld,
    ],
  );

  const selectMapTokenMember = useCallback(
    (member: WorkspaceTokenMemberRecord) => {
      if (!canEdit) {
        return;
      }

      if (activeTokenProfileId === member.userId) {
        setActiveTokenProfileId(null);
        return;
      }

      setActiveTokenProfileId(member.userId);
      setActiveTokenColor(member.color);
    },
    [activeTokenProfileId, canEdit],
  );

  const clearMapTokenSelection = useCallback(() => {
    if (!canEdit) {
      return;
    }

    setActiveTokenProfileId(null);
  }, [canEdit]);

  const placeSelectedMapToken = useCallback(
    (axial: Axial) => {
      if (!canEdit || !activeTokenProfileId) {
        return;
      }

      if (viewLevel !== SOURCE_LEVEL) {
        return;
      }

      const cell = getLevelMap(visibleWorld, viewLevel).get(hexKey(axial));

      if (!cell || cell.hidden) {
        return;
      }

      sendTokenOperation({
        type: "set_map_token",
        token: {
          profileId: activeTokenProfileId,
          q: axial.q,
          r: axial.r,
          color: activeTokenColor,
        },
      });
    },
    [
      activeTokenColor,
      activeTokenProfileId,
      canEdit,
      sendTokenOperation,
      viewLevel,
      visibleWorld,
    ],
  );

  const removeMapToken = useCallback(
    (tokenProfileId: string) => {
      if (!canEdit) {
        return;
      }

      const token = mapTokens.find(
        (candidate) => candidate.profileId === tokenProfileId,
      );

      if (token) {
        setActiveTokenProfileId(token.profileId);
        setActiveTokenColor(token.color);
      }

      sendTokenOperation({
        type: "remove_map_token",
        profileId: tokenProfileId,
      });
    },
    [canEdit, mapTokens, sendTokenOperation],
  );

  useEffect(() => {
    setActiveTokenProfileId(null);
    setActiveTokenColor(defaultWorkspaceTokenColor);
  }, [mapId]);

  return {
    activeTokenProfileId,
    clearMapTokenSelection,
    placePlayerToken,
    placeSelectedMapToken,
    playerTokenColor,
    removeMapToken,
    selectMapTokenMember,
    setPlayerTokenColor,
  };
}
