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
import { dollars, format } from "./money.ts";
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
  { id: "shoestring", name: "Shoestring", description: "A third of the usual capital, every dollar counts.", cashMult: 0.34 },
  { id: "warchest", name: "War Chest", description: "Triple starting capital, spend it wisely.", cashMult: 3 },
  { id: "bruised", name: "Bruised Brand", description: "Start with a damaged reputation to rebuild.", reputation: 6 },
  { id: "renowned", name: "Renowned", description: "Start with a strong reputation, but the bar is high.", reputation: 55 },
  { id: "unknown", name: "Total Unknown", description: "No fans, no recognition, earn every one.", fans: 0 },
  { id: "cult", name: "Cult Following", description: "Begin with a devoted fanbase already in your corner.", fans: 25_000 },
  { id: "frugal", name: "Frugal Founder", description: "Modest capital and a quiet brand. Prove the model.", cashMult: 0.6, reputation: 12, fans: 0 },
] as const;

export function mutatorById(id: string): Mutator | undefined {
  return MUTATORS.find((m) => m.id === id);
}

// ---------- Shareable challenge codes ----------
// A short, human-readable code that pins a specific daily/weekly challenge (which is fully
// date-seeded), so a friend can paste it and play the IDENTICAL run and compare scores — the
// offline community hook (no backend). Form: `ST-D-YYYYMMDD` (daily) / `ST-W-YYYYMMDD` (weekly).
const CODE_PREFIX = "ST";

export function encodeChallengeCode(kind: ChallengeKind, dateKey: string): string {
  return `${CODE_PREFIX}-${kind === "weekly" ? "W" : "D"}-${dateKey.replace(/-/g, "")}`;
}

export function decodeChallengeCode(code: string): { kind: ChallengeKind; dateKey: string } | null {
  if (typeof code !== "string") return null;
  const m = /^ST-([DW])-(\d{4})(\d{2})(\d{2})$/i.exec(code.trim());
  if (!m) return null;
  const mo = Number(m[3]);
  const d = Number(m[4]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  // Reject impossible calendar dates (e.g. 2026-02-30) — Date would silently roll them over to a
  // different day, resolving to a different challenge than the code implies.
  const y = Number(m[2]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  const dateKey = `${m[2]}-${m[3]}-${m[4]}`;
  const kind: ChallengeKind = m[1].toUpperCase() === "W" ? "weekly" : "daily";
  // Weekly challenges are Monday-anchored — normalize so any day in the week resolves identically.
  return kind === "weekly" ? { kind, dateKey: mondayOf(dateKey) } : { kind, dateKey };
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

const SCORE_METRIC_LABEL: Record<ScenarioMetric, string> = {
  netWorth: "net worth",
  cumulativeRevenue: "lifetime revenue",
  fans: "fans",
  reputation: "reputation",
  productsShipped: "products shipped",
  hits: "hit products",
  era: "era",
};

export function scoreMetricLabel(metric: ScenarioMetric): string {
  return SCORE_METRIC_LABEL[metric];
}

/** Format a score for display, by metric (money → $; fans → compact; else integer). Pure. */
export function formatScore(metric: ScenarioMetric, value: number): string {
  const v = Math.round(value);
  if (metric === "netWorth" || metric === "cumulativeRevenue") return format(dollars(v));
  if (metric === "fans") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  }
  return String(v);
}
