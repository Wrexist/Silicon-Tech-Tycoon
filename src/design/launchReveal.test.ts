import { describe, expect, it } from "vitest";
import { buildLaunchReveal, predecessorOf, reviewAggregateOf } from "./launchReveal.ts";
import { STAT_KEYS, type LaunchedProduct, type Product, type Stats } from "../engine/types.ts";

const stats = (v: number): Stats => Object.fromEntries(STAT_KEYS.map((k) => [k, v])) as Stats;
const product = (id: string, name: string, category = "phone"): Product => ({ id, name, category } as unknown as Product);
const shipped = (id: string, name: string, v: number, category = "phone"): LaunchedProduct =>
  ({ product: product(id, name, category), stats: stats(v), verdict: "solid" } as unknown as LaunchedProduct);

const reveal = (p: Product, v: number, before: LaunchedProduct[]) => buildLaunchReveal({
  product: p, stats: stats(v), verdict: "solid", demandFit: 60, priceFit: 1, betterRivals: 0,
  units: 1000, isHit: false, firstLaunch: before.length === 0, launchedBefore: before,
});

describe("launch reveal history comparison", () => {
  it("prefers the same franchise line, then the same category (newest-first)", () => {
    const before = [shipped("c", "Nova", 50), shipped("b", "Aurora 2", 50), shipped("t", "Slate", 50, "tablet")];
    expect(predecessorOf(product("n", "Aurora 3"), before)?.product.name).toBe("Aurora 2");
    expect(predecessorOf(product("n", "Zephyr"), before)?.product.name).toBe("Nova");
    expect(predecessorOf(product("n", "Pad", "laptop"), before)).toBeNull();
  });

  it("reports the critics' delta against the predecessor, like-for-like", () => {
    const prev = shipped("a", "Aurora", 40);
    const r = reveal(product("n", "Aurora 2"), 90, [prev]);
    expect(r.vsPrevious?.name).toBe("Aurora");
    expect(r.vsPrevious?.delta).toBe(r.aggregate - reviewAggregateOf(prev));
  });

  it("flags a personal best only when it beats EVERY earlier launch, never on a debut", () => {
    expect(reveal(product("n", "First"), 90, []).personalBest).toBe(false);
    expect(reveal(product("n", "First"), 90, []).vsPrevious).toBeNull();
    const strong = reveal(product("n", "Best"), 95, [shipped("a", "Old", 30)]);
    expect(strong.aggregate).toBeGreaterThan(reviewAggregateOf(shipped("a", "Old", 30)));
    expect(strong.personalBest).toBe(true);
    const weak = reveal(product("n", "Worse"), 20, [shipped("a", "Old", 95)]);
    expect(weak.personalBest).toBe(false);
  });
});
