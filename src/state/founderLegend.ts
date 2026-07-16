// Founder Legend — a permanent, cross-run PRESTIGE ladder. Where legacyBonus grants raw power on New
// Game+, this grants IDENTITY: an endless title that climbs with your lifetime achievement across
// every company you've ever run, so there is always a next rung to grind toward long after a single
// empire is "finished". Profile-level (separate from the game save), native-mirrored, and part of the
// export/import backup, exactly like legacy / museum / scenario stars.
//
// Determinism: this lives entirely OUTSIDE the pure sim (a localStorage profile store read only by the
// UI + recorded from useGame side-effects), so it never touches the reproducibility pin.
import { mirrorToNative } from "./nativeStore.ts";

const KEY = "silicon.founder.v1";

/** A founder's lifetime record. Every field is a MAXIMUM or a terminal-event COUNT, so recording is
 *  idempotent — writing the same run's peak twice can never inflate it (no cumulative double-count). */
export interface FounderRecord {
  /** New Game+ foundings completed (a finished empire → the next one). */
  prestiges: number;
  /** Companies taken public (IPOs) across all runs. */
  ipos: number;
  /** The most hits (hit/solid launches) shipped in any single company. */
  bestHitsInRun: number;
  /** Highest company valuation ever reached, in whole dollars. */
  peakValuationDollars: number;
  /** Best (lowest) industry rank ever reached; 1 = #1. Large sentinel until you've ranked. */
  bestRank: number;
}

const EMPTY: FounderRecord = {
  prestiges: 0,
  ipos: 0,
  bestHitsInRun: 0,
  peakValuationDollars: 0,
  bestRank: 9999,
};

function sanitize(raw: unknown): FounderRecord {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const r = raw as Partial<Record<keyof FounderRecord, unknown>>;
  const num = (v: unknown, min: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min ? v : fallback;
  return {
    prestiges: Math.floor(num(r.prestiges, 0, 0)),
    ipos: Math.floor(num(r.ipos, 0, 0)),
    bestHitsInRun: Math.floor(num(r.bestHitsInRun, 0, 0)),
    peakValuationDollars: Math.floor(num(r.peakValuationDollars, 0, 0)),
    bestRank: Math.floor(num(r.bestRank, 1, EMPTY.bestRank)),
  };
}

export function getFounderRecord(): FounderRecord {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...EMPTY };
  }
}

function write(rec: FounderRecord): void {
  const serialized = JSON.stringify(rec);
  try {
    localStorage.setItem(KEY, serialized);
  } catch {
    /* ignore */
  }
  mirrorToNative(KEY, serialized);
}

/** A single run's contribution to the record. All optional; only the maxima/counts that improve the
 *  stored record take effect. */
export interface FounderContribution {
  /** +1 prestige (a New Game+ founding). */
  prestige?: boolean;
  /** +1 IPO (going public). */
  ipo?: boolean;
  hitsInRun?: number;
  valuationDollars?: number;
  rank?: number;
}

/** Fold a run's contribution into the lifetime record (idempotent for maxima). Returns the new record. */
export function recordFounder(c: FounderContribution): FounderRecord {
  const rec = getFounderRecord();
  const next: FounderRecord = {
    prestiges: rec.prestiges + (c.prestige ? 1 : 0),
    ipos: rec.ipos + (c.ipo ? 1 : 0),
    bestHitsInRun: Math.max(rec.bestHitsInRun, Math.max(0, Math.floor(c.hitsInRun ?? 0))),
    peakValuationDollars: Math.max(rec.peakValuationDollars, Math.max(0, Math.floor(c.valuationDollars ?? 0))),
    bestRank: c.rank && c.rank > 0 ? Math.min(rec.bestRank, Math.floor(c.rank)) : rec.bestRank,
  };
  write(next);
  return next;
}

/** Bulk-restore from a backup — merge keeps the BETTER of each field (never a downgrade). */
export function mergeFounderRecord(incoming: unknown): void {
  if (!incoming) return;
  const inc = sanitize(incoming);
  const cur = getFounderRecord();
  write({
    prestiges: Math.max(cur.prestiges, inc.prestiges),
    ipos: Math.max(cur.ipos, inc.ipos),
    bestHitsInRun: Math.max(cur.bestHitsInRun, inc.bestHitsInRun),
    peakValuationDollars: Math.max(cur.peakValuationDollars, inc.peakValuationDollars),
    bestRank: Math.min(cur.bestRank, inc.bestRank),
  });
}

// --- The ladder (pure) ------------------------------------------------------------------------

/** How much the peak valuation contributes to the legend score — a log curve so each 10× of empire
 *  value is a roughly equal step (a $1B founder isn't 1000× a $1M one, just a few rungs higher). */
function valuationScore(dollars: number): number {
  if (dollars < 100_000) return 0; // below a real company — no contribution
  return Math.max(0, Math.log10(dollars) - 5) * 22; // $1M→22, $1B→88, $1T→154
}

function rankScore(bestRank: number): number {
  if (bestRank <= 1) return 60;
  if (bestRank <= 3) return 35;
  if (bestRank <= 5) return 18;
  return 0;
}

/** The single monotonic score the ladder reads. Higher lifetime achievement → higher score → higher
 *  title. Pure and stable so "progress to next rung" is a clean bar. */
export function legendScore(rec: FounderRecord): number {
  return Math.round(
    rec.prestiges * 90 +
    rec.ipos * 55 +
    rec.bestHitsInRun * 6 +
    valuationScore(rec.peakValuationDollars) +
    rankScore(rec.bestRank),
  );
}

/** The current run's live contribution to the score — folded over the stored record so the title can
 *  climb DURING play (a fresh hit or a valuation high nudges the bar), not only at IPO / prestige.
 *  Maxima only; the IPO count is already persisted the moment you go public. */
export function liveLegendScore(
  rec: FounderRecord,
  live: { hitsInRun?: number; valuationDollars?: number; rank?: number },
): number {
  return legendScore({
    ...rec,
    bestHitsInRun: Math.max(rec.bestHitsInRun, Math.max(0, Math.floor(live.hitsInRun ?? 0))),
    peakValuationDollars: Math.max(rec.peakValuationDollars, Math.max(0, Math.floor(live.valuationDollars ?? 0))),
    bestRank: live.rank && live.rank > 0 ? Math.min(rec.bestRank, Math.floor(live.rank)) : rec.bestRank,
  });
}

/** The named tiers, ascending by required score. Beyond the last, the ladder continues endlessly as
 *  "Founding Legend II, III, …" every LEGEND_STEP points — there is always a next rung. */
export const LEGEND_TIERS: readonly { name: string; minScore: number }[] = [
  { name: "Garage Founder", minScore: 0 },
  { name: "Bootstrapper", minScore: 40 },
  { name: "Breakout Founder", minScore: 95 },
  { name: "Serial Founder", minScore: 165 },
  { name: "Industry Player", minScore: 255 },
  { name: "Market Maker", minScore: 365 },
  { name: "Empire Builder", minScore: 500 },
  { name: "Tech Titan", minScore: 680 },
  { name: "Visionary", minScore: 900 },
  { name: "Silicon Icon", minScore: 1160 },
  { name: "Founding Legend", minScore: 1500 },
];

const LEGEND_STEP = 400; // score per numbered Legend tier past the last named one

const ROMAN = ["", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function roman(n: number): string {
  if (n <= 0) return "";
  if (n < ROMAN.length) return ROMAN[n];
  return String(n + 1); // way past the table — just number it
}

export interface LegendStanding {
  /** The current title, e.g. "Serial Founder" or "Founding Legend III". */
  title: string;
  /** 0-based index into the ladder (named tiers 0..N, then N+1, N+2… for numbered legends). */
  tierIndex: number;
  score: number;
  /** Score at which the current title was reached. */
  tierMin: number;
  /** Score needed for the NEXT title (always defined — the ladder is endless). */
  nextMin: number;
  /** Title of the next rung. */
  nextTitle: string;
  /** 0..1 progress from this rung to the next. */
  progress: number;
}

/** Resolve a score to its place on the endless ladder. */
export function legendStanding(score: number): LegendStanding {
  const s = Math.max(0, score);
  const top = LEGEND_TIERS[LEGEND_TIERS.length - 1];
  if (s < top.minScore) {
    // Within the named tiers.
    let i = 0;
    for (let k = 0; k < LEGEND_TIERS.length; k++) if (s >= LEGEND_TIERS[k].minScore) i = k;
    const cur = LEGEND_TIERS[i];
    const next = LEGEND_TIERS[i + 1];
    return {
      title: cur.name,
      tierIndex: i,
      score: s,
      tierMin: cur.minScore,
      nextMin: next.minScore,
      nextTitle: next.name,
      progress: clamp01((s - cur.minScore) / (next.minScore - cur.minScore)),
    };
  }
  // Past the last named tier: numbered "Founding Legend" rungs, endlessly.
  const over = s - top.minScore;
  const step = Math.floor(over / LEGEND_STEP); // 0 = the base "Founding Legend"
  const tierMin = top.minScore + step * LEGEND_STEP;
  const nextMin = tierMin + LEGEND_STEP;
  const label = (n: number) => (n === 0 ? top.name : `${top.name} ${roman(n)}`);
  return {
    title: label(step),
    tierIndex: (LEGEND_TIERS.length - 1) + step,
    score: s,
    tierMin,
    nextMin,
    nextTitle: label(step + 1),
    progress: clamp01((s - tierMin) / LEGEND_STEP),
  };
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
