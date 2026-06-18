// Critic reviews — PURE. Turns a launched product's already-recorded metrics into fictional
// tech-press reviews: an aggregate score, a few named-outlet scores, a headline pull-quote, and
// pros/cons. PRESENTATION ONLY — it reads metrics the engine already computed and never feeds
// back into the simulation, so it can't touch balance. Deterministic per product id (the same
// product always yields the same reviews) so it's stable across re-renders and reloads.
import { makeRng } from "./rng.ts";
import type { Stats } from "./types.ts";

export type ReviewVerdict = "hit" | "flop" | "solid" | "steady";

export interface ReviewInputs {
  productId: string;
  stats: Stats;
  verdict: ReviewVerdict;
  /** 0..100 — how well it matched demand at launch (default 60 for pre-insight saves). */
  demandFit: number;
  /** 0..1.35 — price fairness vs perceived value (default 1 for pre-insight saves). */
  priceFit: number;
  /** rivals clearly better than you at launch (default 0). */
  betterRivals: number;
}

export interface OutletScore {
  outlet: string;
  score: number; // 0..100
}

export interface CriticReviews {
  aggregate: number; // 0..100, Metacritic-style
  outlets: OutletScore[]; // 3 fictional publications
  headline: string; // pull-quote
  pros: string[]; // 1..2
  cons: string[]; // 1..2
}

// IP-clean fictional publications (no real outlet names — ship-blocker rule).
export const OUTLETS = ["The Circuit", "Bitstream", "Field & Frame", "Teardown Weekly", "Mainboard", "Slate & Silicon"] as const;

const STAT_LABEL: Record<keyof Stats, string> = {
  performance: "performance",
  quality: "build quality",
  battery: "battery life",
  design: "design",
  ecosystem: "ecosystem",
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** FNV-1a hash → a stable 32-bit seed from the product id. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rankStats(s: Stats): { key: keyof Stats; v: number }[] {
  return (Object.keys(STAT_LABEL) as (keyof Stats)[])
    .map((k) => ({ key: k, v: s[k] }))
    .sort((a, b) => b.v - a.v);
}

/** Aggregate score, pulled toward the verdict band so a review never contradicts the verdict the
 *  player already saw, but still moved by the product's real strengths. */
function aggregateScore(inp: ReviewInputs): number {
  const s = inp.stats;
  const avg = (s.performance + s.quality + s.battery + s.design + s.ecosystem) / 5; // 0..100
  const priceComponent = (clamp(inp.priceFit, 0, 1.2) / 1.2) * 100; // 0..100
  const raw = avg * 0.6 + clamp(inp.demandFit, 0, 100) * 0.25 + priceComponent * 0.15;
  const band = inp.verdict === "hit" ? 90 : inp.verdict === "solid" ? 78 : inp.verdict === "steady" ? 64 : 42;
  return clamp(Math.round(raw * 0.45 + band * 0.55), 12, 99);
}

const HEADLINES: Record<ReviewVerdict, string[]> = {
  hit: [
    "A standout — the one to beat this season.",
    "Easily one of the year's most exciting releases.",
    "Rare is the product that delivers on the hype. This one does.",
  ],
  solid: [
    "A confident, polished release that gets the fundamentals right.",
    "No fireworks, but very few compromises.",
    "Dependable and well-built — an easy recommendation.",
  ],
  steady: [
    "Competent, if a little safe.",
    "Gets the job done without turning heads.",
    "A sensible pick that plays it down the middle.",
  ],
  flop: [
    "Ambitious, but it loses the thread.",
    "Good ideas undercut by the execution.",
    "Hard to recommend as it stands.",
  ],
};

/** Build the full review set. Pure + deterministic for a given product id. */
export function criticReviews(inp: ReviewInputs): CriticReviews {
  const rng = makeRng(hashId(inp.productId) ^ 0x9e3779b9);
  const aggregate = aggregateScore(inp);

  // Three distinct outlets, each scoring within ±4 of the consensus.
  const pool = [...OUTLETS];
  const outlets: OutletScore[] = [];
  for (let i = 0; i < 3; i++) {
    const outlet = pool.splice(rng.int(pool.length), 1)[0];
    outlets.push({ outlet, score: clamp(aggregate + rng.int(9) - 4, 10, 100) });
  }

  const ranked = rankStats(inp.stats);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const pros: string[] = [];
  const cons: string[] = [];
  if (best.v >= 55) pros.push(`Class-leading ${STAT_LABEL[best.key]}`);
  if (inp.demandFit >= 65) pros.push("Reads the moment — exactly what buyers want");
  if (inp.priceFit >= 1.1) pros.push("Genuinely good value");
  else if (inp.priceFit <= 0.78) cons.push("Hard to justify the price");
  if (worst.v <= 38) cons.push(`Underwhelming ${STAT_LABEL[worst.key]}`);
  if (inp.demandFit <= 38) cons.push("Out of step with what people want right now");
  if (inp.betterRivals >= 2) cons.push("Sharper rivals already on shelves");

  // Never leave a side empty — every product gets a fair, readable take.
  if (pros.length === 0) pros.push(`Respectable ${STAT_LABEL[best.key]}`);
  if (cons.length === 0) cons.push(inp.verdict === "hit" ? "Priced like the premium product it is" : `Room to grow on ${STAT_LABEL[worst.key]}`);

  const templates = HEADLINES[inp.verdict];
  const headline = templates[rng.int(templates.length)];

  return { aggregate, outlets, headline, pros: pros.slice(0, 2), cons: cons.slice(0, 2) };
}
