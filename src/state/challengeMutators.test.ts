// Challenge sim-rule mutators (item 5.4): recession shrinks demand, a marketing blackout collapses
// launch hype — both derived from the active challenge and neutral outside one (sim byte-identical).
import { describe, expect, it } from "vitest";
import { newGame, newChallengeGame, challengeRules, hypeBonus, effectiveHypeBonus, planProduction, type GameState } from "./gameState.ts";
import { MUTATORS, dailyChallenge } from "../engine/challenges.ts";
import { dollars } from "../engine/money.ts";
import type { Product } from "../engine/types.ts";

const phone = (): Product => ({
  id: "p", name: "P", category: "phone",
  tiers: { chip: 2, display: 2, battery: 2, materials: 2, software: 2, camera: 2 },
  finish: "aluminium", colorIndex: 0, price: dollars(699), designTier: 2,
  camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
});

/** Find a daily-challenge date (scanning a year) whose mutator set includes `id`. */
function dayWithMutator(id: string): string | null {
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++) {
    const key = `2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (dailyChallenge(key).mutators.some((mu) => mu.id === id)) return key;
  }
  return null;
}

describe("challenge sim-rule mutators (item 5.4)", () => {
  it("the catalog carries the sim-rule twists", () => {
    expect(MUTATORS.find((m) => m.id === "recession")?.demandMult).toBe(0.7);
    expect(MUTATORS.find((m) => m.id === "blackout")?.noMarketing).toBe(true);
  });

  it("challengeRules is neutral outside a challenge → sim byte-identical", () => {
    const g = newGame(4);
    expect(g.activeChallenge).toBeNull();
    expect(challengeRules(g)).toEqual({ demandMult: 1, noMarketing: false });
    expect(effectiveHypeBonus(g)).toBe(hypeBonus(g));
  });

  it("a Marketing Blackout run collapses effective launch hype", () => {
    const day = dayWithMutator("blackout");
    expect(day).not.toBeNull();
    // Give the company some brand awareness so the raw hype bonus is positive (else 0 vs 0 is a tie).
    const g: GameState = { ...newChallengeGame("daily", day!), fans: 5000, reputation: 60, brandAwareness: 500 };
    expect(challengeRules(g).noMarketing).toBe(true);
    expect(hypeBonus(g)).toBeGreaterThan(0);
    expect(effectiveHypeBonus(g)).toBeLessThan(hypeBonus(g)); // hype is muted vs. the raw bonus
    expect(effectiveHypeBonus(g)).toBeGreaterThanOrEqual(0);
  });

  it("a Recession run contracts the addressable market vs. the same company un-mutated", () => {
    const day = dayWithMutator("recession");
    expect(day).not.toBeNull();
    const rec = newChallengeGame("daily", day!);
    expect(challengeRules(rec).demandMult).toBeLessThan(1);
    // Same seed + a normal run: the recession's forecast demand must be lower.
    const normal: GameState = { ...newGame(rec.seed), cash: rec.cash, reputation: rec.reputation, fans: rec.fans };
    const recDemand = planProduction(rec, phone(), 5000, "none").totalDemand;
    const normalDemand = planProduction(normal, phone(), 5000, "none").totalDemand;
    expect(recDemand).toBeLessThan(normalDemand);
  });
});
