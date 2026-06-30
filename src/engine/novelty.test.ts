import { describe, expect, it } from "vitest";
import { dollars } from "./money.ts";
import { BALANCE } from "./balance.ts";
import { noveltyFor, productSimilarity } from "./novelty.ts";
import type { Product } from "./types.ts";

function phone(over: Partial<Product> = {}): Product {
  return {
    id: "x", name: "Aurora One", category: "phone",
    tiers: { chip: 4, display: 4, battery: 4, materials: 4, software: 4, camera: 4 },
    finish: "aluminium", colorIndex: 0, price: dollars(699), designTier: 2,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch", ...over,
  };
}
const launched = (p: Product, launchedWeek: number) => ({ product: p, launchedWeek });

describe("market fatigue / novelty", () => {
  it("identical specs are maximally similar; different category is 0", () => {
    expect(productSimilarity(phone(), phone())).toBe(1);
    expect(productSimilarity(phone(), phone({ category: "tablet" }))).toBe(0);
  });

  it("changing component tiers lowers similarity", () => {
    const a = phone();
    const b = phone({ tiers: { chip: 6, display: 6, battery: 6, materials: 4, software: 4, camera: 4 } });
    expect(productSimilarity(a, b)).toBeLessThan(productSimilarity(a, phone()));
  });

  it("an identical, recent same-category launch cuts organic demand toward the max penalty", () => {
    const prev = phone({ id: "p1", name: "Aurora One" });
    const next = phone({ id: "p2" }); // same specs, a fresh build
    const r = noveltyFor(next, [launched(prev, 100)], 100); // same week
    expect(r.mult).toBeCloseTo(1 - BALANCE.novelty.maxPenalty, 5);
    expect(r.similarTo).toBe("Aurora One");
    expect(r.weeksAgo).toBe(0);
  });

  it("a genuine upgrade (many tiers bumped) is fresh — no penalty", () => {
    const prev = phone({ id: "p1" });
    const upgraded = phone({ id: "p2", tiers: { chip: 6, display: 6, battery: 6, materials: 6, software: 6, camera: 6 } });
    expect(noveltyFor(upgraded, [launched(prev, 100)], 100).mult).toBe(1);
  });

  it("time heals it — a similar product is fine once the fatigue window has passed", () => {
    const prev = phone({ id: "p1" });
    const same = phone({ id: "p2" });
    const old = BALANCE.novelty.fatigueWeeks + 5;
    expect(noveltyFor(same, [launched(prev, 0)], old).mult).toBe(1);
    // and partial fatigue mid-window is between the floor and 1
    const mid = noveltyFor(same, [launched(prev, 0)], Math.floor(BALANCE.novelty.fatigueWeeks / 2));
    expect(mid.mult).toBeGreaterThan(1 - BALANCE.novelty.maxPenalty);
    expect(mid.mult).toBeLessThan(1);
  });

  it("a different category launched at the same time never fatigues you", () => {
    const tablet = phone({ id: "t1", category: "tablet" });
    expect(noveltyFor(phone(), [launched(tablet, 100)], 100).mult).toBe(1);
  });
});
