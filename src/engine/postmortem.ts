// Post-mortem ranking + headline (Epic C1 — the verdict layer). PURE.
//
// We already record a LaunchInsight ("why it won/flopped"). The research moat is legibility done with
// RESTRAINT: surface the 2–3 DECISIVE factors and one synthesized headline, not a fog of equal-weight
// readouts (Besiege's "tiny tasty morsels," Two Point's one-click clarity). This module scores how
// decisive each factor was and writes the headline; the UI keeps the long-form copy. Pillar #5.
import type { LaunchInsight, LaunchedProduct } from "./types.ts";

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


// ─────────────────────────  Long-form post-mortem copy  ─────────────────────────
// `postMortem()` above scores WHICH factors were decisive and writes the one-line headline. What
// follows is the long-form layer the product detail sheet reads out: a plain-language driver per
// factor, and the actionable tips. Both were 130 lines inline in screens/Market.tsx — pure functions
// of a LaunchedProduct, authored player-facing copy, and completely untestable where they sat.

export type DriverTone = FactorTone;

export interface Driver {
  key: FactorKey;
  label: string;
  value: string;
  detail: string;
  tone: DriverTone;
}

/** The verdict a launched product carries, falling back to a read of its launch score for saves
 *  written before verdicts were recorded. */
export function verdictOf(lp: LaunchedProduct): Verdict {
  if (lp.verdict) return lp.verdict as Verdict;
  return lp.launchScore >= 76 ? "hit" : lp.launchScore <= 22 ? "flop" : lp.launchScore >= 45 ? "solid" : "steady";
}

/** Build the "why it performed" drivers in plain language. Prefers the launch-moment snapshot
 *  (insight) recorded on the product; falls back to a qualitative read from the launch score for
 *  saves written before insight existed — never fabricating numbers we don't have. */
export function launchDrivers(lp: LaunchedProduct): Driver[] {
  const ins = lp.insight;
  const drivers: Driver[] = [];

  // 1) Demand fit — how well the stats matched what consumers wanted at launch.
  if (ins) {
    const f = Math.round(ins.demandFit);
    drivers.push({
      key: "demand",
      label: "Demand fit",
      value: `${f}/100`,
      detail: f >= 60 ? "Closely matched what the market wanted." : f >= 35 ? "A decent match for the trend." : "Out of step with what buyers wanted.",
      tone: f >= 60 ? "positive" : f >= 35 ? "accent" : "negative",
    });
  } else {
    const hi = lp.launchScore >= 76;
    const lo = lp.launchScore <= 22;
    drivers.push({
      key: "demand",
      label: "Demand fit",
      value: hi ? "Strong" : lo ? "Weak" : "Fair",
      detail: hi ? "Read the market well at launch." : lo ? "Mistimed the market." : "An average read on the trend.",
      tone: hi ? "positive" : lo ? "negative" : "accent",
    });
  }

  // 1b) Audience — which buyer segment this product won and which it lost (Epic A). Additive:
  // skipped for saves written before segments existed (no dominantSegment recorded).
  if (ins?.dominantSegment && ins.perSegment && ins.perSegment.length) {
    const top = ins.perSegment.find((s) => s.id === ins.dominantSegment) ?? ins.perSegment[0];
    const low = ins.perSegment.find((s) => s.id === ins.weakestSegment) ?? ins.perSegment[ins.perSegment.length - 1];
    const lowReason = low.priceFit < 0.6 ? "priced out" : low.fit < 35 ? "specs missed" : "niche appeal";
    drivers.push({
      key: "audience",
      label: "Audience",
      value: top.name,
      detail: `Strongest with ${top.name} buyers; weakest with ${low.name} (${lowReason}).`,
      tone: "accent",
    });
  }

  // 2) Price positioning — value buy vs. on-the-money vs. overpriced.
  if (ins) {
    const pf = ins.priceFit;
    const over = pf < 0.8;
    const under = pf > 1.12;
    drivers.push({
      key: "price",
      label: "Price",
      value: over ? "Overpriced" : under ? "Value buy" : "On the money",
      detail: over ? "Buyers felt it cost too much for the spec." : under ? "Priced below its perceived value, which drove volume." : "Priced fairly for what it delivered.",
      tone: over ? "negative" : under ? "positive" : "accent",
    });
  }

  // 3) Competition pressure — rivals splitting or beating the market.
  if (ins) {
    const beats = ins.betterRivals;
    const matches = ins.matchingRivals;
    const kept = Math.round(ins.competitionFactor * 100);
    drivers.push({
      key: "competition",
      label: "Competition",
      value: beats > 0 ? `${beats} ahead` : matches > 0 ? `${matches} matched` : "Clear field",
      detail: beats > 0
        ? `Rivals outclassed you; you kept ~${kept}% of demand.`
        : matches > 0
          ? `Rivals split the market; you kept ~${kept}% of demand.`
          : "No rival came close; you owned the category.",
      tone: beats > 0 ? "negative" : matches > 0 ? "accent" : "positive",
    });
  }

  // 4) Hype — reputation + marketing reach at launch.
  if (ins) {
    const h = ins.hype;
    const strong = h >= 1.6;
    const weak = h < 1.1;
    drivers.push({
      key: "hype",
      label: "Hype",
      value: strong ? "High" : weak ? "Low" : "Moderate",
      detail: strong ? "Reputation and marketing gave a big launch boost." : weak ? "Little buzz; few buyers knew it existed." : "A steady amount of launch buzz.",
      tone: strong ? "positive" : weak ? "negative" : "accent",
    });
  }

  return drivers;
}

/** Derive up to 3 actionable post-launch tips from the recorded launch insight. */
export function launchTips(lp: LaunchedProduct): string[] {
  const ins = lp.insight;
  if (!ins) return [];
  const v = verdictOf(lp);
  const tips: string[] = [];
  if (ins.demandFit < 40) {
    tips.push("Poor trend match: check the Market tab before designing and build toward what consumers are currently demanding.");
  }
  if (ins.priceFit < 0.8) {
    tips.push("Buyers found this overpriced. Try the 'Suggest' button in the Design Lab to dial in a fairer price next time.");
  } else if (ins.priceFit > 1.12 && v !== "hit") {
    tips.push("Underpriced: the quality supported a higher price. Charging a bit more improves margins without hurting demand.");
  }
  if (ins.betterRivals >= 2) {
    tips.push("Multiple rivals outclassed this product: upgrade components to higher tiers and invest in R&D to unlock better tech.");
  } else if (ins.betterRivals === 1) {
    tips.push("One rival edged you out: a single component upgrade or a tighter price could swing the category your way.");
  }
  if (ins.hype < 1.05 && tips.length < 3) {
    tips.push("Very little launch buzz. Put a team member on Marketing for an ongoing hype boost, or run a paid campaign (Social, Search, or TV) to multiply demand at the next launch.");
  }
  if (tips.length === 0 && v === "hit") {
    tips.push("Strong launch: maintain momentum by designing a successor before this product finishes its run.");
  }
  return tips.slice(0, 3);
}

