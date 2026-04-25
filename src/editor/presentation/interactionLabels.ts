import { tileLabels } from "@/render/tileVisuals";
import { featureKindLabels, type FeatureKind } from "@/core/map/features";
import type { Faction, TerrainType } from "@/core/map/world";
import { SOURCE_LEVEL } from "@/core/map/mapRules";
import type { EditorMode } from "@/editor/tools/editorTypes";

type InteractionLabelOptions = {
  activeFactionId: string | null;
  activeFeatureKind: FeatureKind;
  activeMode: EditorMode;
  activeTokenUserId: string | null;
  activeType: TerrainType;
  canEdit: boolean;
  level: number;
  selectedFaction: Faction | null;
};

export function getInteractionLabel({
  activeFactionId,
  activeFeatureKind,
  activeMode,
  activeTokenUserId,
  activeType,
  canEdit,
  level,
  selectedFaction,
}: InteractionLabelOptions): string {
  if (!canEdit) {
    return "Read-only map view.";
  }

  if (activeMode === "terrain") {
    return `Left paints ${tileLabels[activeType]}, right erases terrain, middle drag pans.`;
  }

  if (activeMode === "feature") {
    if (level !== SOURCE_LEVEL) {
      return "Features are source-level only. Use A/E to switch to level 3 and place or remove them.";
    }

    return `Left places ${featureKindLabels[activeFeatureKind]}, right removes a feature, middle drag pans.`;
  }

  if (activeMode === "faction") {
    if (!activeFactionId) {
      return "Select a faction first. Left assigns hexes, right clears faction marks, middle drag pans.";
    }

    const name = selectedFaction?.name ?? "selected faction";
    return `Left assigns ${name}, right clears faction marks, middle drag pans.`;
  }

  if (activeMode === "road") {
    if (level !== SOURCE_LEVEL) {
      return "Roads are derived here. Use A/E to switch to level 3 and edit road edges.";
    }

    return "Left click and drag to draw roads, right click and drag between neighboring hexes to remove road edges, middle drag pans.";
  }

  if (activeMode === "fog") {
    return "Left click edits terrain fog, right click edits feature visibility, and the first valid cell locks hide or reveal for the whole drag. Middle drag pans.";
  }

  if (activeMode === "token") {
    if (level !== SOURCE_LEVEL) {
      return "Token selected: interactions apply on level 3 only. Use A/E to switch to level 3.";
    }

    return activeTokenUserId
      ? "Token selected: left click places it, right click removes clicked visible token. Middle drag pans."
      : "Select a workspace member to place their token. Right click removes clicked visible tokens. Middle drag pans.";
  }

  if (level !== SOURCE_LEVEL) {
    return "Rivers are derived here. Use A/E to switch to level 3 and edit river edges.";
  }

  return "Left paints river edges, right erases river edges, middle drag pans.";
}
