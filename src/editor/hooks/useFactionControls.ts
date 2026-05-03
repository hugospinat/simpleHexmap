import { useCallback, useRef } from "react";
import type { MapOperation } from "@/core/protocol";
import {
  commandAddFaction,
  commandRemoveFaction,
  commandUpdateFaction
} from "@/core/map/commands/mapEditCommands";
import type { EditorMode } from "@/editor/tools";
import type { Faction, MapState } from "@/core/map/world";

const defaultFactionColors = [
  "#d94f3d",
  "#3668d8",
  "#2f9d5a",
  "#b76ad8",
  "#d89f2f",
  "#1fa9a3"
];

type UseFactionControlsOptions = {
  activeFactionId: string | null;
  canEdit: boolean;
  commitLocalOperations: (operations: MapOperation[]) => void;
  factionCount: number;
  presentWorld: MapState;
  setActiveFactionId: (factionId: string | null) => void;
  setActiveMode: (mode: EditorMode) => void;
};

export function useFactionControls({
  activeFactionId,
  canEdit,
  commitLocalOperations,
  factionCount,
  presentWorld,
  setActiveFactionId,
  setActiveMode
}: UseFactionControlsOptions) {
  const factionIdRef = useRef(0);

  const createFactionId = useCallback(() => {
    factionIdRef.current += 1;
    return `faction-${Date.now()}-${factionIdRef.current}`;
  }, []);

  const createFaction = useCallback(() => {
    if (!canEdit) {
      return;
    }

    const factionNumber = factionCount + 1;
    const nextFaction: Faction = {
      id: createFactionId(),
      name: `Faction ${factionNumber}`,
      color: defaultFactionColors[(factionNumber - 1) % defaultFactionColors.length]
    };
    const result = commandAddFaction(presentWorld, nextFaction);

    if (result.operations.length > 0) {
      commitLocalOperations(result.operations);
      setActiveFactionId(nextFaction.id);
      setActiveMode("faction");
    }
  }, [canEdit, commitLocalOperations, createFactionId, factionCount, presentWorld, setActiveFactionId, setActiveMode]);

  const renameFaction = useCallback((factionId: string, name: string) => {
    if (!canEdit) {
      return;
    }

    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    const result = commandUpdateFaction(presentWorld, factionId, { name: trimmed });

    if (result.operations.length > 0) {
      commitLocalOperations(result.operations);
    }
  }, [canEdit, commitLocalOperations, presentWorld]);

  const recolorFaction = useCallback((factionId: string, color: string) => {
    if (!canEdit) {
      return;
    }

    const result = commandUpdateFaction(presentWorld, factionId, { color });

    if (result.operations.length > 0) {
      commitLocalOperations(result.operations);
    }
  }, [canEdit, commitLocalOperations, presentWorld]);

  const deleteFaction = useCallback((factionId: string) => {
    if (!canEdit) {
      return;
    }

    const result = commandRemoveFaction(presentWorld, factionId);

    if (result.operations.length > 0) {
      commitLocalOperations(result.operations);
    }

    if (activeFactionId === factionId) {
      setActiveFactionId(null);
    }
  }, [activeFactionId, canEdit, commitLocalOperations, presentWorld, setActiveFactionId]);

  return {
    createFaction,
    deleteFaction,
    recolorFaction,
    renameFaction
  };
}
