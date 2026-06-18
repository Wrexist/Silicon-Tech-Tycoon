import { describe, it, expect } from "vitest";
import { criticReviews, type ReviewInputs, type ReviewVerdict } from "./reviews.ts";
import type { Stats } from "./types.ts";

const stats = (over: Partial<Stats> = {}): Stats => ({
  performance: 50,
  quality: 50,
  battery: 50,
  design: 50,
  ecosystem: 50,
  ...over,
});

const base = (over: Partial<ReviewInputs> = {}): ReviewInputs => ({
  productId: "prod-1",
  stats: stats(),
  verdict: "solid",
  demandFit: 60,
  priceFit: 1,
  betterRivals: 0,
  ...over,
});

const OUTLETS = new Set(["The Circuit", "Bitstream", "Field & Frame", "Teardown Weekly", "Mainboard", "Slate & Silicon"]);

describe("criticReviews", () => {
  it("is deterministic for a given product id", () => {
    expect(criticReviews(base())).toEqual(criticReviews(base()));
  });

  it("varies by product id (different seeds → can differ)", () => {
    const a = criticReviews(base({ productId: "prod-1" }));
    const b = criticReviews(base({ productId: "prod-99" }));
    // Same inputs except id: the aggregate is identical (deterministic from metrics), but the
    // chosen outlets / headline are seeded by id, so the full objects should differ.
    expect(a).not.toEqual(b);
  });

  it("aggregate and outlet scores stay in range", () => {
    for (const verdict of ["hit", "flop", "solid", "steady"] as ReviewVerdict[]) {
      const r = criticReviews(base({ verdict }));
      expect(r.aggregate).toBeGreaterThanOrEqual(12);
      expect(r.aggregate).toBeLessThanOrEqual(99);
      for (const o of r.outlets) {
        expect(o.score).toBeGreaterThanOrEqual(10);
        expect(o.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("a hit scores higher than a flop for the same product", () => {
    const hit = criticReviews(base({ verdict: "hit", stats: stats({ design: 80, performance: 80 }) }));
    const flop = criticReviews(base({ verdict: "flop", stats: stats({ design: 80, performance: 80 }) }));
    expect(hit.aggregate).toBeGreaterThan(flop.aggregate);
  });

  it("always returns exactly 3 distinct, IP-clean outlets", () => {
    const r = criticReviews(base());
    expect(r.outlets).toHaveLength(3);
    const names = r.outlets.map((o) => o.outlet);
    expect(new Set(names).size).toBe(3);
    for (const n of names) expect(OUTLETS.has(n)).toBe(true);
  });

  it("always gives 1-2 pros and 1-2 cons, and a headline", () => {
    for (const verdict of ["hit", "flop", "solid", "steady"] as ReviewVerdict[]) {
      const r = criticReviews(base({ verdict }));
      expect(r.pros.length).toBeGreaterThanOrEqual(1);
      expect(r.pros.length).toBeLessThanOrEqual(2);
      expect(r.cons.length).toBeGreaterThanOrEqual(1);
      expect(r.cons.length).toBeLessThanOrEqual(2);
      expect(r.headline.length).toBeGreaterThan(0);
    }
  });

  it("praises a standout stat and dings a weak one", () => {
    const r = criticReviews(base({ verdict: "hit", stats: stats({ design: 90, battery: 20 }) }));
    expect(r.pros.join(" ")).toMatch(/design/);
    expect(r.cons.join(" ")).toMatch(/battery/);
  });
});
