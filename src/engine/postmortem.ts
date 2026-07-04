// Post-mortem ranking + headline (Epic C1 — the verdict layer). PURE.
//
// We already record a LaunchInsight ("why it won/flopped"). The research moat is legibility done with
// RESTRAINT: surface the 2–3 DECISIVE factors and one synthesized headline, not a fog of equal-weight
// readouts (Besiege's "tiny tasty morsels," Two Point's one-click clarity). This module scores how
// decisive each factor was and writes the headline; the UI keeps the long-form copy. Pillar #5.
import type { LaunchInsight } from "./types.ts";

export type Verdict = "hit" | "solid" | "steady" | "flop";
export type FactorKey = "demand" | "audience" | "price" | "competition" | "hype";
export type FactorTone = "positive" | "accent" | "negative" | "neutral";

export interface FactorImpact {
  key: FactorKey;
  impact: number; // 0..1 — how decisive this factor was for the outcome
  tone: FactorTone;
}

export interface PostMortem {
  /** A screenshot-worthy one-liner synthesizing the launch. */
  headline: string;
  /** An authored 1-2 sentence story of WHY it landed that way (Track A: narrative & voice) —
   *  fuller and more voiced than the headline, keyed on the decisive factors + the audience. */
  narrative: string;
  /** Per-factor decisiveness + tone, for ordering/emphasis in the UI. */
  impacts: Record<FactorKey, FactorImpact>;
  /** The factors that actually mattered (highest impact first, above a small floor). */
  dominant: FactorKey[];
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Minimum impact for a factor to count as "dominant" (worth emphasising). */
const DOMINANT_FLOOR = 0.18;

function demandImpact(ins: LaunchInsight): FactorImpact {
  const fit = ins.demandFit;
  const impact = clamp(Math.abs(fit - 50) / 50, 0, 1);
  const tone: FactorTone = fit >= 58 ? "positive" : fit <= 42 ? "negative" : "accent";
  return { key: "demand", impact, tone };
}

function priceImpact(ins: LaunchInsight): FactorImpact {
  const pf = ins.priceFit;
  const impact = clamp(Math.abs(pf - 1) / 0.5, 0, 1);
  const tone: FactorTone = pf < 0.85 ? "negative" : pf > 1.12 ? "positive" : "accent";
  return { key: "price", impact, tone };
}

function competitionImpact(ins: LaunchInsight): FactorImpact {
  const impact = clamp(1 - ins.competitionFactor, 0, 1);
  const tone: FactorTone = ins.betterRivals > 0 ? "negative" : ins.matchingRivals > 0 ? "accent" : "positive";
  return { key: "competition", impact, tone };
}

function hypeImpact(ins: LaunchInsight): FactorImpact {
  const h = ins.hype;
  const impact = clamp(Math.abs(h - 1.15) / 1.0, 0, 1);
  const tone: FactorTone = h >= 1.6 ? "positive" : h < 1.1 ? "negative" : "accent";
  return { key: "hype", impact, tone };
}

function audienceImpact(ins: LaunchInsight): FactorImpact {
  const seg = ins.perSegment;
  if (!seg || seg.length === 0) return { key: "audience", impact: 0, tone: "neutral" };
  const caps = seg.map((s) => s.captured);
  const max = Math.max(...caps);
  const mean = caps.reduce((a, b) => a + b, 0) / caps.length;
  // How concentrated the win is: a product with one clearly dominant segment has a strong identity.
  const impact = max > 0 ? clamp((max - mean) / max, 0, 1) : 0;
  return { key: "audience", impact, tone: "positive" };
}

function segName(ins: LaunchInsight, id: string | undefined): string {
  return ins.perSegment?.find((s) => s.id === id)?.name ?? "core";
}

/** Short clause describing a factor, used to assemble the headline. */
function phrase(f: FactorImpact, ins: LaunchInsight): string {
  switch (f.key) {
    case "demand":
      return f.tone === "positive" ? "nailed what the market wanted" : "missed what buyers wanted";
    case "price":
      return f.tone === "positive" ? "a sharp price drove volume" : "buyers balked at the price";
    case "competition":
      return f.tone === "negative" ? "rivals outclassed it" : "it owned the category";
    case "hype":
      return f.tone === "positive" ? "a big launch buzz" : "almost no launch buzz";
    case "audience":
      return `it won over ${segName(ins, ins.dominantSegment)} buyers`;
  }
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** A fuller, voiced clause for the authored narrative (richer than the terse headline `phrase`). */
function richClause(f: FactorImpact, ins: LaunchInsight): string {
  switch (f.key) {
    case "demand":
      return f.tone === "positive"
        ? "it read the moment perfectly, matching exactly what buyers wanted"
        : "it misjudged what buyers were actually after";
    case "price":
      return f.tone === "positive"
        ? "the price was pitched just right, and the volume followed"
        : "shoppers balked at the price";
    case "competition":
      if (f.tone === "negative") {
        return ins.betterRivals > 1
          ? `${ins.betterRivals} rivals simply outclassed it`
          : "a stronger rival simply outclassed it";
      }
      return ins.matchingRivals > 0
        ? "rivals were trading blows for the same buyers"
        : "it walked into an open field with no real challenger";
    case "hype":
      return f.tone === "positive" ? "launch-day buzz was enormous" : "it launched to near silence";
    case "audience":
      return `${segName(ins, ins.dominantSegment)} buyers embraced it`;
  }
}

/** A short "who bought it / who didn't" coda, when the audience isn't already the lead factor. */
function audienceTail(ins: LaunchInsight): string {
  const won = ins.dominantSegment ? segName(ins, ins.dominantSegment) : null;
  const lost = ins.weakestSegment ? segName(ins, ins.weakestSegment) : null;
  if (won && lost && won !== lost) return ` It won over ${won} buyers but never reached ${lost}.`;
  if (won) return ` ${cap(won)} buyers were its champions.`;
  return "";
}

/** The single most decisive factor, as a short capitalised phrase — the launch reveal's "why"
 *  line. Null when nothing crosses the dominant floor (a balanced, unremarkable launch). Pure. */
export function topFactorSummary(
  ins: LaunchInsight,
  verdict: Verdict,
): { key: FactorKey; tone: FactorTone; text: string } | null {
  const pm = postMortem(ins, verdict);
  const key = pm.dominant[0];
  if (!key) return null;
  const f = pm.impacts[key];
  return { key, tone: f.tone, text: cap(phrase(f, ins)) };
}

/** Score every factor, rank them, and synthesize the verdict headline. Pure + deterministic. */
export function postMortem(ins: LaunchInsight, verdict: Verdict): PostMortem {
  const list = [
    demandImpact(ins),
    priceImpact(ins),
    competitionImpact(ins),
    hypeImpact(ins),
    audienceImpact(ins),
  ];
  const impacts = Object.fromEntries(list.map((f) => [f.key, f])) as Record<FactorKey, FactorImpact>;

  const ranked = [...list].sort((a, b) => b.impact - a.impact);
  const dominant = ranked.filter((f) => f.impact >= DOMINANT_FLOOR).slice(0, 3).map((f) => f.key);

  const topPos = ranked.find((f) => f.tone === "positive" && f.impact >= DOMINANT_FLOOR);
  const topNeg = ranked.find((f) => f.tone === "negative" && f.impact >= DOMINANT_FLOOR);
  const pos = topPos ? phrase(topPos, ins) : null;
  const neg = topNeg ? phrase(topNeg, ins) : null;

  let headline: string;
  switch (verdict) {
    case "hit":
      headline = `A hit: ${pos ?? "a strong, well-rounded launch"}` + (topNeg && topNeg.impact > 0.4 ? `, despite ${neg}` : "") + ".";
      break;
    case "solid":
      headline = `Solid: ${pos ?? "a dependable launch"}.`;
      break;
    case "steady":
      headline = neg ? `Steady: held back because ${neg}.` : "A steady, dependable seller.";
      break;
    case "flop":
      headline = `Flopped: ${neg ?? "it missed the market"}.`;
      break;
  }

  // The authored story (richer + voiced), keyed on the decisive factors and the audience.
  const rPos = topPos ? richClause(topPos, ins) : null;
  const rNeg = topNeg ? richClause(topNeg, ins) : null;
  const aud = topPos?.key !== "audience" && topNeg?.key !== "audience" ? audienceTail(ins) : "";
  let narrative: string;
  switch (verdict) {
    case "hit":
      narrative = rPos
        ? `A breakout. ${cap(rPos)}${rNeg ? `, and even though ${rNeg}, the market could not ignore it` : ""}.`
        : "A breakout: a strong, well-rounded launch the market could not ignore.";
      break;
    case "solid":
      narrative = rPos
        ? `A solid showing. ${cap(rPos)}${rNeg ? `, though ${rNeg}` : ""}.`
        : "A solid, dependable showing that did its job without fireworks.";
      break;
    case "steady":
      narrative = rNeg
        ? `It held steady rather than soared: ${rNeg}${rPos ? `, even though ${rPos}` : ""}.`
        : "A steady seller that neither soared nor stumbled.";
      break;
    case "flop":
      narrative = rNeg
        ? `It stumbled. ${cap(rNeg)}, and the numbers never recovered.`
        : "It stumbled: the product missed the market and never recovered.";
      break;
  }
  narrative += aud;

  return { headline, narrative, impacts, dominant };
}
