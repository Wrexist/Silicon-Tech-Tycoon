import { describe, it, expect } from "vitest";
import { STAT_INFO, SCORE_INFO, TERM_INFO, segmentTopStats, segmentWants, segmentWantsById, segmentPriceLabel } from "./glossary.ts";
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

  it("defines the three hero scores a player stares at (Fit / Build / Projected verdict)", () => {
    const terms = SCORE_INFO.map((s) => s.term);
    expect(terms).toEqual(["Fit", "Build", "Projected verdict"]);
    for (const s of SCORE_INFO) expect(s.def.length).toBeGreaterThan(20); // real causal copy, not a label restatement
  });

  it("keeps every glossary family non-empty with substantive copy (Help hub source of truth)", () => {
    expect(TERM_INFO.length).toBeGreaterThan(5);
    for (const t of TERM_INFO) {
      expect(t.term.length).toBeGreaterThan(0);
      expect(t.def.length).toBeGreaterThan(20);
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
