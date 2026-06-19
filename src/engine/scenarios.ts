// Scenarios — hand-authored start conditions + tiered (1–3★) win conditions over the SAME engine.
// PURE: data catalog + a pure evaluator. No React/DOM. The state layer applies `setup` on top of
// newGame() and runs `evaluateScenario` in the tick; this module never mutates anything.
//
// Philosophy (matches achievements.ts + the premium mandate): every objective reads ONLY from data
// the engine already tracks (cumulativeRevenue, reputation, fans, net worth, launched[], era, week).
// We never invent state. Stars are mastery, not time-gates: 1★ is the win, 2★/3★ are harder stretch
// targets the player chooses to chase — the Two Point Hospital model, server-free and offline.
import type { GameState } from "../state/gameState.ts";
import { netWorth } from "../state/gameState.ts";
import { dollars, toDollars, type Money } from "./money.ts";

/** A measurable the engine already tracks. Money metrics are compared in DOLLARS (not cents). */
export type ScenarioMetric =
  | "cumulativeRevenue" // dollars, lifetime
  | "netWorth" // dollars (cash + rival portfolio + own stake)
  | "reputation" // 0..100
  | "fans"
  | "productsShipped" // lifetime launches
  | "hits" // launches with a "hit" verdict
  | "era"; // current tech era

/** A single ">= target" goal. `target` is in the metric's natural unit (dollars for money). */
export interface Objective {
  metric: ScenarioMetric;
  target: number;
  /** Premium, human-readable copy — shown in the objective tracker. No raw thresholds nagging. */
  label: string;
}

/** One star tier. ALL objectives must be met (AND) to earn this tier's stars. */
export interface ScenarioTier {
  stars: 1 | 2 | 3;
  objectives: Objective[];
}

/** Overrides applied on top of newGame() when a scenario run starts. All optional + additive, so a
 *  scenario with an empty setup plays exactly like a normal new game. Kept to the fields that vary a
 *  start WITHOUT touching protected engine init (rival/trend overrides are a later, separate pass). */
export interface ScenarioSetup {
  era?: number;
  cash?: Money;
  reputation?: number;
  fans?: number;
}

export interface Scenario {
  id: string;
  name: string;
  /** One premium line shown on the picker card. */
  tagline: string;
  /** The situation / fantasy — sets up why this start is interesting. */
  description: string;
  difficulty: "intro" | "standard" | "hard" | "expert";
  setup: ScenarioSetup;
  /** Optional time limit: if the 1★ goal isn't met on or before this week, the run is a loss. */
  deadlineWeek?: number;
  /** [1★, 2★, 3★] — each tier should be strictly harder than the last (pinned by a property test). */
  tiers: [ScenarioTier, ScenarioTier, ScenarioTier];
}

/** Read-only snapshot a scenario evaluator needs. Plain numbers so tests need no full GameState. */
export interface ScenarioFacts {
  cumulativeRevenue: number; // dollars
  netWorth: number; // dollars
  reputation: number;
  fans: number;
  productsShipped: number;
  hits: number;
  era: number;
  week: number;
}

/** Per-objective progress for the UI tracker. */
export interface ObjectiveProgress {
  tier: 1 | 2 | 3;
  objective: Objective;
  current: number;
  met: boolean;
}

export interface ScenarioResult {
  /** Highest fully-met tier (0 = not won yet). Robust to non-monotonic authoring (takes the max). */
  stars: 0 | 1 | 2 | 3;
  won: boolean; // stars >= 1
  failed: boolean; // a deadline passed without reaching 1★
  objectives: ObjectiveProgress[];
}

/** Derive the (read-only) facts a scenario evaluator needs from a full GameState. Pure adapter. */
export function deriveScenarioFacts(state: GameState): ScenarioFacts {
  const hits = state.launched.filter((lp) => lp.verdict === "hit").length;
  return {
    cumulativeRevenue: toDollars(state.cumulativeRevenue),
    netWorth: toDollars(netWorth(state)),
    reputation: state.reputation,
    fans: state.fans,
    productsShipped: state.launched.length,
    hits,
    era: state.era,
    week: state.week,
  };
}

/** Current value of a metric from the facts snapshot. */
export function metricValue(facts: ScenarioFacts, metric: ScenarioMetric): number {
  switch (metric) {
    case "cumulativeRevenue": return facts.cumulativeRevenue;
    case "netWorth": return facts.netWorth;
    case "reputation": return facts.reputation;
    case "fans": return facts.fans;
    case "productsShipped": return facts.productsShipped;
    case "hits": return facts.hits;
    case "era": return facts.era;
  }
}

export function objectiveMet(facts: ScenarioFacts, obj: Objective): boolean {
  return metricValue(facts, obj.metric) >= obj.target;
}

/** A tier is earned only when EVERY one of its objectives is met. */
export function tierMet(facts: ScenarioFacts, tier: ScenarioTier): boolean {
  return tier.objectives.every((o) => objectiveMet(facts, o));
}

/** Evaluate a scenario against a facts snapshot. Pure — returns stars, win/fail, and per-objective
 *  progress for the tracker UI. Stars = the highest tier with ALL objectives met. */
export function evaluateScenario(scenario: Scenario, facts: ScenarioFacts): ScenarioResult {
  let stars: 0 | 1 | 2 | 3 = 0;
  const objectives: ObjectiveProgress[] = [];
  for (const tier of scenario.tiers) {
    if (tierMet(facts, tier)) stars = Math.max(stars, tier.stars) as 0 | 1 | 2 | 3;
    for (const objective of tier.objectives) {
      objectives.push({
        tier: tier.stars,
        objective,
        current: metricValue(facts, objective.metric),
        met: objectiveMet(facts, objective),
      });
    }
  }
  const won = stars >= 1;
  const failed = !won && scenario.deadlineWeek != null && facts.week > scenario.deadlineWeek;
  return { stars, won, failed, objectives };
}

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------------------------
// Catalog — single source of truth for scenario content. Spans the difficulty curve.
// Targets are grounded in real balance thresholds (era gates: 35 rep / $500K to leave the Garage
// Era; 60 / $8M for Growth; 80 / $80M for Platform). Each tier is strictly harder than the last.
// ---------------------------------------------------------------------------------------------
export const SCENARIOS: readonly Scenario[] = [
  {
    id: "first-light",
    name: "First Light",
    tagline: "Found a company and ship your first hits.",
    description:
      "A clean garage start. Learn the loop — design, build, time the market, launch — and turn a " +
      "few good products into real revenue.",
    difficulty: "intro",
    setup: {},
    tiers: [
      { stars: 1, objectives: [{ metric: "cumulativeRevenue", target: 250_000, label: "Earn $250K in lifetime revenue" }] },
      { stars: 2, objectives: [
        { metric: "cumulativeRevenue", target: 1_000_000, label: "Earn $1M in lifetime revenue" },
        { metric: "reputation", target: 45, label: "Reach 45 reputation" },
      ] },
      { stars: 3, objectives: [
        { metric: "cumulativeRevenue", target: 2_500_000, label: "Earn $2.5M in lifetime revenue" },
        { metric: "hits", target: 3, label: "Ship 3 hit products" },
      ] },
    ],
  },
  {
    id: "bootstrapped",
    name: "Bootstrapped",
    tagline: "No investors. Half the runway. Make it work.",
    description:
      "You turned down the cheque. Starting capital is tight, so every build is a real bet — grow a " +
      "profitable company on conviction alone.",
    difficulty: "standard",
    setup: { cash: dollars(12_000) },
    tiers: [
      { stars: 1, objectives: [{ metric: "netWorth", target: 500_000, label: "Reach $500K net worth" }] },
      { stars: 2, objectives: [{ metric: "netWorth", target: 2_000_000, label: "Reach $2M net worth" }] },
      { stars: 3, objectives: [
        { metric: "netWorth", target: 5_000_000, label: "Reach $5M net worth" },
        { metric: "fans", target: 50_000, label: "Build a following of 50,000 fans" },
      ] },
    ],
  },
  {
    id: "head-start",
    name: "Head Start",
    tagline: "An established brand in the Growth Era. Push for the platform.",
    description:
      "You begin mid-journey: a funded company with a reputation to defend. Skip the garage and play " +
      "the scaling game — reach the Platform Era and beyond.",
    difficulty: "standard",
    setup: { era: 2, cash: dollars(2_000_000), reputation: 55, fans: 40_000 },
    tiers: [
      { stars: 1, objectives: [{ metric: "era", target: 3, label: "Reach the Platform Era" }] },
      { stars: 2, objectives: [
        { metric: "era", target: 4, label: "Reach the AI Era" },
        { metric: "cumulativeRevenue", target: 50_000_000, label: "Earn $50M in lifetime revenue" },
      ] },
      { stars: 3, objectives: [
        { metric: "era", target: 4, label: "Reach the AI Era" },
        { metric: "reputation", target: 80, label: "Reach 80 reputation" },
        { metric: "cumulativeRevenue", target: 150_000_000, label: "Earn $150M in lifetime revenue" },
      ] },
    ],
  },
  {
    id: "underdog",
    name: "Underdog",
    tagline: "Low cash, low trust, a ticking clock. Prove them wrong.",
    description:
      "Nobody believes in you yet. Start lean with a bruised reputation and a hard deadline — race to " +
      "your first million before the runway runs out.",
    difficulty: "hard",
    setup: { cash: dollars(10_000), reputation: 10 },
    deadlineWeek: 78, // ~1.5 years
    tiers: [
      { stars: 1, objectives: [{ metric: "cumulativeRevenue", target: 1_000_000, label: "Earn $1M in lifetime revenue by week 78" }] },
      { stars: 2, objectives: [
        { metric: "cumulativeRevenue", target: 1_000_000, label: "Earn $1M in lifetime revenue by week 78" },
        { metric: "reputation", target: 50, label: "Recover to 50 reputation" },
      ] },
      { stars: 3, objectives: [
        { metric: "cumulativeRevenue", target: 3_000_000, label: "Earn $3M in lifetime revenue by week 78" },
        { metric: "reputation", target: 60, label: "Recover to 60 reputation" },
      ] },
    ],
  },
  {
    id: "long-game",
    name: "The Long Game",
    tagline: "No shortcuts. Build a respected industry leader.",
    description:
      "Patience over hype. A standard start, but the goal is mastery of the full arc — reach the final " +
      "era with a reputation that lasts.",
    difficulty: "hard",
    setup: {},
    tiers: [
      { stars: 1, objectives: [{ metric: "era", target: 4, label: "Reach the AI Era" }] },
      { stars: 2, objectives: [
        { metric: "era", target: 4, label: "Reach the AI Era" },
        { metric: "reputation", target: 80, label: "Reach 80 reputation" },
      ] },
      { stars: 3, objectives: [
        { metric: "era", target: 4, label: "Reach the AI Era" },
        { metric: "reputation", target: 90, label: "Reach 90 reputation" },
        { metric: "fans", target: 500_000, label: "Build a following of 500,000 fans" },
      ] },
    ],
  },
  {
    id: "empire",
    name: "Empire",
    tagline: "A giant already. Now leave a legacy.",
    description:
      "You command a Platform-Era powerhouse. The only thing left is dominance — colossal revenue, " +
      "an iconic brand, the biggest company in the industry.",
    difficulty: "expert",
    setup: { era: 3, cash: dollars(20_000_000), reputation: 70, fans: 200_000 },
    tiers: [
      { stars: 1, objectives: [{ metric: "cumulativeRevenue", target: 100_000_000, label: "Earn $100M in lifetime revenue" }] },
      { stars: 2, objectives: [
        { metric: "cumulativeRevenue", target: 250_000_000, label: "Earn $250M in lifetime revenue" },
        { metric: "reputation", target: 85, label: "Reach 85 reputation" },
      ] },
      { stars: 3, objectives: [
        { metric: "cumulativeRevenue", target: 500_000_000, label: "Earn $500M in lifetime revenue" },
        { metric: "reputation", target: 90, label: "Reach 90 reputation" },
        { metric: "fans", target: 1_000_000, label: "Build a following of 1,000,000 fans" },
      ] },
    ],
  },
];
