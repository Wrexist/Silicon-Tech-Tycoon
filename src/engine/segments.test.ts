import { describe, it, expect } from "vitest";
import {
  SEGMENTS,
  segmentById,
  segmentDemand,
  segmentPriceFit,
  segmentFit,
  tuningSegmentBias,
} from "./segments.ts";
import { dollars, toDollars } from "./money.ts";
import { BALANCE } from "./balance.ts";
import { STAT_KEYS, type ConsumerTrends, type Stats } from "./types.ts";

const flat: ConsumerTrends = {
  weights: { performance: 0.2, quality: 0.2, battery: 0.2, design: 0.2, ecosystem: 0.2 },
  targetWeights: { performance: 0.2, quality: 0.2, battery: 0.2, design: 0.2, ecosystem: 0.2 },
};

function stats(p: Partial<Stats>): Stats {
  return { performance: 0, quality: 0, battery: 0, design: 0, ecosystem: 0, ...p };
}

describe("segments — table integrity", () => {
  it("has five segments whose sizes sum to ~1", () => {
    expect(SEGMENTS).toHaveLength(5);
    const total = SEGMENTS.reduce((a, s) => a + s.size, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("every segment weights all five stats non-negatively with a positive price sensitivity", () => {
    for (const seg of SEGMENTS) {
      for (const k of STAT_KEYS) {
        expect(seg.weights[k]).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(seg.weights[k])).toBe(true);
      }
      expect(seg.priceSensitivity).toBeGreaterThan(0);
    }
  });
});

describe("segmentDemand — shape & determinism", () => {
  const s = stats({ performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 });

  it("returns one result per segment with bounded aggregates", () => {
    const d = segmentDemand(s, dollars(500), flat, "phone");
    expect(d.perSegment).toHaveLength(5);
    expect(d.demandIndex).toBeGreaterThanOrEqual(0);
    expect(d.demandIndex).toBeLessThanOrEqual(100);
    expect(d.effectivePriceFit).toBeGreaterThanOrEqual(0);
    expect(SEGMENTS.map((x) => x.id)).toContain(d.dominant);
    expect(SEGMENTS.map((x) => x.id)).toContain(d.weakest);
  });

  it("is pure / deterministic", () => {
    const a = segmentDemand(s, dollars(500), flat, "phone");
    const b = segmentDemand(s, dollars(500), flat, "phone");
    expect(a).toEqual(b);
  });
});

describe("positioning matters — the new strategic axis", () => {
  const price = dollars(700);
  const perfKing = stats({ performance: 95, quality: 80, battery: 60, design: 35, ecosystem: 55 });
  const styleKing = stats({ performance: 45, quality: 75, battery: 45, design: 95, ecosystem: 70 });

  it("a performance build captures the Pro segment better than a style build does", () => {
    const perf = segmentDemand(perfKing, price, flat, "phone");
    const style = segmentDemand(styleKing, price, flat, "phone");
    const proOf = (d: typeof perf) => d.perSegment.find((x) => x.id === "pro")!.captured;
    expect(proOf(perf)).toBeGreaterThan(proOf(style));
  });

  it("a style build captures the Style segment better than a performance build does", () => {
    const perf = segmentDemand(perfKing, price, flat, "phone");
    const style = segmentDemand(styleKing, price, flat, "phone");
    const styleOf = (d: typeof perf) => d.perSegment.find((x) => x.id === "style")!.captured;
    expect(styleOf(style)).toBeGreaterThan(styleOf(perf));
  });
});

describe("price sensitivity — Budget reacts harder than Enterprise", () => {
  it("the same overpricing costs Budget more price-fit than Enterprise", () => {
    const fit = 60;
    const budget = segmentById("budget")!;
    const enterprise = segmentById("enterprise")!;
    // fair price for this fit ≈ fit × valueToPrice; overprice both by the same 1.6× ratio.
    const v2p = toDollars(BALANCE.market.price.valueToPrice);
    const fair = dollars(Math.round(fit * v2p));
    const over = dollars(Math.round(fit * v2p * 1.6));

    const budgetFair = segmentPriceFit(fair, fit, budget);
    const budgetOver = segmentPriceFit(over, fit, budget);
    const entFair = segmentPriceFit(fair, fit, enterprise);
    const entOver = segmentPriceFit(over, fit, enterprise);

    // Absolute: a price-sensitive segment ends up less satisfied by the same overpriced product.
    expect(budgetOver).toBeLessThan(entOver);
    // Relative: Budget loses a bigger FRACTION of its price-fit to the overpricing.
    expect(budgetOver / budgetFair).toBeLessThan(entOver / entFair);
  });
});

describe("G1 — style appeal is a broad, design-weighted sales lever", () => {
  const s = stats({ performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 });
  const maxAppeal = BALANCE.market.aesthetics.maxStyleAppeal;

  it("lifts the Style segment most, and other segments in proportion to how much they value design", () => {
    const plain = segmentDemand(s, dollars(500), flat, "phone", 0);
    const striking = segmentDemand(s, dollars(500), flat, "phone", maxAppeal);
    const segOf = (d: typeof plain, id: string) => d.perSegment.find((x) => x.id === id)!;
    const lift = (id: string) => segOf(striking, id).fit - segOf(plain, id).fit;
    // Style gets the FULL lift; every design-valuing segment gets some.
    expect(lift("style")).toBeCloseTo(maxAppeal, 6);
    expect(lift("mainstream")).toBeGreaterThan(0);
    // …but no segment out-lifts Style, and the mass-market Mainstream (design 0.9) reads a striking
    // design more than the spec-driven Enterprise (design 0.6).
    expect(lift("style")).toBeGreaterThan(lift("mainstream"));
    expect(lift("mainstream")).toBeGreaterThan(lift("enterprise"));
    // Captured share genuinely rises for the design-led segment.
    expect(segOf(striking, "style").captured).toBeGreaterThan(segOf(plain, "style").captured);
  });

  it("defaults to no effect (backward compatible)", () => {
    const a = segmentDemand(s, dollars(500), flat, "phone");
    const b = segmentDemand(s, dollars(500), flat, "phone", 0);
    expect(a).toEqual(b);
  });
});

describe("no universal recipe — the anti-solved-game guard", () => {
  it("the build that dominates one segment does not dominate every segment", () => {
    // A cheap, battery-led all-rounder vs a premium design flagship: their best segments differ.
    const valueBuild = segmentDemand(
      stats({ performance: 55, quality: 55, battery: 80, design: 30, ecosystem: 35 }),
      dollars(250),
      flat,
      "phone",
    );
    const flagship = segmentDemand(
      stats({ performance: 70, quality: 85, battery: 55, design: 95, ecosystem: 80 }),
      dollars(1400),
      flat,
      "phone",
    );
    expect(valueBuild.dominant).not.toBe(flagship.dominant);
  });

  it("segmentFit varies across segments for a non-uniform product (segments are distinct)", () => {
    const lopsided = stats({ performance: 90, quality: 40, battery: 30, design: 90, ecosystem: 40 });
    const fits = SEGMENTS.map((seg) => segmentFit(lopsided, seg, "phone", flat));
    const min = Math.min(...fits);
    const max = Math.max(...fits);
    expect(max - min).toBeGreaterThan(5); // distinct tastes produce distinct fits
  });
});

describe("marketing targeting — channel segment bias (item 1.3)", () => {
  const di = (s: Stats, bias?: Partial<Record<import("./types.ts").SegmentId, number>>) =>
    segmentDemand(s, dollars(700), flat, "phone", 0, undefined, bias).demandIndex;
  const pro = stats({ performance: 90, quality: 70, battery: 60, design: 40, ecosystem: 85 });
  const style = stats({ performance: 50, quality: 70, battery: 55, design: 95, ecosystem: 60 });
  const proBias = { pro: 1.4, enterprise: 1.3, mainstream: 1.05, budget: 0.9, style: 0.8 };
  const styleBias = { style: 1.5, mainstream: 1.1, budget: 1.05, pro: 0.85, enterprise: 0.75 };

  it("no bias reproduces the base demand exactly", () => {
    expect(di(pro, undefined)).toBe(di(pro));
  });

  it("redistributes demand toward the channel's audience (positioning, not free volume)", () => {
    // A Pro product does better under a Pro-targeting channel than a Style-targeting one, and vice
    // versa — the campaign REDISTRIBUTES reach toward the buyers it reaches.
    expect(di(pro, proBias)).toBeGreaterThan(di(pro, styleBias));
    expect(di(style, styleBias)).toBeGreaterThan(di(style, proBias));
    // And it never inflates total reach for a uniform product (renormalised): a perfectly balanced
    // product is ~unchanged by any bias.
    const balanced = stats({ performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 });
    expect(di(balanced, proBias)).toBeCloseTo(di(balanced), 0);
  });
});

describe("build-tuning segment positioning (item 3.4)", () => {
  const perSeg = (s: Stats, tuning?: string) => {
    const out: Record<string, number> = {};
    for (const r of segmentDemand(s, dollars(700), flat, "phone", 0, undefined, undefined, tuningSegmentBias(tuning)).perSegment) out[r.id] = r.fit;
    return out;
  };
  const mid = stats({ performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 });

  it("balanced (and undefined) tuning is a pure no-op — byte-identical fit", () => {
    expect(tuningSegmentBias("balanced")).toEqual({});
    expect(tuningSegmentBias(undefined)).toEqual({});
    expect(perSeg(mid, "balanced")).toEqual(perSeg(mid, undefined));
    expect(perSeg(mid, undefined)).toEqual(perSeg(mid));
  });

  it("value leans price-led buyers; premium leans the aspirational segments", () => {
    const base = perSeg(mid);
    const value = perSeg(mid, "value");
    expect(value.budget).toBeGreaterThan(base.budget);
    expect(value.mainstream).toBeGreaterThan(base.mainstream);
    expect(value.style).toBe(base.style); // untouched segments unchanged

    const premium = perSeg(mid, "premium");
    expect(premium.style).toBeGreaterThan(base.style);
    expect(premium.enterprise).toBeGreaterThan(base.enterprise);
    expect(premium.budget).toBe(base.budget);
  });

  it("performance leans Pro; efficiency leans Budget — the nudge is bounded (fit ≤ 100)", () => {
    expect(perSeg(mid, "performance").pro).toBeGreaterThan(perSeg(mid).pro);
    expect(perSeg(mid, "efficiency").budget).toBeGreaterThan(perSeg(mid).budget);
    const maxed = stats({ performance: 100, quality: 100, battery: 100, design: 100, ecosystem: 100 });
    for (const f of Object.values(perSeg(maxed, "performance"))) expect(f).toBeLessThanOrEqual(100);
  });
});
