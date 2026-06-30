import { describe, expect, it } from "vitest";
import { campaignEpilogue, type EpilogueInput } from "./epilogue.ts";

const base: EpilogueInput = {
  companyName: "Silicon", reputation: 88, rank: 3, valuationDollars: 2_000_000_000,
  products: 12, fans: 480_000, legacy: 0,
};

describe("campaign epilogue (Track A)", () => {
  it("opens with a five-years-later send-off naming the company, em-dash-free", () => {
    const e = campaignEpilogue(base);
    expect(e.startsWith("Five years later.")).toBe(true);
    expect(e).toContain("Silicon");
    expect(e).not.toContain("—");
    expect(e.length).toBeGreaterThan(60);
  });

  it("branches on standing: rank #1 reads as industry-leading", () => {
    const top = campaignEpilogue({ ...base, rank: 1 });
    const mid = campaignEpilogue({ ...base, rank: 5, reputation: 72 });
    expect(top).toContain("top of the industry");
    expect(top).not.toBe(mid);
  });

  it("branches on scale: a tens-of-billions valuation reads bigger than a small one", () => {
    const huge = campaignEpilogue({ ...base, valuationDollars: 80_000_000_000 });
    const small = campaignEpilogue({ ...base, valuationDollars: 100_000_000 });
    expect(huge).toContain("tens of billions");
    expect(small).not.toContain("tens of billions");
  });

  it("a prestige founder gets the legend close; a first-timer gets the garage close", () => {
    expect(campaignEpilogue({ ...base, legacy: 2 })).toContain("legend of its founder");
    expect(campaignEpilogue({ ...base, legacy: 0 })).toContain("garage");
  });

  it("is deterministic", () => {
    expect(campaignEpilogue(base)).toBe(campaignEpilogue(base));
  });
});
