import { describe, expect, it } from "vitest";
import { dollars, toDollars } from "./money.ts";
import { eraModifier } from "./eras.ts";
import { BALANCE } from "./balance.ts";
import { buildWeeksFor, lateEraDrag, newGame, toolingCost, weeklyOutflow, type GameState } from "../state/gameState.ts";
import type { Product } from "./types.ts";

// Living Late Game — Phase 1: late eras make a product a bigger, slower bet (era-scaled tooling
// cost + manufacturing lead time) so the endgame is fewer, weightier launches. Eras 1–2 are
// neutral, so the early game stays byte-identical. These pin that contract.

function phone(): Product {
  return {
    id: "x",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(160),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

/** A non-fresh company so buildWeeksFor doesn't take the first-ever fast path (which floors weeks). */
function established(era: number): GameState {
  return { ...newGame(7), legacy: 1, era };
}

describe("Living Late Game — era-scaled build economics", () => {
  it("eraModifier carries toolingMult + leadWeeks, non-decreasing across eras", () => {
    const eras = [1, 2, 3, 4].map(eraModifier);
    for (let i = 1; i < eras.length; i++) {
      expect(eras[i].toolingMult).toBeGreaterThanOrEqual(eras[i - 1].toolingMult);
      expect(eras[i].leadWeeks).toBeGreaterThanOrEqual(eras[i - 1].leadWeeks);
    }
    // Garage + Growth stay neutral so the early game is untouched.
    expect(eras[0].toolingMult).toBe(1.0);
    expect(eras[0].leadWeeks).toBe(0);
    expect(eras[1]).toEqual(eras[0]);
  });

  it("late eras cost more to tool up; eras 1–2 are identical", () => {
    const p = phone();
    const t1 = toDollars(toolingCost(established(1), p));
    const t2 = toDollars(toolingCost(established(2), p));
    const t3 = toDollars(toolingCost(established(3), p));
    const t4 = toDollars(toolingCost(established(4), p));
    expect(t2).toBe(t1); // early game byte-identical
    expect(t3).toBeGreaterThan(t1);
    expect(t4).toBeGreaterThan(t3);
  });

  it("late eras add manufacturing lead time; eras 1–2 are identical", () => {
    const p = phone();
    const w1 = buildWeeksFor(established(1), p);
    const w2 = buildWeeksFor(established(2), p);
    const w4 = buildWeeksFor(established(4), p);
    expect(w2).toBe(w1); // early game byte-identical
    expect(w4).toBe(w1 + eraModifier(4).leadWeeks);
  });
});

// Item C3 — late-era operating drag: the endgame stops being a free ratchet. A capped weekly cash
// cost scaled by lifetime revenue, starting in the drag era, so a frontier-scale company pays to keep
// running. ZERO before the drag era, so the early game and the pinned sim's first eras stay identical.
describe("Late-era operating drag (item C3)", () => {
  const withRev = (era: number, revenueDollars: number): GameState =>
    ({ ...newGame(7), era, cumulativeRevenue: dollars(revenueDollars) });

  it("is ZERO before the drag era, whatever the lifetime revenue", () => {
    for (let era = 1; era < BALANCE.lateEra.dragEra; era++) {
      expect(toDollars(lateEraDrag(withRev(era, 5_000_000_000)))).toBe(0);
    }
  });

  it("charges the drag from the drag era, scaled by lifetime revenue", () => {
    const era = BALANCE.lateEra.dragEra;
    const small = toDollars(lateEraDrag(withRev(era, 10_000_000)));
    const big = toDollars(lateEraDrag(withRev(era, 100_000_000)));
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small); // more lifetime revenue → bigger headwind
    expect(small).toBeCloseTo(10_000_000 * BALANCE.lateEra.dragFracPerWeek, 2);
  });

  it("caps the drag so it can never bankrupt a solvent company", () => {
    const era = BALANCE.lateEra.dragEra;
    const huge = lateEraDrag(withRev(era, 100_000_000_000)); // far past the cap
    expect(toDollars(huge)).toBe(toDollars(BALANCE.lateEra.dragCap));
  });

  it("weeklyOutflow includes the drag in the late era but not before", () => {
    const base = withRev(1, 50_000_000);
    const late = withRev(BALANCE.lateEra.dragEra, 50_000_000);
    // Same everything except era → the difference in outflow is exactly the drag.
    const delta = toDollars(weeklyOutflow(late)) - toDollars(weeklyOutflow(base));
    expect(delta).toBeCloseTo(toDollars(lateEraDrag(late)), 2);
    expect(delta).toBeGreaterThan(0);
  });
});
