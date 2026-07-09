// Regional loyalty + events: expanding past Home opens a standing meter per market, moved by
// respond-or-ignore events and folded into that region's reach. Determinism-safe: a home-only run
// (the pinned solo sim) has an empty map and never fires one → byte-identical.
import { describe, it, expect } from "vitest";
import { newGame, resolveRegionalEvent, advanceOneWeek, type GameState } from "./gameState.ts";
import { regionLoyaltyMul, regionReach } from "../engine/regions.ts";
import { generateRegionalEvent, regionalEventDue } from "../engine/regionalEvents.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars, toDollars } from "../engine/money.ts";
import type { Stats } from "../engine/types.ts";

const L = BALANCE.market.regions.loyalty;
const stats: Stats = { performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 };

describe("region loyalty", () => {
  it("neutral is 1.0; positive lifts, negative dents, and it clamps", () => {
    expect(regionLoyaltyMul(0)).toBe(1);
    expect(regionLoyaltyMul(undefined)).toBe(1);
    expect(regionLoyaltyMul(L.cap)).toBeCloseTo(1 + L.maxSwing, 5);
    expect(regionLoyaltyMul(-L.cap)).toBeCloseTo(1 - L.maxSwing, 5);
    expect(regionLoyaltyMul(L.cap * 5)).toBeCloseTo(1 + L.maxSwing, 5); // clamped
  });

  it("a home-only launch is unchanged by loyalty; a foreign region's reach responds to it", () => {
    const home = regionReach(["home"], ["home"], stats, undefined, { asia: 90 });
    expect(home).toBe(regionReach(["home"], ["home"], stats));
    const ships = ["home", "asia"] as const;
    const loyal = regionReach(["home", "asia"], [...ships], stats, undefined, { asia: 90 });
    const neutral = regionReach(["home", "asia"], [...ships], stats, undefined, {});
    expect(loyal).toBeGreaterThan(neutral);
  });
});

describe("generateRegionalEvent", () => {
  it("targets one of the given (non-home) regions with a valid kind, cost scaling by era", () => {
    const e1 = generateRegionalEvent(5, 40, ["asia", "europe"], 1);
    expect(["asia", "europe"]).toContain(e1.regionId);
    expect(["boom", "tariff", "rivalSurge"]).toContain(e1.kind);
    const e3 = generateRegionalEvent(5, 40, ["asia", "europe"], 3);
    expect(toDollars(e3.cost)).toBeGreaterThan(toDollars(e1.cost));
  });
  it("regionalEventDue is deterministic for a given seed/week", () => {
    expect(regionalEventDue(7, 30)).toBe(regionalEventDue(7, 30));
  });
});

describe("resolveRegionalEvent", () => {
  function withEvent(kind: "boom" | "tariff" | "rivalSurge", cash = dollars(50_000_000)): GameState {
    const ev = generateRegionalEvent(1, 20, ["asia"], 2);
    return { ...newGame(3), cash, unlockedRegions: ["home", "asia"], pendingRegionalEvent: { ...ev, kind } } as GameState;
  }

  it("responding spends cash and raises standing", () => {
    const s = withEvent("boom");
    const { state, result } = resolveRegionalEvent(s, true);
    expect(result.ok).toBe(true);
    expect(result.responded).toBe(true);
    expect(state.cash).toBeLessThan(s.cash);
    expect((state.regionLoyalty?.asia ?? 0)).toBeGreaterThan(0);
    expect(state.pendingRegionalEvent).toBeNull();
  });

  it("ignoring a tariff costs standing but no cash", () => {
    const s = withEvent("tariff");
    const { state } = resolveRegionalEvent(s, false);
    expect(state.cash).toBe(s.cash);
    expect((state.regionLoyalty?.asia ?? 0)).toBeLessThan(0);
  });

  it("can't respond without the cash (card stays up)", () => {
    const s = withEvent("boom", dollars(1));
    const { state, result } = resolveRegionalEvent(s, true);
    expect(result.ok).toBe(false);
    expect(state.pendingRegionalEvent).not.toBeNull();
  });
});

describe("determinism safety", () => {
  it("a solo, home-only run raises no regional event and keeps loyalty empty", () => {
    let s = { ...newGame(852), cash: dollars(5_000_000) } as GameState;
    for (let w = 0; w < 160; w++) s = advanceOneWeek(s);
    expect(s.unlockedRegions).toEqual(["home"]);
    expect(s.pendingRegionalEvent ?? null).toBeNull();
    expect(Object.keys(s.regionLoyalty ?? {}).length).toBe(0);
  });
});
