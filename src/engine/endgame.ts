// Legacy Era (item 4.1) — the post-IPO endgame. Once a company has "gone public" (reached the
// pinnacle), instead of only offering the New Game+ reset, the board keeps setting the bar: recurring
// MANDATES (quarterly directives with a cash/reputation payoff) and moonshot MEGAPROJECTS (huge
// cash+RP sinks that pay off in permanent prestige). Gives the richest phase of the game real things
// to chase. PURE + sim-safe: everything is gated behind wentPublic (the pinned solo sim never IPOs),
// and mandates use a DERIVED hash of (seed, quarter) — never the main sim RNG (salt 263).
import { BALANCE } from "./balance.ts";
import { dollars, scale, toDollars, type Money } from "./money.ts";

// ---- Megaprojects: moonshot investments with prestige-tier payoffs -------------------------------

export interface MegaprojectReward {
  /** Permanent reputation added on completion. */
  reputation?: number;
  /** Permanent fan multiplier (1.1 = +10% of current fans, kept). */
  fansMult?: number;
  /** Legacy Points banked toward the prestige meta (item 4.3 will spend them; here we just accrue). */
  legacyPoints?: number;
  blurb: string;
}

export interface Megaproject {
  id: string;
  name: string;
  blurb: string;
  cashCost: Money;
  rpCost: number;
  reward: MegaprojectReward;
}

// A small, ordered slate of moonshots — each a bigger bet than the last. Costs scale hard so the
// Legacy Era is a genuine long-horizon sink, not a shopping trip. IP-clean fictional names.
export const MEGAPROJECTS: readonly Megaproject[] = [
  {
    id: "quantumFab",
    name: "Quantum Fab",
    blurb: "A next-generation fabrication plant that redefines what a device can be.",
    cashCost: dollars(250_000_000) as Money,
    rpCost: 800,
    reward: { reputation: 3, legacyPoints: 2, blurb: "+3 reputation · +2 Legacy Points" },
  },
  {
    id: "neuralOs",
    name: "Neural OS Initiative",
    blurb: "A self-improving operating system that learns each user — the industry follows.",
    cashCost: dollars(600_000_000) as Money,
    rpCost: 1400,
    reward: { reputation: 4, fansMult: 1.15, legacyPoints: 3, blurb: "+4 reputation · +15% fans · +3 Legacy Points" },
  },
  {
    id: "orbitalGrid",
    name: "Orbital Compute Grid",
    blurb: "Datacenters in orbit — limitless compute, and a story no rival can match.",
    cashCost: dollars(1_500_000_000) as Money,
    rpCost: 2200,
    reward: { reputation: 5, fansMult: 1.2, legacyPoints: 5, blurb: "+5 reputation · +20% fans · +5 Legacy Points" },
  },
  {
    id: "fusionCampus",
    name: "Fusion Research Campus",
    blurb: "Power the whole company — and the region — on a private fusion reactor.",
    cashCost: dollars(4_000_000_000) as Money,
    rpCost: 3200,
    reward: { reputation: 6, fansMult: 1.25, legacyPoints: 8, blurb: "+6 reputation · +25% fans · +8 Legacy Points" },
  },
];

export function megaprojectById(id: string): Megaproject | undefined {
  return MEGAPROJECTS.find((m) => m.id === id);
}

/** The megaprojects not yet funded, in order — the live slate the endgame HQ shows. */
export function availableMegaprojects(funded: readonly string[]): Megaproject[] {
  const done = new Set(funded);
  return MEGAPROJECTS.filter((m) => !done.has(m.id));
}

/** Can the company afford this moonshot right now (cash AND research points)? */
export function canFundMegaproject(mp: Megaproject, cash: Money, researchPoints: number): boolean {
  return cash >= mp.cashCost && researchPoints >= mp.rpCost;
}

// ---- Board mandates: recurring quarterly directives with a payoff --------------------------------

export type MandateMetric = "revenue" | "hits" | "fans" | "rank";

export interface BoardMandate {
  id: string;
  quarter: number;
  metric: MandateMetric;
  target: number;   // revenue in DOLLARS · hits count · fans count · rank (≤ target)
  title: string;
  reward: { cash: Money; rep: number };
  issuedWeek: number;
  dueWeek: number;
}

/** The facts a mandate is judged against — a small read of the live company. */
export interface MandateFacts {
  quarterRevenue: number; // DOLLARS earned since the mandate was issued
  quarterHits: number;    // hit launches since issued
  fans: number;
  rank: number;           // industry rank (1 = best)
}

/** Tiny deterministic hash → [0,1), keyed off (seed, quarter, salt 263) — never the sim RNG. */
function hash01(seed: number, quarter: number, salt: number): number {
  let h = (seed ^ Math.imul(quarter + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const MANDATE_METRICS: readonly MandateMetric[] = ["revenue", "hits", "fans", "rank"];

/** Generate the board's directive for a quarter — a metric + target scaled to the era and reward.
 *  Deterministic (derived hash), so the same seed+quarter always issues the same mandate. */
export function generateBoardMandate(seed: number, quarter: number, week: number, currentFans: number): BoardMandate {
  const c = BALANCE.legacyEra.mandate;
  const metric = MANDATE_METRICS[Math.floor(hash01(seed, quarter, 263) * MANDATE_METRICS.length) % MANDATE_METRICS.length];
  const rung = 1 + quarter * c.escalationPerQuarter; // the bar rises each quarter
  let target: number;
  let title: string;
  switch (metric) {
    case "revenue":
      target = Math.round(c.baseRevenue * rung / 1e6) * 1e6;
      title = `Post $${Math.round(target / 1e6)}M in revenue this quarter`;
      break;
    case "hits":
      target = 1 + Math.floor(quarter / 2);
      title = `Land ${target} hit launch${target > 1 ? "es" : ""} this quarter`;
      break;
    case "fans":
      target = Math.round((currentFans * (1 + c.fansGrowthTarget) + c.fansFloor) / 1000) * 1000;
      title = `Grow the fanbase to ${target.toLocaleString()}`;
      break;
    default: // rank
      target = 1;
      title = "Hold the #1 spot in the industry";
      break;
  }
  const reward = {
    cash: scale(dollars(c.baseReward), rung) as Money,
    rep: c.repReward,
  };
  return { id: `mandate-q${quarter}`, quarter, metric, target, title, reward, issuedWeek: week, dueWeek: week + c.windowWeeks };
}

/** 0..1 progress toward a mandate (rank is met/not-met, so 0 or 1). */
export function mandateProgress(m: BoardMandate, f: MandateFacts): number {
  switch (m.metric) {
    case "revenue": return Math.max(0, Math.min(1, f.quarterRevenue / m.target));
    case "hits": return Math.max(0, Math.min(1, f.quarterHits / m.target));
    case "fans": return Math.max(0, Math.min(1, f.fans / m.target));
    default: return f.rank <= m.target ? 1 : 0;
  }
}

/** Whether the mandate's target is met. */
export function mandateComplete(m: BoardMandate, f: MandateFacts): boolean {
  switch (m.metric) {
    case "revenue": return f.quarterRevenue >= m.target;
    case "hits": return f.quarterHits >= m.target;
    case "fans": return f.fans >= m.target;
    default: return f.rank <= m.target;
  }
}

/** A short human summary of a mandate reward (for the feed / HQ card). */
export function mandateRewardSummary(m: BoardMandate): string {
  return `$${Math.round(toDollars(m.reward.cash) / 1e6)}M + ${m.reward.rep} reputation`;
}
