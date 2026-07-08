// Rolling contract board — a small set of LIVE, regenerating goals that give the post-tutorial and
// endgame a DIRECTED chase. The objectives ladder (engine/objectives.ts) is a finite onboarding spine
// that ends at "reach-pinnacle" and then leaves the player in undirected free play; the awards are
// passive; the side-orders are factory work. This fills the gap with 2–3 always-live goals that each
// pay a cash/rep/fans reward on completion and regenerate when claimed or expired.
//
// PURE: a deterministic generator (hash of seed + a salt, NEVER the main sim RNG) + a pure evaluator.
// Sim-safe by construction: the reward is CLAIMED by the player (the pinned auto-player never claims),
// generation/pruning never touch cash or the RNG stream, and the board only exists once the player has
// shipped — so a do-nothing sim run keeps an empty board and stays byte-identical. Mirrors the derived
// deterministic streams already used for side-orders / reviews / poaching.
import { dollars, formatShortDollars, type Money } from "./money.ts";

/** What a contract measures — all read from state the engine already tracks. */
export type ContractMetric = "revenue" | "fans" | "ships" | "hits" | "rank";

export interface ContractReward {
  cash: Money;
  rep: number;
  fans: number;
}

/** An active contract on the board. `baseline` is the metric value at generation, so progress can be
 *  shown as a delta ("$X of $Y earned") instead of an absolute that starts near-complete. */
export interface Contract {
  id: string;
  metric: ContractMetric;
  title: string;
  blurb: string;
  baseline: number;
  target: number; // reach >= target (or, for rank, <= target)
  reward: ContractReward;
  startedWeek: number;
  expiresWeek: number;
}

/** Read-only snapshot a contract evaluator needs — money in DOLLARS. */
export interface ContractFacts {
  revenue: number; // cumulative revenue, dollars
  fans: number;
  ships: number; // products launched
  hits: number;
  rank: number; // industry rank, 1 = best
  week: number;
}

export const CONTRACT_BOARD_SIZE = 3; // live contracts at once
export const CONTRACT_LIFE_WEEKS = 40; // a generous deadline — achievable, but the board still churns

/** Deterministic hash → [0,1), keyed off (seed, salt). Same recipe as the other derived streams, so
 *  the MAIN sim RNG stream is never drawn (determinism preserved). */
function hash01(seed: number, salt: number): number {
  let h = ((seed >>> 0) ^ Math.imul((salt + 1) >>> 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function contractValue(f: ContractFacts, metric: ContractMetric): number {
  switch (metric) {
    case "revenue": return f.revenue;
    case "fans": return f.fans;
    case "ships": return f.ships;
    case "hits": return f.hits;
    case "rank": return f.rank;
  }
}

/** Is the contract satisfied? Rank counts DOWN (lower is better); everything else counts up. Pure. */
export function contractDone(c: Contract, f: ContractFacts): boolean {
  if (c.metric === "rank") return f.rank <= c.target;
  return contractValue(f, c.metric) >= c.target;
}

export interface ContractProgress {
  current: number;
  target: number;
  done: boolean;
  frac: number; // 0..1 delta progress from baseline → target
}

export function contractProgress(c: Contract, f: ContractFacts): ContractProgress {
  const current = contractValue(f, c.metric);
  const done = contractDone(c, f);
  let frac: number;
  if (c.metric === "rank") {
    const span = c.baseline - c.target; // > 0 (climbing)
    frac = span > 0 ? Math.max(0, Math.min(1, (c.baseline - current) / span)) : done ? 1 : 0;
  } else {
    const span = c.target - c.baseline;
    frac = span > 0 ? Math.max(0, Math.min(1, (current - c.baseline) / span)) : done ? 1 : 0;
  }
  return { current, target: c.target, done, frac: done ? 1 : frac };
}

/** A short "+$X · +Y rep · +Z fans" summary of a reward (non-zero parts only). Pure. */
export function rewardSummary(r: ContractReward): string {
  const parts: string[] = [];
  if (r.cash > 0) parts.push(`+${formatShortDollars(r.cash / 100)}`);
  if (r.rep > 0) parts.push(`+${r.rep} rep`);
  if (r.fans > 0) parts.push(`+${r.fans.toLocaleString()} fans`);
  return parts.join(" · ");
}

const eraScale = (era: number) => 1 + (Math.max(1, Math.min(4, era)) - 1) * 0.85;

/**
 * Instantiate a fresh contract relative to the player's CURRENT standing, deterministically from a
 * salt (a monotonic counter kept in state). The target is always ahead of `facts`, so a contract is
 * never trivially pre-satisfied; rewards scale with the era so they stay relevant late-game.
 */
export function generateContract(seed: number, salt: number, era: number, f: ContractFacts): Contract {
  const es = eraScale(era);
  const id = `ct-${salt}`;
  const startedWeek = f.week;
  const expiresWeek = f.week + CONTRACT_LIFE_WEEKS;
  // `rank` is only offered when there's room to climb; otherwise the pool is the four count-up goals.
  const pool: ContractMetric[] = f.rank > 1
    ? ["revenue", "fans", "ships", "hits", "rank"]
    : ["revenue", "fans", "ships", "hits"];
  const metric = pool[Math.floor(hash01(seed, salt * 7 + 3) * pool.length) % pool.length];

  switch (metric) {
    case "revenue": {
      const delta = Math.round((150_000 + hash01(seed, salt * 7 + 5) * 250_000) * es / 10_000) * 10_000;
      return { id, metric, title: `Earn ${formatShortDollars(delta)} in revenue`, blurb: "A sales sprint — bank the revenue.",
        baseline: Math.round(f.revenue), target: Math.round(f.revenue) + delta,
        reward: { cash: dollars(Math.round(delta * 0.12)), rep: 2, fans: 0 }, startedWeek, expiresWeek };
    }
    case "fans": {
      const delta = Math.round((4_000 + hash01(seed, salt * 7 + 5) * 8_000) * es / 500) * 500;
      return { id, metric, title: `Win ${delta.toLocaleString()} new fans`, blurb: "Grow the audience.",
        baseline: f.fans, target: f.fans + delta,
        reward: { cash: dollars(0), rep: 2, fans: Math.round(delta * 0.25) }, startedWeek, expiresWeek };
    }
    case "ships": {
      const k = 2 + Math.floor(hash01(seed, salt * 7 + 5) * 2); // 2..3
      return { id, metric, title: `Ship ${k} more products`, blurb: "Keep the pipeline moving.",
        baseline: f.ships, target: f.ships + k,
        reward: { cash: dollars(Math.round(40_000 * es)), rep: 1, fans: 0 }, startedWeek, expiresWeek };
    }
    case "hits": {
      return { id, metric, title: "Land a hit product", blurb: "Nail the market and the price.",
        baseline: f.hits, target: f.hits + 1,
        reward: { cash: dollars(0), rep: 3, fans: Math.round(2_000 * es) }, startedWeek, expiresWeek };
    }
    case "rank": {
      const target = Math.max(1, f.rank - 1);
      return { id, metric, title: target === 1 ? "Become the #1 company" : `Reach industry rank #${target}`, blurb: "Climb the leaderboard.",
        baseline: f.rank, target,
        reward: { cash: dollars(0), rep: 4, fans: Math.round(3_000 * es) }, startedWeek, expiresWeek };
    }
  }
}
