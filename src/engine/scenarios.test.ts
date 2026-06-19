import { describe, expect, it } from "vitest";
import {
  SCENARIOS,
  evaluateScenario,
  deriveScenarioFacts,
  metricValue,
  objectiveMet,
  tierMet,
  scenarioById,
  type Scenario,
  type ScenarioFacts,
  type ScenarioMetric,
} from "./scenarios.ts";
import { newGame } from "../state/gameState.ts";

/** A facts snapshot with nothing achieved. */
function zeroFacts(): ScenarioFacts {
  return {
    cumulativeRevenue: 0,
    netWorth: 0,
    reputation: 0,
    fans: 0,
    productsShipped: 0,
    hits: 0,
    era: 1,
    week: 0,
  };
}

const ALL_METRICS: ScenarioMetric[] = [
  "cumulativeRevenue", "netWorth", "reputation", "fans", "productsShipped", "hits", "era",
];

describe("scenario metric/objective primitives", () => {
  it("metricValue reads each metric from the facts snapshot", () => {
    const f: ScenarioFacts = { cumulativeRevenue: 1, netWorth: 2, reputation: 3, fans: 4, productsShipped: 5, hits: 6, era: 7, week: 8 };
    expect(metricValue(f, "cumulativeRevenue")).toBe(1);
    expect(metricValue(f, "netWorth")).toBe(2);
    expect(metricValue(f, "reputation")).toBe(3);
    expect(metricValue(f, "fans")).toBe(4);
    expect(metricValue(f, "productsShipped")).toBe(5);
    expect(metricValue(f, "hits")).toBe(6);
    expect(metricValue(f, "era")).toBe(7);
  });

  it("objectiveMet is a >= comparison (boundary inclusive)", () => {
    const f = { ...zeroFacts(), reputation: 50 };
    expect(objectiveMet(f, { metric: "reputation", target: 49, label: "" })).toBe(true);
    expect(objectiveMet(f, { metric: "reputation", target: 50, label: "" })).toBe(true); // inclusive
    expect(objectiveMet(f, { metric: "reputation", target: 51, label: "" })).toBe(false);
  });

  it("tierMet requires ALL objectives (AND)", () => {
    const tier = { stars: 1 as const, objectives: [
      { metric: "reputation" as ScenarioMetric, target: 50, label: "" },
      { metric: "fans" as ScenarioMetric, target: 1000, label: "" },
    ] };
    expect(tierMet({ ...zeroFacts(), reputation: 50, fans: 999 }, tier)).toBe(false);
    expect(tierMet({ ...zeroFacts(), reputation: 49, fans: 1000 }, tier)).toBe(false);
    expect(tierMet({ ...zeroFacts(), reputation: 50, fans: 1000 }, tier)).toBe(true);
  });
});

describe("evaluateScenario", () => {
  const scn: Scenario = {
    id: "t", name: "Test", tagline: "", description: "", difficulty: "standard", setup: {},
    deadlineWeek: 50,
    tiers: [
      { stars: 1, objectives: [{ metric: "cumulativeRevenue", target: 100, label: "" }] },
      { stars: 2, objectives: [{ metric: "cumulativeRevenue", target: 200, label: "" }] },
      { stars: 3, objectives: [{ metric: "cumulativeRevenue", target: 300, label: "" }] },
    ],
  };

  it("awards 0 stars and not-won at a fresh start", () => {
    const r = evaluateScenario(scn, zeroFacts());
    expect(r.stars).toBe(0);
    expect(r.won).toBe(false);
    expect(r.failed).toBe(false);
  });

  it("awards the highest fully-met tier", () => {
    expect(evaluateScenario(scn, { ...zeroFacts(), cumulativeRevenue: 100 }).stars).toBe(1);
    expect(evaluateScenario(scn, { ...zeroFacts(), cumulativeRevenue: 250 }).stars).toBe(2);
    expect(evaluateScenario(scn, { ...zeroFacts(), cumulativeRevenue: 999 }).stars).toBe(3);
    expect(evaluateScenario(scn, { ...zeroFacts(), cumulativeRevenue: 999 }).won).toBe(true);
  });

  it("fails only when the deadline passes WITHOUT reaching 1 star", () => {
    // past deadline, no win → failed
    expect(evaluateScenario(scn, { ...zeroFacts(), week: 51 }).failed).toBe(true);
    // past deadline but already won → not failed
    expect(evaluateScenario(scn, { ...zeroFacts(), week: 51, cumulativeRevenue: 100 }).failed).toBe(false);
    // before deadline, no win → not failed yet
    expect(evaluateScenario(scn, { ...zeroFacts(), week: 49 }).failed).toBe(false);
  });

  it("returns per-objective progress for every tier", () => {
    const r = evaluateScenario(scn, { ...zeroFacts(), cumulativeRevenue: 150 });
    expect(r.objectives).toHaveLength(3);
    expect(r.objectives[0]).toMatchObject({ tier: 1, current: 150, met: true });
    expect(r.objectives[1]).toMatchObject({ tier: 2, current: 150, met: false });
  });

  it("a scenario with no deadline never fails", () => {
    const noDeadline: Scenario = { ...scn, deadlineWeek: undefined };
    expect(evaluateScenario(noDeadline, { ...zeroFacts(), week: 9999 }).failed).toBe(false);
  });
});

describe("scenario catalog integrity", () => {
  it("has unique ids and scenarioById resolves them", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCENARIOS) expect(scenarioById(s.id)).toBe(s);
    expect(scenarioById("nope")).toBeUndefined();
  });

  it("every scenario has exactly 3 tiers, ordered 1/2/3, each with at least one objective", () => {
    for (const s of SCENARIOS) {
      expect(s.tiers.map((t) => t.stars)).toEqual([1, 2, 3]);
      for (const t of s.tiers) expect(t.objectives.length).toBeGreaterThan(0);
    }
  });

  // The make-or-break authoring guarantee: a higher star tier must never be EASIER than a lower one
  // for any shared metric (a 2★ you'd hit before 1★ would be nonsense). Mirrors staff.test.ts pins.
  it("tiers are monotonic: per-metric targets never decrease as stars rise", () => {
    for (const s of SCENARIOS) {
      for (const metric of ALL_METRICS) {
        const maxTargetPerTier = s.tiers.map((t) =>
          t.objectives.filter((o) => o.metric === metric).reduce((mx, o) => Math.max(mx, o.target), -Infinity),
        );
        // Compare only tiers that actually use this metric.
        const used = maxTargetPerTier.map((v, i) => ({ v, i })).filter((x) => x.v > -Infinity);
        for (let k = 1; k < used.length; k++) {
          expect(used[k].v).toBeGreaterThanOrEqual(used[k - 1].v);
        }
      }
    }
  });

  it("an empty-setup scenario plays from a normal start (no win at week 0)", () => {
    // deriveScenarioFacts over a fresh game should not satisfy any launch scenario's 1★ yet.
    const facts = deriveScenarioFacts(newGame(12345));
    for (const s of SCENARIOS) {
      expect(evaluateScenario(s, facts).won).toBe(false);
    }
  });
});

describe("deriveScenarioFacts", () => {
  it("reads lifetime metrics off a real GameState", () => {
    const g = newGame(999);
    const f = deriveScenarioFacts(g);
    expect(f.week).toBe(g.week);
    expect(f.era).toBe(g.era);
    expect(f.reputation).toBe(g.reputation);
    expect(f.fans).toBe(g.fans);
    expect(f.productsShipped).toBe(0);
    expect(f.hits).toBe(0);
    expect(f.cumulativeRevenue).toBe(0);
  });
});
