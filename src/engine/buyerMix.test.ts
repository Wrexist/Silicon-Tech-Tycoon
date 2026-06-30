// Category-specific buyer mixes (Track D): the same recipe shouldn't win everywhere.
import { describe, expect, it } from "vitest";
import { SEGMENTS, categorySegmentSize, segmentDemand } from "./segments.ts";
import { dollars } from "./money.ts";
import type { CategoryId, Stats } from "./types.ts";

const flatTrends = { weights: { performance: 0.2, quality: 0.2, battery: 0.2, design: 0.2, ecosystem: 0.2 }, targetWeights: { performance: 0.2, quality: 0.2, battery: 0.2, design: 0.2, ecosystem: 0.2 } } as never;
const CATS: CategoryId[] = ["phone", "tablet", "laptop", "desktop", "monitor", "console", "wearable", "experimental"];

describe("category buyer mixes", () => {
  it("every category's segment mix sums to ~1", () => {
    for (const cat of CATS) {
      const total = SEGMENTS.reduce((a, s) => a + categorySegmentSize(cat, s), 0);
      expect(Math.abs(total - 1)).toBeLessThan(1e-9);
    }
  });

  it("phone keeps the default global sizes (core loop + sim unchanged)", () => {
    for (const seg of SEGMENTS) expect(categorySegmentSize("phone", seg)).toBe(seg.size);
  });

  it("categories have genuinely DIFFERENT mixes (wearable Style-led, desktop Pro-led)", () => {
    const sizeIn = (cat: CategoryId, id: string) => categorySegmentSize(cat, SEGMENTS.find((s) => s.id === id)!);
    expect(sizeIn("wearable", "style")).toBeGreaterThan(sizeIn("desktop", "style"));
    expect(sizeIn("desktop", "pro")).toBeGreaterThan(sizeIn("wearable", "pro"));
    expect(sizeIn("desktop", "pro")).toBeGreaterThan(sizeIn("console", "pro"));
  });

  it("a Pro-tuned recipe wins more of a Pro-led category than a Style-led one", () => {
    const proStats: Stats = { performance: 95, quality: 80, battery: 60, design: 40, ecosystem: 70 };
    const onDesktop = segmentDemand(proStats, dollars(1500), flatTrends, "desktop").demandIndex;
    const onWearable = segmentDemand(proStats, dollars(1500), flatTrends, "wearable").demandIndex;
    expect(onDesktop).toBeGreaterThan(onWearable);
  });

  it("a Style-tuned recipe flips the other way", () => {
    const styleStats: Stats = { performance: 45, quality: 70, battery: 55, design: 98, ecosystem: 60 };
    const onWearable = segmentDemand(styleStats, dollars(400), flatTrends, "wearable").demandIndex;
    const onDesktop = segmentDemand(styleStats, dollars(400), flatTrends, "desktop").demandIndex;
    expect(onWearable).toBeGreaterThan(onDesktop);
  });
});
