import { describe, it, expect } from "vitest";
import { newGame, type GameState } from "./gameState.ts";
import { guidanceHints, strategicInsights, INSIGHT_SHOWN, OBJECTIVE_SUBSUMES } from "./insights.ts";
import { OBJECTIVES, currentObjective } from "../engine/objectives.ts";
import { dollars } from "../engine/money.ts";
import type { LaunchedProduct, Product } from "../engine/types.ts";

/** Every insight id the catalogue can ever emit, harvested by running the generator over a spread of
 *  states. Cheaper and more honest than a hand-kept list: if a hint is renamed, this notices. */
function allEmittableIds(): Set<string> {
  const ids = new Set<string>();
  for (const s of sampleStates()) for (const h of strategicInsights(s)) ids.add(h.id);
  return ids;
}

function phone(id: string): Product {
  return {
    id, name: `Aurora ${id}`, category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(140), designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
  };
}

function launched(id: string, over: Partial<LaunchedProduct> = {}): LaunchedProduct {
  return {
    product: phone(id), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 },
    unitCost: dollars(50), launchScore: 60, launchedWeek: 0,
    totalUnits: 1000, weeklyUnits: [500, 300, 200], unitsSold: 800, weeksElapsed: 99, revenueToDate: dollars(1000),
    plannedUnits: 1000, verdict: "steady", ...over,
  };
}

function sampleStates(): GameState[] {
  const base = newGame(7);
  const shipped = (n: number): GameState => ({
    ...base,
    launched: Array.from({ length: n }, (_, i) => launched(`p${i}`)),
  } as GameState);
  return [
    base,
    { ...base, staff: [...base.staff, { ...base.staff[0], id: "x", assignment: "idle", mood: 10 }] } as GameState,
    { ...base, researchPoints: 9_999 } as GameState,
    shipped(1),
    shipped(4),
    { ...shipped(4), era: 3, unlockedRegions: ["home"] } as GameState,
    { ...shipped(4), wentPublic: true, legacyPoints: 3 } as GameState,
  ];
}

describe("strategic insights", () => {
  it("gives every hint a stable, unique id", () => {
    for (const s of sampleStates()) {
      const ids = strategicInsights(s).map((h) => h.id);
      expect(ids.every((id) => id.length > 0)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never offers more hints than the collection pool", () => {
    for (const s of sampleStates()) expect(strategicInsights(s).length).toBeLessThanOrEqual(4);
  });

  it("a brand-new garage has nothing to advise about products it hasn't shipped", () => {
    const hints = strategicInsights(newGame(3)).map((h) => h.id);
    expect(hints).not.toContain("decline");
    expect(hints).not.toContain("ending-soon");
  });
});

describe("guidance dedupe", () => {
  it("drops hints the active objective already states", () => {
    // A fresh game's first objective is "launch your first product", which subsumes the
    // "design something new" family — those must not be repeated underneath it.
    const s = newGame(11);
    const objective = currentObjective(s)?.objective.id ?? null;
    expect(objective).toBe("first-launch");
    const shown = guidanceHints(s, objective).map((h) => h.id);
    for (const id of OBJECTIVE_SUBSUMES["first-launch"]) expect(shown).not.toContain(id);
  });

  it("keeps every hint when the ladder is complete (nothing to be redundant with)", () => {
    const s = newGame(11);
    expect(guidanceHints(s, null)).toEqual(strategicInsights(s));
  });

  it("leaves the caller enough hints to fill the card after a dedupe", () => {
    // The pool is collected one deeper than the card shows, so deduping one hint away shouldn't
    // shrink the card. Not a guarantee at every state (some states simply have little to say), but
    // the cap must never be the reason.
    expect(INSIGHT_SHOWN).toBeLessThan(4);
  });
});

describe("OBJECTIVE_SUBSUMES integrity", () => {
  it("only names objectives that exist in the ladder", () => {
    const ladder = new Set(OBJECTIVES.map((o) => o.id));
    for (const id of Object.keys(OBJECTIVE_SUBSUMES)) expect(ladder).toContain(id);
  });

  it("only names hints the catalogue can actually emit", () => {
    const emittable = allEmittableIds();
    // Sanity: the sampler has to exercise a decent slice of the catalogue for this check to mean
    // anything.
    expect(emittable.size).toBeGreaterThan(5);
    const referenced = new Set(Object.values(OBJECTIVE_SUBSUMES).flat());
    const unknown = [...referenced].filter((id) => !KNOWN_INSIGHT_IDS.has(id));
    expect(unknown).toEqual([]);
  });
});

/** The full catalogue, mirrored here so a renamed hint fails LOUDLY rather than silently turning a
 *  dedupe rule into a no-op (a no-op rule reads as "no bug" — the card just quietly says the same
 *  thing twice again). Keep in sync with the `insights.push` ids in insights.ts. */
const KNOWN_INSIGHT_IDS = new Set([
  "idle-staff", "research-ready", "breakout-tier", "breakout-hype", "breakout-trend",
  "drought", "ending-soon", "morale", "upgrade", "trend", "untapped-category",
  "rival-threat", "hire", "marketer", "decline", "design-brief", "doctrine",
  "expand", "legacy-points",
]);

describe("the mirrored id catalogue", () => {
  it("matches what the generator emits (nothing has been renamed out from under it)", () => {
    for (const id of allEmittableIds()) expect(KNOWN_INSIGHT_IDS).toContain(id);
  });
});
