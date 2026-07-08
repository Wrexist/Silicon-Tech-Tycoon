import { describe, it, expect } from "vitest";
import {
  newGame,
  acquireRival,
  canAcquire,
  acquisitionCost,
  absorbedServicesRevenue,
  advanceOneWeek,
  type GameState,
} from "./gameState.ts";
import { dollars, toDollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import { CHALLENGER_POOL, RIVALS } from "../engine/competitors.ts";

/** An established, well-funded company — past the revenue bar, flush enough to buy a rival. */
function established(seed = 1): GameState {
  return { ...newGame(seed), cumulativeRevenue: dollars(2_000_000), cash: dollars(500_000_000) };
}

describe("B3 — rival acquisitions", () => {
  it("a pre-revenue company cannot acquire; an established, funded one can", () => {
    const fresh = newGame(1);
    expect(canAcquire(fresh, "quantyx")).toBe(false); // not established
    const s = established(1);
    expect(canAcquire(s, "quantyx")).toBe(true); // affordable scrappy rival
    expect(canAcquire(s, "pomelo")).toBe(false); // the $3B+ giant is out of reach at this scale
  });

  it("acquiring removes the rival, charges the buyout, and absorbs brand + customers", () => {
    const s = established(2);
    const cost = acquisitionCost(s, "quantyx")!;
    const before = { cash: toDollars(s.cash), rep: s.reputation, fans: s.fans, n: s.competitors.length };
    const a = acquireRival(s, "quantyx");
    expect(a.competitors.find((c) => c.id === "quantyx")).toBeUndefined();
    expect(a.competitors.length).toBe(before.n - 1);
    expect(toDollars(a.cash)).toBeCloseTo(before.cash - toDollars(cost), 0);
    expect(a.reputation).toBeGreaterThan(before.rep);
    expect(a.fans).toBeGreaterThan(before.fans);
    expect(a.acquiredRivals).toContain("quantyx");
  });

  it("an existing stake reduces the buyout cost, and acquiring clears that holding", () => {
    const base = established(3);
    const withStake: GameState = { ...base, holdings: { quantyx: 1_000_000 } };
    expect(toDollars(acquisitionCost(withStake, "quantyx")!)).toBeLessThan(
      toDollars(acquisitionCost(base, "quantyx")!),
    );
    const a = acquireRival(withStake, "quantyx");
    expect(a.holdings.quantyx).toBeUndefined();
  });

  it("acquiring inherits R&D (a one-time RP windfall) + an installed base that pays weekly services", () => {
    const s = established(6);
    const a = acquireRival(s, "quantyx");
    expect(a.researchPoints).toBeGreaterThan(s.researchPoints); // patents → RP windfall
    expect(a.absorbedBase).toBeGreaterThan(0);                  // customers absorbed
    expect(toDollars(absorbedServicesRevenue(s))).toBe(0);      // none before any acquisition
    expect(toDollars(absorbedServicesRevenue(a))).toBeGreaterThan(0); // a recurring annuity after
  });

  it("the absorbed-base annuity lands in cash each week (0 for a company that never acquired)", () => {
    const a = acquireRival(established(7), "quantyx");
    // Identical state except the absorbed base zeroed — isolates the annuity's cash contribution.
    const withAnnuity = advanceOneWeek({ ...a, nextEventWeek: 999 });
    const without = advanceOneWeek({ ...a, absorbedBase: 0, nextEventWeek: 999 });
    const delta = toDollars(withAnnuity.cash) - toDollars(without.cash);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeCloseTo(toDollars(absorbedServicesRevenue(a)), 0); // exactly the weekly annuity
  });

  it("cannot acquire below the field floor", () => {
    const s = established(4);
    const trimmed: GameState = { ...s, competitors: s.competitors.slice(0, BALANCE.mergers.minActiveRivals) };
    expect(canAcquire(trimmed, trimmed.competitors[0].id)).toBe(false);
  });

  it("a thinned field eventually refills with a fresh challenger (never an acquired one)", () => {
    let s = established(5);
    s = acquireRival(s, "quantyx");
    expect(s.competitors.length).toBe(RIVALS.length - 1);
    let entered = false;
    for (let i = 0; i < 400 && !entered; i++) {
      s = advanceOneWeek(s);
      entered = s.competitors.length === RIVALS.length;
    }
    expect(entered).toBe(true);
    const newcomer = s.competitors.find((c) => CHALLENGER_POOL.some((p) => p.id === c.id));
    expect(newcomer).toBeDefined();
    expect(s.acquiredRivals).not.toContain(newcomer!.id);
  });
});
