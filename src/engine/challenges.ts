// Daily / weekly challenges — date-seeded, fully offline (no backend, no leaderboard server).
// PURE: deterministic generation + a score evaluator. The state layer applies a challenge as a
// flavored run and records a personal best per date; this module owns only the "what is today's
// challenge?" mapping, so every offline player who opens the app on the same date gets the IDENTICAL
// challenge (the Mini Motorways model, server stripped — see RETENTION_ROADMAP Wave 2).
//
// A challenge = a freeform start + a date-seeded set of MUTATORS (start-condition twists) + a scored
// goal ("highest <metric> by week N"). One attempt, result locked locally (enforced by the state
// layer). Mutators here are START overrides (cash/reputation/fans), which the existing newGame path
// can apply with zero sim changes; deeper sim-level mutators (no-marketing, fixed-price, recession)
// are a documented future extension that lands with the BALANCE-override plumbing.
import { makeRng } from "./rng.ts";
import type { ScenarioMetric } from "./scenarios.ts";

export interface Mutator {
  id: string;
  name: string;
  /** One premium line describing the twist. */
  description: string;
  /** Multiply the freeform starting cash (1 = unchanged). */
  cashMult?: number;
  /** Override the starting reputation. */
  reputation?: number;
  /** Override the starting fan count. */
  fans?: number;
}

/** Catalog of start-condition mutators (the ones expressible without sim changes). */
export const MUTATORS: readonly Mutator[] = [
  { id: "lean", name: "Lean Start", description: "Begin with half the usual capital.", cashMult: 0.5 },
  { id: "shoestring", name: "Shoestring", description: "A third of the usual capital — every dollar counts.", cashMult: 0.34 },
  { id: "warchest", name: "War Chest", description: "Triple starting capital — spend it wisely.", cashMult: 3 },
  { id: "bruised", name: "Bruised Brand", description: "Start with a damaged reputation to rebuild.", reputation: 6 },
  { id: "renowned", name: "Renowned", description: "Start with a strong reputation — but the bar is high.", reputation: 55 },
  { id: "unknown", name: "Total Unknown", description: "No fans, no recognition — earn every one.", fans: 0 },
  { id: "cult", name: "Cult Following", description: "Begin with a devoted fanbase already in your corner.", fans: 25_000 },
  { id: "frugal", name: "Frugal Founder", description: "Modest capital and a quiet brand. Prove the model.", cashMult: 0.6, reputation: 12, fans: 0 },
] as const;

export function mutatorById(id: string): Mutator | undefined {
  return MUTATORS.find((m) => m.id === id);
}

export type ChallengeKind = "daily" | "weekly";

export interface Challenge {
  kind: ChallengeKind;
  /** Anchor date key: the day (daily) or that week's Monday (weekly), as YYYY-MM-DD (UTC). */
  dateKey: string;
  /** Deterministic RNG seed for the run — everyone playing this challenge gets the same market. */
  seed: number;
  /** Selected mutators (1 for daily, 2–3 for weekly). */
  mutators: Mutator[];
  /** The scored measurable and the week it's measured at. Highest value wins (personal best). */
  scoreMetric: ScenarioMetric;
  scoreWeek: number;
}

/** YYYY-MM-DD in UTC for a Date (timezone-stable so the "same day" is global). */
export function dateKeyOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The Monday (UTC) of the week containing the given YYYY-MM-DD, as a YYYY-MM-DD key. */
export function mondayOf(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const delta = (dow + 6) % 7; // days since Monday
  dt.setUTCDate(dt.getUTCDate() - delta);
  return dateKeyOf(dt);
}

/** Stable string hash → unsigned 32-bit seed (FNV-1a). */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick `count` DISTINCT mutators deterministically from the catalog. */
function pickMutators(rng: ReturnType<typeof makeRng>, count: number): Mutator[] {
  const pool = [...MUTATORS];
  const out: Mutator[] = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    const idx = rng.int(pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

const SCORE_METRICS: ScenarioMetric[] = ["netWorth", "cumulativeRevenue", "fans"];

/** The daily challenge for a given date (deterministic — same date → same challenge everywhere). */
export function dailyChallenge(dateKey: string): Challenge {
  const rng = makeRng(hashSeed(`daily:${dateKey}`));
  const seed = (rng.next() * 2 ** 31) >>> 0;
  const mutators = pickMutators(rng, 1);
  const scoreMetric = SCORE_METRICS[rng.int(SCORE_METRICS.length)];
  return { kind: "daily", dateKey, seed, mutators, scoreMetric, scoreWeek: 52 };
}

/** The weekly challenge for the week containing the given date (Monday-anchored, harder stack). */
export function weeklyChallenge(dateKey: string): Challenge {
  const anchor = mondayOf(dateKey);
  const rng = makeRng(hashSeed(`weekly:${anchor}`));
  const seed = (rng.next() * 2 ** 31) >>> 0;
  const mutators = pickMutators(rng, 2 + rng.int(2)); // 2 or 3
  const scoreMetric = SCORE_METRICS[rng.int(SCORE_METRICS.length)];
  return { kind: "weekly", dateKey: anchor, seed, mutators, scoreMetric, scoreWeek: 104 };
}
