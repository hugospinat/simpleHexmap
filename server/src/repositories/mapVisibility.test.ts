import { describe, expect, it } from "vitest";
import { filterMapDocumentForPlayer } from "./mapVisibility.js";

describe("mapVisibility", () => {
  it("filters hidden content out of player snapshots", () => {
    const filtered = filterMapDocumentForPlayer({
      version: 2,
      tiles: [
        { q: 0, r: 0, terrain: "plain", hidden: false },
        { q: 1, r: 0, terrain: "forest", hidden: true },
        { q: 0, r: 1, terrain: "hill", hidden: false },
      ],
      features: [
        {
          id: "visible-feature",
          kind: "city",
          featureLevel: 2,
          q: 0,
          r: 0,
          hidden: false,
        },
        {
          id: "hidden-feature",
          kind: "city",
          featureLevel: 2,
          q: 0,
          r: 0,
          hidden: true,
        },
        {
          id: "hidden-cell-feature",
          kind: "ruin",
          featureLevel: 1,
          q: 1,
          r: 0,
          hidden: false,
        },
      ],
      rivers: [
        { q: 0, r: 0, edge: 0 },
        { q: 0, r: 0, edge: 5 },
      ],
      roads: [
        { q: 0, r: 0, edges: [0, 5] },
        { q: 1, r: 0, edges: [2] },
      ],
      factions: [
        { id: "visible-faction", name: "North", color: "#112233" },
        { id: "hidden-faction", name: "South", color: "#445566" },
      ],
      factionTerritories: [
        { q: 0, r: 0, factionId: "visible-faction" },
        { q: 1, r: 0, factionId: "hidden-faction" },
      ],
      tokens: [
        { userId: "visible-user", q: 0, r: 0, color: "#123456" },
        { userId: "hidden-user", q: 1, r: 0, color: "#654321" },
      ],
    });

    expect(filtered.tiles).toEqual([
      { q: 0, r: 0, terrain: "plain", hidden: false },
      { q: 0, r: 1, terrain: "hill", hidden: false },
    ]);
    expect(filtered.features).toEqual([
      {
        id: "visible-feature",
        kind: "city",
        featureLevel: 2,
        q: 0,
        r: 0,
        hidden: false,
      },
    ]);
    expect(filtered.rivers).toEqual([{ q: 0, r: 0, edge: 0 }]);
    expect(filtered.roads).toEqual([{ q: 0, r: 0, edges: [0] }]);
    expect(filtered.factions).toEqual([
      { id: "visible-faction", name: "North", color: "#112233" },
    ]);
    expect(filtered.factionTerritories).toEqual([
      { q: 0, r: 0, factionId: "visible-faction" },
    ]);
  });
});
