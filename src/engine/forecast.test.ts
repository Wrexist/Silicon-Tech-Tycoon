import { describe, it, expect } from "vitest";
import { forecastConfidence, forecastBand, forecastConfidenceLabel } from "./forecast.ts";
import { BALANCE } from "./balance.ts";

const F = BALANCE.market.forecast;

describe("forecast confidence (Epic C2)", () => {
  it("rises with marketer skill and the Demand Sensing project, capped", () => {
    const none = forecastConfidence({ marketerSkill: 0, demandSensing: false });
    const skilled = forecastConfidence({ marketerSkill: 5, demandSensing: false });
    const sensing = forecastConfidence({ marketerSkill: 0, demandSensing: true });
    const both = forecastConfidence({ marketerSkill: 5, demandSensing: true });
    expect(none).toBe(0);
    expect(skilled).toBeGreaterThan(none);
    expect(sensing).toBeGreaterThan(none);
    expect(both).toBeGreaterThan(skilled);
    // never exceeds the cap, even with absurd skill
    expect(forecastConfidence({ marketerSkill: 1000, demandSensing: true })).toBeLessThanOrEqual(F.maxConfidence);
  });

  it("a negative/garbage skill never lowers confidence below zero", () => {
    expect(forecastConfidence({ marketerSkill: -50, demandSensing: false })).toBe(0);
  });
});

describe("forecast band — tightens with confidence, stays honest", () => {
  it("equals the base band at zero confidence and the floor at full confidence", () => {
    expect(forecastBand(0)).toBeCloseTo(F.baseBand, 6);
    expect(forecastBand(1)).toBeCloseTo(F.minBand, 6);
  });

  it("is monotonically non-increasing in confidence and bounded to [minBand, baseBand]", () => {
    let prev = forecastBand(0);
    for (let c = 0; c <= 1.0001; c += 0.1) {
      const b = forecastBand(c);
      expect(b).toBeLessThanOrEqual(prev + 1e-9);
      expect(b).toBeGreaterThanOrEqual(F.minBand - 1e-9);
      expect(b).toBeLessThanOrEqual(F.baseBand + 1e-9);
      prev = b;
    }
  });

  it("the realized band a player ever sees never exceeds the base (no-knowledge) band", () => {
    const conf = forecastConfidence({ marketerSkill: 8, demandSensing: true });
    expect(forecastBand(conf)).toBeLessThanOrEqual(F.baseBand);
  });
});

describe("forecast confidence label", () => {
  it("maps confidence to Low / Medium / High", () => {
    expect(forecastConfidenceLabel(0.1)).toBe("Low");
    expect(forecastConfidenceLabel(0.3)).toBe("Medium");
    expect(forecastConfidenceLabel(0.6)).toBe("High");
  });
});
