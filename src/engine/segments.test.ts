import { describe, it, expect } from "vitest";
import {
  SEGMENTS,
  segmentById,
  segmentDemand,
  segmentPriceFit,
  segmentFit,
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

describe("D1: tier coherence: a lopsided build loses the broad market, not Pro", () => {
  // SAME stats + price; the only difference is the build's tier bottleneck (how lopsided it is). This
  // isolates the coherence mechanic from stat-fit, proving the tier MIX is its own decision axis.
  const s = stats({ performance: 80, quality: 75, battery: 70, design: 65, ecosystem: 70 });
  const price = dollars(700);
  const capOf = (d: ReturnType<typeof segmentDemand>, id: string) => d.perSegment.find((x) => x.id === id)!.captured;
  const coherent = segmentDemand(s, price, flat, "phone", 0, undefined, 0.0);
  const lopsided = segmentDemand(s, price, flat, "phone", 0, undefined, 0.6);

  it("discounts Mainstream demand for a lopsided build", () => {
    expect(capOf(lopsided, "mainstream")).toBeLessThan(capOf(coherent, "mainstream"));
  });

  it("barely touches Pro (it bought the peak)", () => {
    const proDrop = 1 - capOf(lopsided, "pro") / capOf(coherent, "pro");
    const mainDrop = 1 - capOf(lopsided, "mainstream") / capOf(coherent, "mainstream");
    expect(proDrop).toBeLessThan(mainDrop * 0.4); // Pro loses far less share than the broad market
  });

  it("a bottleneck inside the deadzone changes nothing (ordinary builds untouched)", () => {
    const tiny = segmentDemand(s, price, flat, "phone", 0, undefined, BALANCE.market.segments.coherenceThreshold);
    expect(tiny).toEqual(coherent);
  });

  it("the discount is capped (never a wipeout, even at maximum lopsidedness)", () => {
    const extreme = segmentDemand(s, price, flat, "phone", 0, undefined, 1);
    const worst = 1 - capOf(extreme, "mainstream") / capOf(coherent, "mainstream");
    expect(worst).toBeLessThanOrEqual(BALANCE.market.segments.coherenceMaxDiscount + 1e-9);
  });

  it("can flip the winning segment: a balanced build wins Mainstream, a lopsided one tilts to Pro", () => {
    // Relative to the broad market, a lopsided build shifts its best-captured weight toward Pro.
    const coherentProShare = capOf(coherent, "pro") / capOf(coherent, "mainstream");
    const lopsidedProShare = capOf(lopsided, "pro") / capOf(lopsided, "mainstream");
    expect(lopsidedProShare).toBeGreaterThan(coherentProShare);
  });
});

describe("D2: a channel's segment affinity amplifies that segment's reach", () => {
  const s = stats({ performance: 70, quality: 70, battery: 70, design: 70, ecosystem: 70 });
  const price = dollars(600);
  const capOf = (d: ReturnType<typeof segmentDemand>, id: string) => d.perSegment.find((x) => x.id === id)!.captured;
  const neutral = segmentDemand(s, price, flat, "phone", 0, undefined, 0, undefined);
  const proMatched = segmentDemand(s, price, flat, "phone", 0, undefined, 0, "pro");

  it("lifts the matched segment's captured demand", () => {
    expect(capOf(proMatched, "pro")).toBeGreaterThan(capOf(neutral, "pro"));
    expect(capOf(proMatched, "pro") / capOf(neutral, "pro")).toBeCloseTo(1 + BALANCE.market.segments.channelAffinityBonus, 5);
  });

  it("leaves the OTHER segments untouched (a targeted lift, not global hype)", () => {
    expect(capOf(proMatched, "mainstream")).toBeCloseTo(capOf(neutral, "mainstream"), 9);
    expect(capOf(proMatched, "budget")).toBeCloseTo(capOf(neutral, "budget"), 9);
  });

  it("no affinity (no campaign / neutral channel) is byte-identical to pre-D2", () => {
    expect(proMatched).not.toEqual(neutral); // sanity: the matched call DID change something
    expect(segmentDemand(s, price, flat, "phone", 0, undefined, 0, undefined)).toEqual(neutral);
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

describe("G1 — style appeal lifts the Style segment only", () => {
  const s = stats({ performance: 60, quality: 60, battery: 60, design: 60, ecosystem: 60 });

  it("raises the Style segment's fit + capture and leaves other segments untouched", () => {
    const plain = segmentDemand(s, dollars(500), flat, "phone", 0);
    const striking = segmentDemand(s, dollars(500), flat, "phone", 8);
    const styleOf = (d: typeof plain) => d.perSegment.find((x) => x.id === "style")!;
    const proOf = (d: typeof plain) => d.perSegment.find((x) => x.id === "pro")!;
    expect(styleOf(striking).fit).toBeGreaterThan(styleOf(plain).fit);
    expect(styleOf(striking).captured).toBeGreaterThan(styleOf(plain).captured);
    // every non-style segment is identical
    expect(proOf(striking).captured).toBeCloseTo(proOf(plain).captured, 9);
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
