import { describe, it, expect } from "vitest";
import { STAT_INFO, segmentTopStats, segmentWants, segmentWantsById, segmentPriceLabel } from "./glossary.ts";
import { STAT_KEYS } from "./types.ts";
import { SEGMENTS, segmentById } from "./segments.ts";

describe("glossary (Epic C3)", () => {
  it("has a plain-language explainer for every stat", () => {
    for (const k of STAT_KEYS) {
      expect(STAT_INFO[k]).toBeDefined();
      expect(STAT_INFO[k].label.length).toBeGreaterThan(0);
      expect(STAT_INFO[k].blurb.length).toBeGreaterThan(10);
    }
  });

  it("derives a segment's top stats from its live weights (never hardcoded)", () => {
    // Style is design-led; Pro is performance-led; Budget leans battery — straight from SEGMENTS.
    expect(segmentTopStats(segmentById("style")!)[0]).toBe("design");
    expect(segmentTopStats(segmentById("pro")!)[0]).toBe("performance");
    expect(segmentTopStats(segmentById("budget")!)[0]).toBe("battery");
  });

  it("labels price sensitivity by the segment's elasticity", () => {
    expect(segmentPriceLabel(segmentById("budget")!)).toBe("very price-led");
    expect(segmentPriceLabel(segmentById("pro")!)).toBe("price-insensitive");
  });

  it("writes a one-line 'wants' string for each segment", () => {
    for (const seg of SEGMENTS) {
      const w = segmentWants(seg);
      expect(w).toContain("·");
      expect(w.length).toBeGreaterThan(0);
    }
    expect(segmentWants(segmentById("style")!)).toContain("Design");
    expect(segmentWantsById("pro")).toContain("Performance");
    expect(segmentWantsById("nobody")).toBe("");
  });
});
