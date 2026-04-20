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
  userId: string;
  sendTokenOperation: (operation: MapTokenOperation) => void;
  viewLevel: number;
  visibleWorld: MapState;
};

type UseTokenControlsResult = {
  activeTokenUserId: string | null;
  clearMapTokenSelection: () => void;
  placePlayerToken: (axial: Axial) => void;
  placeSelectedMapToken: (axial: Axial) => void;
  playerTokenColor: string;
  removeMapToken: (userId: string) => void;
  selectMapTokenMember: (member: WorkspaceTokenMemberRecord) => void;
  setPlayerTokenColor: (color: string) => void;
};

export function useTokenControls({
  canEdit,
  mapId,
  mapTokens,
  userId,
  role,
  sendTokenOperation,
  viewLevel,
  visibleWorld,
}: UseTokenControlsOptions): UseTokenControlsResult {
  const [activeTokenUserId, setActiveTokenUserId] = useState<string | null>(
    null,
  );
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
        userId,
        color,
      });
    },
    [sendTokenOperation, userId],
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
          userId,
          q: axial.q,
          r: axial.r,
          color: playerTokenColor,
        },
      });
    },
    [
      playerTokenColor,
      role,
      sendTokenOperation,
      userId,
      viewLevel,
      visibleWorld,
    ],
  );

  const selectMapTokenMember = useCallback(
    (member: WorkspaceTokenMemberRecord) => {
      if (!canEdit) {
        return;
      }

      if (activeTokenUserId === member.userId) {
        setActiveTokenUserId(null);
        return;
      }

      setActiveTokenUserId(member.userId);
      setActiveTokenColor(member.color);
    },
    [activeTokenUserId, canEdit],
  );

  const clearMapTokenSelection = useCallback(() => {
    if (!canEdit) {
      return;
    }

    setActiveTokenUserId(null);
  }, [canEdit]);

  const placeSelectedMapToken = useCallback(
    (axial: Axial) => {
      if (!canEdit || !activeTokenUserId) {
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
          userId: activeTokenUserId,
          q: axial.q,
          r: axial.r,
          color: activeTokenColor,
        },
      });
    },
    [
      activeTokenColor,
      activeTokenUserId,
      canEdit,
      sendTokenOperation,
      viewLevel,
      visibleWorld,
    ],
  );

  const removeMapToken = useCallback(
    (tokenUserId: string) => {
      if (!canEdit) {
        return;
      }

      const token = mapTokens.find(
        (candidate) => candidate.userId === tokenUserId,
      );

      if (token) {
        setActiveTokenUserId(token.userId);
        setActiveTokenColor(token.color);
      }

      sendTokenOperation({
        type: "remove_map_token",
        userId: tokenUserId,
      });
    },
    [canEdit, mapTokens, sendTokenOperation],
  );

  useEffect(() => {
    setActiveTokenUserId(null);
    setActiveTokenColor(defaultWorkspaceTokenColor);
  }, [mapId]);

  return {
    activeTokenUserId,
    clearMapTokenSelection,
    placePlayerToken,
    placeSelectedMapToken,
    playerTokenColor,
    removeMapToken,
    selectMapTokenMember,
    setPlayerTokenColor,
  };
}
