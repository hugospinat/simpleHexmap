import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openObsidianProtocolUrl, requestObsidianNoteLaunch } from "@/app/api";
import type { Axial } from "@/core/geometry/hex";

type LaunchState = {
  isLaunching: boolean;
  noteStatus: string;
  openSelectedNoteInObsidian: () => Promise<void>;
};

export function useObsidianNoteLauncher(input: {
  activeMode: string;
  mapId: string;
  selectedHex: Axial | null;
}): LaunchState {
  const { activeMode, mapId, selectedHex } = input;
  const [isLaunching, setIsLaunching] = useState(false);
  const [noteStatus, setNoteStatus] = useState(
    "Select a hex to open its GM note in Obsidian.",
  );
  const lastOpenedHexKeyRef = useRef<string | null>(null);
  const selectedHexKey = useMemo(
    () => (selectedHex ? `${selectedHex.q},${selectedHex.r}` : null),
    [selectedHex],
  );

  const openSelectedNoteInObsidian = useCallback(async () => {
    if (!selectedHex) {
      setNoteStatus("Select a hex to open its GM note in Obsidian.");
      return;
    }

    setIsLaunching(true);

    try {
      const launch = await requestObsidianNoteLaunch(
        mapId,
        selectedHex.q,
        selectedHex.r,
      );
      openObsidianProtocolUrl(launch.protocolUrl);
      setNoteStatus(
        `Obsidian launch requested for hex ${selectedHex.q}, ${selectedHex.r}. If nothing opened, confirm that the SimpleHex Obsidian plugin is installed and enabled.`,
      );
      lastOpenedHexKeyRef.current = `${selectedHex.q},${selectedHex.r}`;
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Could not open Obsidian.";
      setNoteStatus(detail);
    } finally {
      setIsLaunching(false);
    }
  }, [mapId, selectedHex]);

  useEffect(() => {
    if (activeMode !== "notes") {
      return;
    }

    if (!selectedHexKey) {
      setNoteStatus("Select a hex to open its GM note in Obsidian.");
      return;
    }

    if (lastOpenedHexKeyRef.current === selectedHexKey) {
      return;
    }

    void openSelectedNoteInObsidian();
  }, [activeMode, openSelectedNoteInObsidian, selectedHexKey]);

  return {
    isLaunching,
    noteStatus,
    openSelectedNoteInObsidian,
  };
}

