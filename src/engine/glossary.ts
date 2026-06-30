// Plain-language model explainers (Epic C3 — "the model is never hidden"). PURE.
//
// The genre's #1 failure is illegibility; the premium benchmarks win on "almost nothing is confusing"
// (Two Point). We surface what each stat does and what each buyer segment wants — and the segment
// copy is DERIVED from the live SEGMENTS weights, so it can never drift out of sync with the sim.
import { SEGMENTS, type Segment } from "./segments.ts";
import { STAT_KEYS, type StatKey } from "./types.ts";

// The single source of truth for stat copy. `label` is the Title-Case UI label (chips, spec rows,
// post-mortem); `abbr` is the compact form for dense bars / contribution lists; `prose` is the
// lowercase sentence form used inside review prose ("praises its build quality"). All three
// registers live here so they can never drift apart again — 6 hand-maintained copies with three
// different abbreviation schemes existed across the screens before this was consolidated.
export const STAT_INFO: Record<StatKey, { label: string; abbr: string; prose: string; blurb: string }> = {
  performance: { label: "Performance", abbr: "Perf", prose: "performance", blurb: "Raw speed and power. Pros and power users pay for it; budget buyers care less." },
  quality: { label: "Quality", abbr: "Quality", prose: "build quality", blurb: "Build quality and reliability, reassures every buyer and is vital to Enterprise fleets." },
  battery: { label: "Battery", abbr: "Battery", prose: "battery life", blurb: "Endurance away from a charger. A Budget and Mainstream essential." },
  design: { label: "Design", abbr: "Design", prose: "design", blurb: "Looks, finish and form. The Style segment buys on this above all else." },
  ecosystem: { label: "Ecosystem", abbr: "Ecosys", prose: "ecosystem", blurb: "Apps, services and lock-in. Pro and Enterprise value the platform around the device." },
};

/** The `n` stats a segment weights most, derived live from its weights (never stale). */
export function segmentTopStats(seg: Segment, n = 2): StatKey[] {
  return [...STAT_KEYS].sort((a, b) => seg.weights[b] - seg.weights[a]).slice(0, n);
}

export function segmentPriceLabel(seg: Segment): "very price-led" | "price-aware" | "price-insensitive" {
  if (seg.priceSensitivity >= 1.4) return "very price-led";
  if (seg.priceSensitivity >= 1.0) return "price-aware";
  return "price-insensitive";
}

/** One-line "what this buyer wants", e.g. "Performance + Quality · price-insensitive". For the UI. */
export function segmentWants(seg: Segment): string {
  const tops = segmentTopStats(seg).map((k) => STAT_INFO[k].label);
  return `${tops.join(" + ")} · ${segmentPriceLabel(seg)}`;
}

/** Lookup helper for the UI: the "wants" line for a segment id (empty string for an unknown id). */
export function segmentWantsById(id: string): string {
  const seg = SEGMENTS.find((s) => s.id === id);
  return seg ? segmentWants(seg) : "";
}

/** Plain-language definitions for the headline economic terms a new player meets outside the
 *  Design Lab (the Bank, the HUD). Same "nothing is confusing" goal as STAT_INFO, kept here as the
 *  single source so the copy can't drift. Ordered as they read on the Bank screen. */
export const TERM_INFO: { term: string; def: string }[] = [
  { term: "Cash", def: "Money you can spend right now, on builds, hires, marketing and upgrades. Hit zero for too long and you go bankrupt." },
  { term: "Runway", def: "How many weeks your cash lasts at the current weekly loss. \"Profitable\" means you're earning more than you spend." },
  { term: "Burn", def: "Your total spending each week, payroll, rent and overheads. Lower it or out-earn it to extend your runway." },
  { term: "Net worth", def: "Everything you're worth: cash, the value of your stake in your own company, and any rival shares you hold." },
  { term: "Research points", def: "RP, the research currency, earned weekly by staff in R&D. Spent on tech tiers and company research projects." },
  { term: "Reputation", def: "How much the market trusts your brand (0–100). Rises with hits, falls with flops; gates new eras and the IPO." },
  { term: "Fans", def: "Loyal customers who pre-order your next product. Hits grow your fanbase; flops shrink it." },
];
