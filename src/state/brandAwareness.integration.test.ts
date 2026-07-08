// Brand-awareness meter: invest → raises the meter + lifts launch hype; decays weekly; determinism-safe
// (a solo run that never invests keeps awareness 0, matching the pinned sim).
import { describe, it, expect } from "vitest";
import { newGame, investBrandAwareness, investBrandAwarenessQuote, brandAwarenessHype, advanceOneWeek, type GameState } from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars } from "../engine/money.ts";

describe("brand awareness", () => {
  it("investing raises the meter, spends cash, and lifts launch hype", () => {
    const g = { ...newGame(4), cash: dollars(50_000_000) } as GameState;
    expect(brandAwarenessHype(g)).toBe(0);
    const r = investBrandAwareness(g, 10);
    expect(r.ok).toBe(true);
    expect(r.state.brandAwareness).toBe(10);
    expect(r.state.cash).toBeLessThan(g.cash);
    expect(brandAwarenessHype(r.state)).toBeGreaterThan(0);
  });

  it("caps at the meter maximum; a maxed meter quotes null and can't invest", () => {
    const g = { ...newGame(4), cash: dollars(9_000_000_000), brandAwareness: BALANCE.brand.cap - 2 } as GameState;
    const r = investBrandAwareness(g, BALANCE.brand.maxStep);
    expect(r.state.brandAwareness).toBe(BALANCE.brand.cap);
    expect(investBrandAwarenessQuote(r.state, 5)).toBeNull();
    expect(investBrandAwareness(r.state, 5).ok).toBe(false);
  });

  it("decays over time without reinvestment", () => {
    let g = { ...newGame(4), cash: dollars(50_000_000), brandAwareness: 80 } as GameState;
    g = advanceOneWeek(g);
    expect(g.brandAwareness!).toBeLessThan(80);
    expect(g.brandAwareness!).toBeGreaterThan(0);
  });

  it("can't invest without the cash", () => {
    const g = { ...newGame(4), cash: dollars(1) } as GameState;
    expect(investBrandAwareness(g, 10).ok).toBe(false);
  });

  it("determinism: a solo run never invests → awareness stays 0", () => {
    let s = { ...newGame(555), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 120; w++) s = advanceOneWeek(s);
    expect(s.brandAwareness ?? 0).toBe(0);
  });
});
