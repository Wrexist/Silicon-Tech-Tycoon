import { describe, it, expect } from "vitest";
import {
  MANDATES,
  MANDATE_FRACTION_CAP,
  MANDATE_CEILING_CAP,
  MANDATE_SALT,
  mandateById,
  eligibleMandates,
  offerMandates,
  aggregateMandates,
  ZERO_MANDATE_BONUS,
  type MandateEffect,
} from "./mandates.ts";

const FRACTION_KEYS: (keyof MandateEffect)[] = ["hype", "rpMult", "buildCostReduction", "fanGainMult", "demandMult"];

describe("mandate catalog integrity", () => {
  it("ids are unique and non-empty", () => {
    const ids = MANDATES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MANDATES) expect(m.id.length).toBeGreaterThan(0);
  });

  it("every mandate has copy: name, one-line description, upside + downside labels", () => {
    for (const m of MANDATES) {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(m.upside.length).toBeGreaterThan(0);
      expect(m.downside.length).toBeGreaterThan(0);
    }
  });

  it("effects stay within the small magnitude caps (≤10% fractional, ±1 design ceiling)", () => {
    for (const m of MANDATES) {
      for (const k of FRACTION_KEYS) {
        const v = m.effect[k];
        if (v != null) expect(Math.abs(v)).toBeLessThanOrEqual(MANDATE_FRACTION_CAP + 1e-9);
      }
      if (m.effect.designCeiling != null) {
        expect(Math.abs(m.effect.designCeiling)).toBeLessThanOrEqual(MANDATE_CEILING_CAP);
        expect(Number.isInteger(m.effect.designCeiling)).toBe(true);
      }
    }
  });

  it("is a genuine trade-off: at most two effect hooks, and one of each sign", () => {
    for (const m of MANDATES) {
      const entries = Object.entries(m.effect).filter(([, v]) => v !== 0);
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries.length).toBeLessThanOrEqual(2); // ≤2 hooks per mandate (design rule)
      // A real identity trade: at least one positive AND at least one negative effect.
      const signs = entries.map(([, v]) => Math.sign(v as number));
      expect(signs).toContain(1);
      expect(signs).toContain(-1);
    }
  });

  it("era gating is sane (minEra ≥ 1) and the first draft (era 2) has a deep enough pool", () => {
    for (const m of MANDATES) expect(m.minEra).toBeGreaterThanOrEqual(1);
    // Entering era 2 with nothing held must offer at least 3 candidates.
    expect(eligibleMandates(2, []).length).toBeGreaterThanOrEqual(3);
  });

  it("later identities are gated behind later eras (some minEra ≥ 3)", () => {
    expect(MANDATES.some((m) => m.minEra >= 3)).toBe(true);
    // An era-3-only mandate is NOT eligible at the first (era-2) draft.
    const lateOnly = MANDATES.filter((m) => m.minEra >= 3).map((m) => m.id);
    const era2ids = eligibleMandates(2, []).map((m) => m.id);
    for (const id of lateOnly) expect(era2ids).not.toContain(id);
  });

  it("mandateById round-trips every catalog id, and misses cleanly", () => {
    for (const m of MANDATES) expect(mandateById(m.id)?.id).toBe(m.id);
    expect(mandateById("nope")).toBeUndefined();
  });
});

describe("offer generation — deterministic + exclusionary", () => {
  it("uses the registered fresh salt 281", () => {
    expect(MANDATE_SALT).toBe(281);
  });

  it("the same (seed, week, era, held) yields the identical 3 offers", () => {
    const a = offerMandates(12345, 40, 2, []);
    const b = offerMandates(12345, 40, 2, []);
    expect(a).toEqual(b);
    expect(a.length).toBe(3);
    expect(new Set(a).size).toBe(3); // distinct
  });

  it("different seeds generally roll different hands", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) seen.add(offerMandates(seed, 40, 2, []).join(","));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("only offers era-eligible mandates", () => {
    const era2 = offerMandates(777, 30, 2, []);
    for (const id of era2) expect(mandateById(id)!.minEra).toBeLessThanOrEqual(2);
  });

  it("excludes already-held mandates from a later draft", () => {
    const held = offerMandates(999, 20, 2, []);
    const next = offerMandates(999, 60, 3, held);
    for (const id of next) expect(held).not.toContain(id);
  });

  it("returns fewer than 3 gracefully when the pool is nearly exhausted", () => {
    // Hold all but two eligible mandates entering era 3 → at most 2 can be offered.
    const eligible = eligibleMandates(3, []).map((m) => m.id);
    const held = eligible.slice(0, eligible.length - 2);
    const offer = offerMandates(5, 5, 3, held);
    expect(offer.length).toBe(2);
    for (const id of offer) expect(held).not.toContain(id);
  });
});

describe("aggregation math", () => {
  it("empty / absent held → the all-zero bonus (byte-identical no-op)", () => {
    expect(aggregateMandates([])).toEqual(ZERO_MANDATE_BONUS);
    expect(aggregateMandates(undefined)).toEqual(ZERO_MANDATE_BONUS);
  });

  it("a single mandate aggregates to exactly its effect", () => {
    const cult = mandateById("cult")!; // { fanGainMult: 0.10, hype: -0.06 }
    const agg = aggregateMandates(["cult"]);
    expect(agg.fanGainMult).toBeCloseTo(cult.effect.fanGainMult!, 10);
    expect(agg.hype).toBeCloseTo(cult.effect.hype!, 10);
    expect(agg.rpMult).toBe(0);
    expect(agg.demandMult).toBe(0);
    expect(agg.buildCostReduction).toBe(0);
    expect(agg.designCeiling).toBe(0);
  });

  it("multiple mandates sum per-axis; unknown ids are skipped", () => {
    // lean: { buildCostReduction: 0.08, hype: -0.05 }; press: { hype: 0.09, rpMult: -0.05 }
    const agg = aggregateMandates(["lean", "press", "ghost"]);
    expect(agg.buildCostReduction).toBeCloseTo(0.08, 10);
    expect(agg.hype).toBeCloseTo(-0.05 + 0.09, 10);
    expect(agg.rpMult).toBeCloseTo(-0.05, 10);
  });

  it("does not mutate the shared ZERO constant", () => {
    aggregateMandates(["cult"]);
    expect(ZERO_MANDATE_BONUS).toEqual({ designCeiling: 0, hype: 0, rpMult: 0, buildCostReduction: 0, fanGainMult: 0, demandMult: 0 });
  });
});
