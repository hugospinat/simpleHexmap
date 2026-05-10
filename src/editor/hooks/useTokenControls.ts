import { useCallback, useEffect, useState } from "react";
import { hexKey, type Axial } from "@/core/geometry/hex";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import { getLevelMap } from "@/core/map/world";
import type { MapState } from "@/core/map/world";
import type { MapOpenMode, WorkspaceMember } from "@/core/auth/authTypes";
import { defaultWorkspaceTokenColor } from "@/core/auth/authTypes";
import type { MapTokenOperation, MapTokenPlacement } from "@/core/protocol";

type UseTokenControlsOptions = {
  canEdit: boolean;
  mapId: string;
  mapTokens: readonly MapTokenPlacement[];
  role: MapOpenMode;
  userId: string;
  sendTokenOperation: (operation: MapTokenOperation) => void;
  viewLevel: number;
  visibleWorld: MapState;
  workspaceMembers: readonly WorkspaceMember[];
};

type UseTokenControlsResult = {
  activeTokenUserId: string | null;
  clearMapTokenSelection: () => void;
  placePlayerToken: (axial: Axial) => void;
  placeSelectedMapToken: (axial: Axial) => void;
  playerTokenColor: string;
  removeMapToken: (userId: string) => void;
  selectWorkspaceMember: (member: WorkspaceMember) => void;
  setMapTokenColor: (tokenUserId: string, color: string) => void;
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
  workspaceMembers,
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

  const setMapTokenColor = useCallback(
    (tokenUserId: string, color: string) => {
      if (tokenUserId !== userId && !canEdit) {
        return;
      }

      if (tokenUserId === userId) {
        setPlayerTokenColorState(color);
      }

      if (activeTokenUserId === tokenUserId) {
        setActiveTokenColor(color);
      }

      try {
        window.localStorage.setItem("simplehex:token-color", color);
      } catch {
        // Ignore storage failures; the selected color still works for this session.
      }

      sendTokenOperation({
        type: "set_map_token_color",
        userId: tokenUserId,
        color,
      });
    },
    [activeTokenUserId, canEdit, sendTokenOperation, userId],
  );

  const setPlayerTokenColor = useCallback(
    (color: string) => {
      setMapTokenColor(userId, color);
    },
    [setMapTokenColor, userId],
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
        placement: {
          userId,
          q: axial.q,
          r: axial.r,
        },
      });
    },
    [
      role,
      sendTokenOperation,
      userId,
      viewLevel,
      visibleWorld,
    ],
  );

  const selectWorkspaceMember = useCallback(
    (member: WorkspaceMember) => {
      if (!canEdit) {
        return;
      }

      if (activeTokenUserId === member.userId) {
        setActiveTokenUserId(null);
        return;
      }

      setActiveTokenUserId(member.userId);
      setActiveTokenColor(member.tokenColor);
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
        placement: {
          userId: activeTokenUserId,
          q: axial.q,
          r: axial.r,
        },
      });
    },
    [
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

  useEffect(() => {
    const currentUserMember = workspaceMembers.find(
      (member) => member.userId === userId,
    );

    if (!currentUserMember || currentUserMember.tokenColor === playerTokenColor) {
      return;
    }

    setPlayerTokenColorState(currentUserMember.tokenColor);

    try {
      window.localStorage.setItem(
        "simplehex:token-color",
        currentUserMember.tokenColor,
      );
    } catch {
      // Ignore storage failures; the server-backed color remains in memory.
    }
  }, [playerTokenColor, userId, workspaceMembers]);

  useEffect(() => {
    if (!activeTokenUserId) {
      return;
    }

    const activeMember = workspaceMembers.find(
      (member) => member.userId === activeTokenUserId,
    );

    if (activeMember && activeMember.tokenColor !== activeTokenColor) {
      setActiveTokenColor(activeMember.tokenColor);
    }
  }, [activeTokenColor, activeTokenUserId, workspaceMembers]);

  return {
    activeTokenUserId,
    clearMapTokenSelection,
    placePlayerToken,
    placeSelectedMapToken,
    playerTokenColor,
    removeMapToken,
    selectWorkspaceMember,
    setMapTokenColor,
    setPlayerTokenColor,
  };
}
