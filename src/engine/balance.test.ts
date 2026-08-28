// Dedicated STRUCTURAL guards for engine/balance.ts — the biggest tuning surface. Deliberately NOT
// value-pinning (tuning must stay painless): these assert the shapes, signs, ranges and
// relationships the engine logically depends on. Behavioural/design guards (verdict bands, elastic
// demand, expectation margins) live in balanceGuards.test.ts — nothing here duplicates them.
import { describe, it, expect } from "vitest";
import { BALANCE } from "./balance.ts";

const ERA_COUNT = BALANCE.eras.length;

/** Recursively collect every numeric leaf with its dotted path. */
function numericLeaves(node: unknown, path = "", out: { path: string; value: number }[] = []) {
  if (typeof node === "number") {
    out.push({ path, value: node });
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => numericLeaves(v, `${path}[${i}]`, out));
  } else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) numericLeaves(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

describe("global shape", () => {
  it("every number in BALANCE is finite, except the deliberate era-4/5 Infinity gates", () => {
    const allowInfinite = /^eras\[\d+\]\.(repToAdvance|revToAdvance)$/;
    for (const { path, value } of numericLeaves(BALANCE)) {
      expect(Number.isNaN(value), `${path} is NaN`).toBe(false);
      if (!Number.isFinite(value)) {
        expect(path, `unexpected non-finite at ${path}`).toMatch(allowInfinite);
        expect(value).toBe(Infinity);
      }
    }
  });

  it("eras are numbered 1..N in order with unique names; finite thresholds are non-decreasing", () => {
    BALANCE.eras.forEach((e, i) => expect(e.era).toBe(i + 1));
    const names = BALANCE.eras.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    for (let i = 1; i < ERA_COUNT; i++) {
      expect(BALANCE.eras[i].repToAdvance).toBeGreaterThanOrEqual(BALANCE.eras[i - 1].repToAdvance);
      expect(BALANCE.eras[i].revToAdvance).toBeGreaterThanOrEqual(BALANCE.eras[i - 1].revToAdvance);
    }
  });

  it("every era-indexed table covers all eras", () => {
    const tables: [string, { length: number }][] = [
      ["market.eraVolumeScale", BALANCE.market.eraVolumeScale],
      ["market.competition.eraPressure", BALANCE.market.competition.eraPressure],
      ["eraModifiers", BALANCE.eraModifiers],
      ["research.eraMultiplier", BALANCE.research.eraMultiplier],
      ["reputation.hitThresholdByEra", BALANCE.reputation.hitThresholdByEra],
      ["reputation.solidThresholdByEra", BALANCE.reputation.solidThresholdByEra],
      ["reputation.flopThresholdByEra", BALANCE.reputation.flopThresholdByEra],
      ["reputation.minByEra", BALANCE.reputation.minByEra],
      ["reputation.expectation.hitMarginByEra", BALANCE.reputation.expectation.hitMarginByEra],
      ["designBudget.baseByEra", BALANCE.designBudget.baseByEra],
      ["competitors.strengthDecayByEra", BALANCE.competitors.strengthDecayByEra],
      ["competitors.reactMaxStrengthByEra", BALANCE.competitors.reactMaxStrengthByEra],
      ["competitors.lateStrengthByEra", BALANCE.competitors.lateStrengthByEra],
    ];
    for (const [name, table] of tables) {
      expect(table.length, `${name} must have one entry per era`).toBe(ERA_COUNT);
    }
  });
});

describe("market rails", () => {
  it("price-curve parameters keep priceFit well-defined and asymmetric", () => {
    const p = BALANCE.market.price;
    expect(p.tolerance).toBeGreaterThan(0);
    expect(p.valueToPrice).toBeGreaterThan(0);
    expect(p.overpriceHarshness).toBeGreaterThanOrEqual(1); // overpricing at least as harsh as under
    expect(p.guidanceFitFloor).toBeGreaterThan(0);
    expect(p.guidanceFitFloor).toBeLessThan(1); // else the log in priceGuidance degenerates
    expect(p.minFit).toBeGreaterThan(0);
    expect(p.minFit).toBeLessThan(1);
    expect(p.maxFit).toBeGreaterThanOrEqual(1);
    expect(p.segmentLift).toBeGreaterThanOrEqual(0);
    expect(p.segmentLift).toBeLessThanOrEqual(1);
  });

  it("hype rails: 0 < base ≤ max; weights and campaign cap non-negative", () => {
    const h = BALANCE.market.hype;
    expect(h.base).toBeGreaterThan(0);
    expect(h.max).toBeGreaterThanOrEqual(h.base);
    expect(h.campaignMax).toBeGreaterThan(0);
    expect(h.reputationWeight).toBeGreaterThanOrEqual(0);
    expect(h.marketerWeight).toBeGreaterThanOrEqual(0);
  });

  it("synergy stays a bounded nudge around 1", () => {
    const s = BALANCE.market.synergy;
    expect(s.minFactor).toBeGreaterThan(0);
    expect(s.minFactor).toBeLessThanOrEqual(1);
    expect(s.maxFactor).toBeGreaterThanOrEqual(1);
    for (const frac of [s.flagshipMeanFloor, s.flagshipMaxGap, s.weakestThreshold]) {
      expect(frac).toBeGreaterThanOrEqual(0);
      expect(frac).toBeLessThanOrEqual(1);
    }
    expect(s.bottleneckPenalty).toBeGreaterThanOrEqual(0);
    expect(s.flagshipBonus).toBeGreaterThanOrEqual(0);
  });

  it("demand variance and competition constants stay in engine-safe ranges", () => {
    expect(BALANCE.market.demandVariance).toBeGreaterThanOrEqual(0);
    expect(BALANCE.market.demandVariance).toBeLessThan(1); // a negative volume multiplier would be nonsense
    const c = BALANCE.market.competition;
    expect(c.factorK).toBeGreaterThan(0);
    for (const pen of [c.matchPenalty, c.beatPenalty, c.selfPenalty, c.rivalEntrySalesHaircut]) {
      expect(pen).toBeGreaterThanOrEqual(0);
      expect(pen).toBeLessThanOrEqual(1);
    }
    expect(c.selfPenalty).toBeLessThan(c.matchPenalty); // sequels share a fanbase — softer than a rival
    expect(c.matchPenalty).toBeLessThan(c.beatPenalty); // being beaten stings more than being matched
    for (const p of c.eraPressure) expect(p).toBeGreaterThan(0);
    expect(BALANCE.market.trendDrift.easing).toBeGreaterThan(0);
    expect(BALANCE.market.trendDrift.easing).toBeLessThanOrEqual(1);
  });

  it("refresh-rate and storage option ladders ascend from their baseline (index 0)", () => {
    for (const opts of [BALANCE.design.refreshRate.options, BALANCE.design.storage.options]) {
      expect(opts.length).toBeGreaterThan(1);
      for (let i = 1; i < opts.length; i++) expect(opts[i]).toBeGreaterThan(opts[i - 1]);
    }
    expect(BALANCE.design.refreshRate.options[0]).toBe(60); // computeStats counts steps above 60Hz
    expect(BALANCE.design.storage.options[0]).toBe(128); // …and above the 128GB baseline
  });
});

describe("sales curve rails", () => {
  it("curve weeks are positive integers with the peak inside the window", () => {
    const s = BALANCE.sales;
    expect(Number.isInteger(s.totalWeeks)).toBe(true);
    expect(s.totalWeeks).toBeGreaterThan(0);
    expect(Number.isInteger(s.peakWeek)).toBe(true);
    expect(s.peakWeek).toBeGreaterThanOrEqual(1);
    expect(s.peakWeek).toBeLessThan(s.totalWeeks);
    expect(s.scoreToVolume).toBeGreaterThan(0);
    expect(s.floorUnits).toBeGreaterThanOrEqual(0);
  });

  it("word-of-mouth covers all four verdicts; 'steady' reproduces the legacy curve exactly", () => {
    const s = BALANCE.sales;
    for (const verdict of ["hit", "solid", "steady", "flop"] as const) {
      const w = s.wordOfMouth[verdict];
      expect(w).toBeDefined();
      expect(w.rampPow).toBeGreaterThan(0);
      expect(w.declinePow).toBeGreaterThan(0);
      expect(w.tailLift).toBeGreaterThanOrEqual(0);
    }
    // documented guarantee: ordinary ("steady") launches are unchanged from the legacy shape
    expect(s.wordOfMouth.steady.rampPow).toBe(s.rampPow);
    expect(s.wordOfMouth.steady.declinePow).toBe(s.declinePow);
    expect(s.wordOfMouth.steady.tailLift).toBe(0);
  });
});

describe("probabilities and fractions used as such", () => {
  it("weekly chances and shares sit in [0, 1]", () => {
    const probs: [string, number][] = [
      ["events.chainChance", BALANCE.events.chainChance],
      ["events.crunchMaxCashShare", BALANCE.events.crunchMaxCashShare],
      ["churn.quitChancePerWeek", BALANCE.churn.quitChancePerWeek],
      ["poaching.chancePerWeek", BALANCE.poaching.chancePerWeek],
      ["mergers.entryChancePerWeek", BALANCE.mergers.entryChancePerWeek],
      ["research.eureka.jackpotChance", BALANCE.research.eureka.jackpotChance],
      ["competitors.rivalClash.chancePerWeek", BALANCE.competitors.rivalClash.chancePerWeek],
      ["platform.licenseeChurn.churnChancePerWeek", BALANCE.platform.licenseeChurn.churnChancePerWeek],
      ["fans.preOrderConversion", BALANCE.fans.preOrderConversion],
      ["fans.lossShareOnFlop", BALANCE.fans.lossShareOnFlop],
      ["fans.preOrderCap", BALANCE.fans.preOrderCap],
      ["fans.selloutMinDemandShare", BALANCE.fans.selloutMinDemandShare],
      ["fans.undersupplyFanPenalty", BALANCE.fans.undersupplyFanPenalty],
      ["shop.resaleRate", BALANCE.shop.resaleRate],
      ["marketingPush.costPct", BALANCE.marketingPush.costPct],
      ["marketingPush.pushFalloff", BALANCE.marketingPush.pushFalloff],
      ["build.rushCostPct", BALANCE.build.rushCostPct],
      ["financing.originationFee", BALANCE.financing.originationFee],
      ["hr.underpaidRelief", BALANCE.hr.underpaidRelief],
      ["hr.minQuitChanceMult", BALANCE.hr.minQuitChanceMult],
    ];
    for (const [name, v] of probs) {
      expect(v, `${name} out of [0,1]`).toBeGreaterThanOrEqual(0);
      expect(v, `${name} out of [0,1]`).toBeLessThanOrEqual(1);
    }
  });

  it("weekly decay multipliers sit in (0, 1]", () => {
    const decays: [string, number][] = [
      ["fans.decayPerWeek", BALANCE.fans.decayPerWeek],
      ["brand.decayPerWeek", BALANCE.brand.decayPerWeek],
      ["valuationMomentum.decayPerWeek", BALANCE.valuationMomentum.decayPerWeek],
      ["market.regions.loyalty.decayPerWeek", BALANCE.market.regions.loyalty.decayPerWeek],
    ];
    for (const [name, v] of decays) {
      expect(v, name).toBeGreaterThan(0);
      expect(v, name).toBeLessThanOrEqual(1);
    }
    for (const d of BALANCE.competitors.strengthDecayByEra) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it("contract-negotiation odds are valid per temper (walk + improve ≤ 1)", () => {
    const n = BALANCE.platform.contract.negotiate;
    for (const temper of [n.eager, n.measured, n.hardball]) {
      expect(temper.walk).toBeGreaterThanOrEqual(0);
      expect(temper.improve).toBeGreaterThanOrEqual(0);
      expect(temper.walk + temper.improve).toBeLessThanOrEqual(1);
    }
    expect(n.bonusMult).toBeGreaterThan(1); // a won negotiation must actually improve the bonus
  });

  it("rival-arc phase transitions each sum to 1", () => {
    for (const [phase, row] of Object.entries(BALANCE.competitors.arc.transitions)) {
      const total = Object.values(row).reduce((a, b) => a + b, 0);
      expect(total, `arc.transitions.${phase}`).toBeCloseTo(1, 10);
    }
  });
});

describe("week counts and pacing", () => {
  it("cadence/cooldown windows are positive integers", () => {
    const weeks: [string, number][] = [
      ["quartersWeeks", BALANCE.quartersWeeks],
      ["interrupts.minGapWeeks", BALANCE.interrupts.minGapWeeks],
      ["interrupts.minGapWeeksLate", BALANCE.interrupts.minGapWeeksLate],
      ["research.timer.minWeeks", BALANCE.research.timer.minWeeks],
      ["research.timer.maxWeeks", BALANCE.research.timer.maxWeeks],
      ["research.eureka.cadenceWeeks", BALANCE.research.eureka.cadenceWeeks],
      ["research.eureka.cooldownWeeks", BALANCE.research.eureka.cooldownWeeks],
      ["build.baseWeeks", BALANCE.build.baseWeeks],
      ["build.minWeeks", BALANCE.build.minWeeks],
      ["financing.termWeeks", BALANCE.financing.termWeeks],
      ["poaching.cooldownWeeks", BALANCE.poaching.cooldownWeeks],
      ["morale.cooldownWeeks", BALANCE.morale.cooldownWeeks],
      ["ipo.shareholders.quarterWeeks", BALANCE.ipo.shareholders.quarterWeeks],
      ["legacyEra.mandate.windowWeeks", BALANCE.legacyEra.mandate.windowWeeks],
      ["postLaunch.cadenceWeeks", BALANCE.postLaunch.cadenceWeeks],
      ["postLaunch.cooldownWeeks", BALANCE.postLaunch.cooldownWeeks],
      ["market.competition.strike.cooldownWeeks", BALANCE.market.competition.strike.cooldownWeeks],
    ];
    for (const [name, v] of weeks) {
      expect(Number.isInteger(v), `${name} must be an integer`).toBe(true);
      expect(v, name).toBeGreaterThanOrEqual(1);
    }
  });

  it("ordered week relationships the engine relies on", () => {
    expect(BALANCE.build.minWeeks).toBeLessThanOrEqual(BALANCE.build.baseWeeks);
    expect(BALANCE.research.timer.minWeeks).toBeLessThanOrEqual(BALANCE.research.timer.maxWeeks);
    expect(BALANCE.interrupts.lateEra).toBeGreaterThanOrEqual(1);
    expect(BALANCE.interrupts.lateEra).toBeLessThanOrEqual(ERA_COUNT);
    // the late gap tightens, it never widens (the documented intent)
    expect(BALANCE.interrupts.minGapWeeksLate).toBeLessThanOrEqual(BALANCE.interrupts.minGapWeeks);
    expect(BALANCE.competitors.arc.phaseWeeksMin).toBeLessThanOrEqual(BALANCE.competitors.arc.phaseWeeksMax);
  });
});

describe("economy rails", () => {
  it("production-run bounds are ordered and positive", () => {
    const b = BALANCE.build;
    expect(b.minRun).toBeGreaterThan(0);
    expect(b.minRun).toBeLessThanOrEqual(b.defaultRun);
    expect(b.defaultRun).toBeLessThanOrEqual(b.maxRun);
    expect(b.toolingUnits).toBeGreaterThan(0);
    expect(b.minTooling).toBeGreaterThan(0);
  });

  it("facilities ladder ascends in tier, capacity, rent and cost", () => {
    const f = BALANCE.facilities;
    f.forEach((tier, i) => expect(tier.tier).toBe(i + 1));
    for (let i = 1; i < f.length; i++) {
      expect(f[i].staffCapacity).toBeGreaterThan(f[i - 1].staffCapacity);
      expect(f[i].weeklyRent).toBeGreaterThanOrEqual(f[i - 1].weeklyRent);
      expect(f[i].upgradeCost).toBeGreaterThanOrEqual(f[i - 1].upgradeCost);
    }
  });

  it("eureka's chase brackets the banked payout (fizzle < 1 < jackpot)", () => {
    const e = BALANCE.research.eureka;
    expect(e.fizzleMult).toBeGreaterThan(0);
    expect(e.fizzleMult).toBeLessThan(1);
    expect(e.jackpotMult).toBeGreaterThan(1);
    expect(e.bankRpBase).toBeGreaterThan(0);
  });

  it("IPO stake rules never sell majority control in one go", () => {
    const i = BALANCE.ipo;
    expect(i.defaultStake).toBeGreaterThan(0);
    expect(i.defaultStake).toBeLessThanOrEqual(i.maxStakePerSale);
    expect(i.maxStakePerSale).toBeLessThan(0.5);
    expect(i.minEra).toBeGreaterThanOrEqual(1);
    expect(i.minEra).toBeLessThanOrEqual(ERA_COUNT);
    expect(i.minReputation).toBeLessThanOrEqual(BALANCE.reputation.max);
    expect(i.shareholders.maxOwnership).toBeLessThanOrEqual(1);
  });

  it("harvest settles at a discount to the tail it replaces (never free money)", () => {
    expect(BALANCE.liveOps.harvestSettlementFrac).toBeGreaterThan(0);
    expect(BALANCE.liveOps.harvestSettlementFrac).toBeLessThan(1);
  });

  it("valuation momentum is a bounded, mean-reverting overlay", () => {
    const v = BALANCE.valuationMomentum;
    expect(v.cap).toBeGreaterThan(0);
    expect(v.cap).toBeLessThan(1);
    for (const pop of [v.popOnHit, v.popOnSolid, v.dipOnFlop, v.rankOnePremiumFloor]) {
      expect(pop).toBeGreaterThanOrEqual(0);
      expect(pop).toBeLessThanOrEqual(v.cap);
    }
  });
});

describe("reputation rails (structure only — bands/margins are guarded in balanceGuards)", () => {
  it("reputation bounds are ordered and the per-era floor eases as the company grows", () => {
    const r = BALANCE.reputation;
    expect(r.min).toBeLessThan(r.max);
    for (const floor of r.minByEra) {
      expect(floor).toBeGreaterThanOrEqual(r.min);
      expect(floor).toBeLessThan(r.max);
    }
    for (let i = 1; i < r.minByEra.length; i++) {
      expect(r.minByEra[i]).toBeLessThanOrEqual(r.minByEra[i - 1]);
    }
    expect(BALANCE.startingReputation).toBeGreaterThanOrEqual(r.min);
    expect(BALANCE.startingReputation).toBeLessThanOrEqual(r.max);
    expect(r.decayFloor).toBeGreaterThanOrEqual(r.min);
    expect(r.decayFromEra).toBeGreaterThanOrEqual(1);
    expect(r.decayFromEra).toBeLessThanOrEqual(ERA_COUNT);
  });

  it("verdict gains/losses have the signs the reputation loop assumes", () => {
    const r = BALANCE.reputation;
    expect(r.gainPerHit).toBeGreaterThan(r.gainPerSolid);
    expect(r.gainPerSolid).toBeGreaterThan(0);
    expect(r.lossPerFlop).toBeGreaterThan(0);
  });
});

describe("era modifiers", () => {
  it("eras 1–2 are exactly neutral (the documented byte-identical early game)", () => {
    for (const m of BALANCE.eraModifiers.slice(0, 2)) {
      expect(m.marketingHype).toBe(1);
      expect(m.ecosystemRate).toBe(1);
      expect(m.demandVariance).toBe(1);
      expect(m.toolingMult).toBe(1);
      expect(m.leadWeeks).toBe(0);
    }
  });

  it("all modifiers are positive multipliers; lead weeks are non-negative integers", () => {
    for (const m of BALANCE.eraModifiers) {
      for (const mult of [m.marketingHype, m.ecosystemRate, m.demandVariance, m.toolingMult]) {
        expect(mult).toBeGreaterThan(0);
      }
      expect(Number.isInteger(m.leadWeeks)).toBe(true);
      expect(m.leadWeeks).toBeGreaterThanOrEqual(0);
    }
  });
});
