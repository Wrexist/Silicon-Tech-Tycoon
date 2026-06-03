import { describe, expect, it } from "vitest";
import { buyCost, sellProceeds, holdingsValue, weeklyDividends, playerSharePrice } from "./stocks.ts";
import type { CompetitorState } from "./types.ts";
import { toDollars } from "./money.ts";

const comp = (id: string, priceCents: number): CompetitorState => ({
  id,
  name: id,
  blurb: "",
  reputation: 50,
  strengthByCategory: {},
  nextLaunchWeek: 99,
  sharePrice: priceCents,
  priceHistory: [priceCents / 100],
});

describe("stock market math", () => {
  it("buy costs more than face (fee) and sell returns less", () => {
    const buy = toDollars(buyCost(10000, 10)); // 10 shares @ $100
    const sell = toDollars(sellProceeds(10000, 10));
    expect(buy).toBeGreaterThan(1000);
    expect(sell).toBeLessThan(1000);
    expect(buy).toBeGreaterThan(sell);
  });

  it("holdingsValue sums shares × price", () => {
    const comps = [comp("a", 10000), comp("b", 5000)];
    expect(toDollars(holdingsValue({ a: 2, b: 4 }, comps))).toBeCloseTo(2 * 100 + 4 * 50, 1);
  });

  it("dividends are positive for held profitable rivals", () => {
    const comps = [comp("a", 20000)];
    expect(toDollars(weeklyDividends({ a: 100 }, comps))).toBeGreaterThan(0);
    expect(toDollars(weeklyDividends({}, comps))).toBe(0);
  });

  it("player share price scales with valuation", () => {
    expect(playerSharePrice(1_000_000 * 100)).toBeGreaterThan(playerSharePrice(500_000 * 100));
  });
});
