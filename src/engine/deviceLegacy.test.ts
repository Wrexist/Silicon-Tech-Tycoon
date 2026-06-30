import { describe, expect, it } from "vitest";
import { deviceLegacy } from "./deviceLegacy.ts";

describe("device legacy lines (Track A)", () => {
  it("varies by verdict and names the category + era, em-dash-free", () => {
    const hit = deviceLegacy({ verdict: "hit", era: 2, category: "phone" });
    const flop = deviceLegacy({ verdict: "flop", era: 2, category: "phone" });
    expect(hit).toContain("breakout");
    expect(hit).toContain("phone");
    expect(hit).not.toBe(flop);
    expect(flop).toContain("missed its moment");
    expect(hit).not.toContain("—");
  });

  it("falls back gracefully when the verdict is missing (older entries)", () => {
    const e = deviceLegacy({ era: 1, category: "tablet" });
    expect(e).toContain("tablet");
    expect(e.length).toBeGreaterThan(10);
  });

  it("is deterministic", () => {
    expect(deviceLegacy({ verdict: "solid", era: 3, category: "laptop" }))
      .toBe(deviceLegacy({ verdict: "solid", era: 3, category: "laptop" }));
  });
});
