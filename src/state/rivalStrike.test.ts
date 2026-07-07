// Rival Strikes — a contested rival launch raises a respond-or-hold interrupt. The base haircut
// is untouched (pinned-sim safe); every response is a player-opt-in recovery tested here.
import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { LaunchedProduct, Product } from "../engine/types.ts";
import {
  advanceOneWeek, newGame, resolveStrike, skipInterrupt, marketingPushQuote,
  type GameState,
} from "./gameState.ts";

function phone(): Product {
  return {
    id: "p1",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(140),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

function activeLaunched(p: Product, weeks = 6): LaunchedProduct {
  return {
    product: p,
    stats: { performance: 30, quality: 30, battery: 30, design: 30, ecosystem: 70 },
    unitCost: dollars(67),
    launchScore: 60,
    launchedWeek: 0,
    totalUnits: 100 * weeks,
    weeklyUnits: Array(weeks).fill(100),
    unitsSold: 0,
    weeksElapsed: 0,
    revenueToDate: dollars(0),
    plannedUnits: 100 * weeks,
    verdict: "steady",
  };
}

/** A state where the FIRST competitor launches this week into the player's active categories.
 *  Seed 1 lands the era-2 launch in the player's phone category (strikes are gated to era ≥ 2). */
function contestedState(seed = 1): GameState {
  const s0 = newGame(seed);
  const tablet: Product = { ...phone(), id: "t1", name: "Slate One", category: "tablet" };
  return {
    ...s0,
    era: 2, // strikes are gated off the Garage era (era 1) — this fixture tests the strike itself
    cash: dollars(500_000),
    nextEventWeek: 9_999,
    launched: [activeLaunched(phone()), activeLaunched(tablet)],
    competitors: s0.competitors.map((c, i) => ({ ...c, nextLaunchWeek: i === 0 ? 0 : 999 })),
  };
}

describe("Rival Strikes — detection", () => {
  it("a contested rival launch raises pendingStrike with both sides' facts", () => {
    const next = advanceOneWeek(contestedState());
    const strike = next.pendingStrike!;
    expect(strike).toBeTruthy();
    expect(strike.week).toBe(next.week - 0); // set on the tick it happened
    expect(strike.rivalName.length).toBeGreaterThan(0);
    expect(strike.rivalProductName.length).toBeGreaterThan(0);
    expect(strike.rivalOverall).toBeGreaterThan(0);
    expect(["phone", "tablet"]).toContain(strike.category);
    // The player's contested product is the active one in that category.
    const target = next.launched.find((lp) => lp.product.id === strike.productId)!;
    expect(target.product.category).toBe(strike.category);
    // The matching rendered rival release exists for the card.
    expect(next.rivalReleases.some((r) => r.rivalId === strike.rivalId && r.week === strike.week)).toBe(true);
    // And the skip-to-decision loop stops for it.
    expect(skipInterrupt({ ...next, pendingStrike: null }, next)).toBe("A rival is attacking your product");
  });

  it("cooldown: no second strike within the window, even if another launch contests", () => {
    const first = advanceOneWeek(contestedState());
    expect(first.pendingStrike).toBeTruthy();
    // Resolve it, then force another contested launch immediately — still inside the cooldown.
    const resolved = resolveStrike(first, "hold").state;
    const again: GameState = {
      ...resolved,
      competitors: resolved.competitors.map((c, i) => ({ ...c, nextLaunchWeek: i === 1 ? resolved.week : 999 })),
    };
    const next = advanceOneWeek(again);
    expect(next.pendingStrike ?? null).toBeNull();
  });
});

describe("Rival Strikes — responses (all opt-in, sim never calls them)", () => {
  const struck = () => {
    const s = advanceOneWeek(contestedState());
    expect(s.pendingStrike).toBeTruthy();
    return s;
  };

  it("hold: +rep when the player's product outclasses the rival's, none otherwise", () => {
    const s = struck();
    const better: GameState = { ...s, pendingStrike: { ...s.pendingStrike!, playerOverall: 90, rivalOverall: 40 } };
    const win = resolveStrike(better, "hold");
    expect(win.ok).toBe(true);
    expect(win.state.reputation).toBeCloseTo(s.reputation + BALANCE.market.competition.strike.holdRepBonus, 6);
    expect(win.state.pendingStrike ?? null).toBeNull();
    expect(win.state.lastStrikeWeek).toBe(s.week);

    const worse: GameState = { ...s, pendingStrike: { ...s.pendingStrike!, playerOverall: 20, rivalOverall: 80 } };
    const meh = resolveStrike(worse, "hold");
    expect(meh.ok).toBe(true);
    expect(meh.state.reputation).toBe(s.reputation);
  });

  it("price: cuts the contested product's price via the ordinary one-cut rule", () => {
    const s = struck();
    const before = s.launched.find((lp) => lp.product.id === s.pendingStrike!.productId)!;
    const res = resolveStrike(s, "price");
    expect(res.ok).toBe(true);
    const after = res.state.launched.find((lp) => lp.product.id === before.product.id)!;
    expect(after.product.price).toBeLessThan(before.product.price);
    expect(after.priceCuts).toBe(1);
    expect(res.state.pendingStrike ?? null).toBeNull();
    // A second strike answered by price on the SAME product refuses (one cut per product).
    const reStruck: GameState = { ...res.state, pendingStrike: s.pendingStrike };
    expect(resolveStrike(reStruck, "price").ok).toBe(false);
  });

  it("campaign: runs the ordinary push at exactly the strike discount", () => {
    const s = struck();
    const lp = s.launched.find((l) => l.product.id === s.pendingStrike!.productId)!;
    const quote = marketingPushQuote(lp)!;
    expect(quote).toBeTruthy();
    const res = resolveStrike(s, "campaign");
    expect(res.ok).toBe(true);
    const cfg = BALANCE.market.competition.strike;
    const expected = toDollars(quote.cost) - Math.round(quote.cost * cfg.campaignDiscount) / 100;
    expect(toDollars(s.cash) - toDollars(res.state.cash)).toBeCloseTo(expected, 2);
    const after = res.state.launched.find((l) => l.product.id === lp.product.id)!;
    expect(after.marketingPushes).toBe(1);
  });

  it("no pending strike → clean refusal", () => {
    const s = newGame(3);
    expect(resolveStrike(s, "hold").ok).toBe(false);
  });
});

describe("The Silicon Awards — state integration", () => {
  it("week 52 tick sets pendingAwards when the year had launches, and collect pays per win", async () => {
    const { collectAwards, AWARD_REP_BONUS, AWARD_FANS_BONUS } = await import("./gameState.ts");
    // Sit at week 51 with products launched IN-YEAR (weeks 1..52); the tick to 52 judges the year.
    const base = contestedState(21);
    const s: GameState = {
      ...base,
      week: 51,
      launched: base.launched.map((lp) => ({ ...lp, launchedWeek: 10 })),
      competitors: base.competitors.map((c) => ({ ...c, nextLaunchWeek: 999 })),
    };
    const next = advanceOneWeek(s);
    expect(next.week).toBe(52);
    const ceremony = next.pendingAwards!;
    expect(ceremony).toBeTruthy();
    expect(ceremony.year).toBe(1);
    expect(ceremony.winners.length).toBeGreaterThan(0);
    expect(next.awardsHistory?.[0]).toEqual(ceremony);

    const collected = collectAwards(next);
    expect(collected.pendingAwards ?? null).toBeNull();
    if (ceremony.playerWins > 0) {
      expect(collected.reputation).toBeCloseTo(Math.min(100, next.reputation + AWARD_REP_BONUS * ceremony.playerWins), 6);
      expect(collected.fans).toBe(next.fans + AWARD_FANS_BONUS * ceremony.playerWins);
    } else {
      expect(collected.reputation).toBe(next.reputation);
    }
    // Collecting twice is a no-op.
    expect(collectAwards(collected)).toBe(collected);
  });
});
