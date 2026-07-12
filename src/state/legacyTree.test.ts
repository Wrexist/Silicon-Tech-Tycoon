// Legacy Points spend-tree (item 4.3): tiered perk availability, the buy reducer (points + gating +
// wentPublic), and that a chosen perk actually folds through prestigeBonuses into the live selectors.
import { describe, expect, it } from "vitest";
import { LEGACY_TREE, legacyTreeBonuses, legacyPerkAvailable, legacyPerkById } from "../engine/legacyTree.ts";
import { newGame, buyLegacyPerk, prestigeBonuses, hypeBonus, type GameState } from "./gameState.ts";

describe("legacy tree — engine", () => {
  it("empty selection is the neutral bonus (a pure no-op)", () => {
    expect(legacyTreeBonuses([])).toEqual({ designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 });
    expect(legacyTreeBonuses()).toEqual({ designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 });
  });

  it("tier gates: tier-1 open, tier-2 needs ≥1 owned, tier-3 needs ≥3", () => {
    const t1 = LEGACY_TREE.find((p) => p.tier === 1)!;
    const t2 = LEGACY_TREE.find((p) => p.tier === 2)!;
    const t3 = LEGACY_TREE.find((p) => p.tier === 3)!;
    expect(legacyPerkAvailable([], t1.id)).toBe(true);
    expect(legacyPerkAvailable([], t2.id)).toBe(false);
    expect(legacyPerkAvailable(["lt-design1"], t2.id)).toBe(true);
    expect(legacyPerkAvailable(["lt-design1", "lt-hype1"], t3.id)).toBe(false);
    expect(legacyPerkAvailable(["lt-design1", "lt-hype1", "lt-rp1"], t3.id)).toBe(true);
    // An owned perk is never re-offered.
    expect(legacyPerkAvailable(["lt-design1"], "lt-design1")).toBe(false);
  });

  it("build-cost reduction is clamped (never below 60% of cost)", () => {
    const all = LEGACY_TREE.filter((p) => p.bonus.buildCostMult).map((p) => p.id);
    expect(legacyTreeBonuses(all).buildCostMult).toBeLessThanOrEqual(0.4);
  });
});

describe("legacy tree — reducer", () => {
  const publicRun = (): GameState => ({ ...newGame(3), wentPublic: true, legacyPoints: 20 });

  it("buying is gated on wentPublic, points, and the tier gate; spends the points", () => {
    // Not public → refused.
    expect(buyLegacyPerk({ ...newGame(3), legacyPoints: 20 }, "lt-hype1").ok).toBe(false);

    const g = publicRun();
    // A tier-2 perk is refused until a tier-1 is owned.
    expect(buyLegacyPerk(g, "lt-hype2").ok).toBe(false);
    const r1 = buyLegacyPerk(g, "lt-hype1");
    expect(r1.ok).toBe(true);
    expect(r1.state.legacyPerks).toContain("lt-hype1");
    expect(r1.state.legacyPoints).toBe(20 - legacyPerkById("lt-hype1")!.cost);
    // Now the tier-2 opens.
    expect(buyLegacyPerk(r1.state, "lt-hype2").ok).toBe(true);
    // Double-buy refused.
    expect(buyLegacyPerk(r1.state, "lt-hype1").ok).toBe(false);
  });

  it("too few points refuses without spending", () => {
    const broke = { ...publicRun(), legacyPoints: 1 };
    const res = buyLegacyPerk(broke, "lt-hype1");
    expect(res.ok).toBe(false);
    expect(res.state.legacyPoints).toBe(1);
  });

  it("a chosen perk folds through prestigeBonuses into the live hype selector", () => {
    const g = publicRun();
    const before = hypeBonus(g);
    const after = hypeBonus(buyLegacyPerk(g, "lt-hype1").state);
    expect(after).toBeGreaterThan(before);
    // A run with no legacy perks and legacy 0 is the neutral prestige bonus (sim byte-identical).
    expect(prestigeBonuses(newGame(3))).toEqual({ designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 });
  });
});
