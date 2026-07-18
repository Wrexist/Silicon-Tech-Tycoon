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

/** The three headline SCORES a player stares at in the Design Lab — defined nowhere until now. Copy is
 *  causal (what each number is built FROM and what moves it), not a restatement of the label. Single
 *  source so the lab's inline explainers and the Help hub can't drift. */
export const SCORE_INFO: { term: string; def: string }[] = [
  { term: "Fit", def: "How well this design matches what buyers want right now (0–100). It weighs your five stats against the current market taste and your price. Higher Fit means more of the market wants exactly this — it's the single biggest lever on how a launch sells. (This is the whole-market score; per-buyer-segment fit is tracked separately as Segment fit.)" },
  { term: "Build", def: "How coherent the component mix is. A balanced, high-end build earns a flagship bonus; one glaring weak link (a cheap part among strong ones) drags the whole product down. Raise the weakest slot to lift the score, don't just max one part." },
  { term: "Projected verdict", def: "Your likely launch result — Fit and your build, adjusted by your reputation and track record, then measured against what rivals are shipping. It can slip from Hit to Solid without you changing anything when a rival raises the bar, so ship while you're ahead." },
];

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
  // --- Advanced systems: the vocabulary that gates the game's depth, defined in one place ---
  { term: "Segment fit", def: "How well a design matches ONE buyer segment's wants (0–100). The market sells through five segments (Budget, Mainstream, Pro, Style, Enterprise), each weighting the stats and price differently, so \"who is this for?\" is the core question. Distinct from the headline Fit score, which measures your design against the whole market at once." },
  { term: "Design brief", def: "Optionally commit a product to a target segment. Nail that segment's fit at launch for bonus reputation and fans; miss it and you simply forgo the bonus (never a penalty). (\"Brief fit\" is scored only against that committed target — a third, opt-in lens on top of the headline Fit and per-segment fit.)" },
  { term: "Doctrine", def: "A mutually-exclusive research fork (Engineering / Go-to-Market / Operations Houses). You can only ever pick ONE per fork — it stamps a permanent identity on every product, so it's a lasting playstyle choice, not a checklist buy." },
  { term: "Capstone", def: "The deep, end-of-tree research project for an era. It sits behind prerequisites (you must complete the required projects first) and pays a strong compound bonus." },
  { term: "Supplier loyalty", def: "Repeat business with a component supplier earns a standing per-unit discount that grows the more you order from them. A fixed-price contract locks in a further cut." },
  { term: "Region standing", def: "Your loyalty in each overseas market. Responding to a region's events lifts it (more reach there); ignoring them lets it drift back toward neutral." },
  { term: "Nemesis", def: "An arch-rival that forms when a competitor repeatedly clashes with you. It hunts your turf with heat-scaled launches and taunts you — beat it back and the rivalry escalates into a storyline." },
  { term: "Strategic stake", def: "A share position in a rival becomes a strategic verb as it grows. Hold 10% for INSIDER intel (read their hidden momentum, next likely category and launch timing); 25% earns a BOARD SEAT and a rare, once-a-year nudge to delay their next launch; 50% is a controlling stake that buys them out at a reduced premium. A late-game cash sink that turns the stock market into a game of intel and influence." },
  { term: "Board mandate", def: "A quarterly directive the board sets once you've gone public (post-IPO). Hit its target — revenue, hits, fans or rank — by the deadline for a cash + reputation reward; then it reissues a tougher bar." },
  { term: "Megaproject", def: "A post-IPO moonshot: sink a huge amount of cash and research into it for a permanent payoff (reputation, a kept fan boost) and Legacy Points. The slate never fully empties." },
  { term: "Legacy Points", def: "The prestige currency your megaprojects bank. Spend them in the Legacy tree on permanent, build-defining boons (hype, research, design ceiling, or margin), choosing a route as you climb its tiers." },
  // --- The "living world" vocabulary: flavor + the soft demand levers a player meets in play ---
  { term: "Buzz", def: "The industry news wire's running headlines about you and your rivals, shown on the Office as a rotating ticker. It's editorial flavor that reflects your results, not a stat you spend or raise." },
  { term: "Brand awareness", def: "How widely the market knows your company, grown by launches and marketing. It feeds each release's launch hype (a demand head-start on day one) and eases off if you go quiet." },
  { term: "Novelty & fatigue", def: "\"We just bought that.\" Ship a device too similar to a recent one in the same category and the broad market's demand dampens (your fans still pre-order). Real spec bumps or enough elapsed time refresh it." },
  { term: "Market climate", def: "A slow seasonal swell and ebb in each buyer segment's size across the year. Launch into a segment while its climate is rising for a timing tailwind — it shifts demand between segments, not the total." },
  { term: "Aesthetics", def: "The otherwise-cosmetic form choices — screen cutout, camera module shape, lens count, flash — are a real, bounded demand lever on top of the Design stat. A coherent, striking look lifts every segment, the Style buyer most." },
  { term: "Tuning", def: "A per-product dial along a value↔premium axis (e.g. trading performance for battery). Pushing it costs more per unit to build, so it pays off only when it leans the device toward what the market wants right now." },
  { term: "Capacity strategy", def: "How hard you push a production run. Overtime or stretching a line lifts output to meet demand, but the added strain raises the defect rate — you weigh speed against the units you scrap." },
  { term: "Dual-source", def: "Contract a second supplier for a component so one supplier's shortage or price crunch can't stall the build. It costs a small per-unit premium for the redundancy, and halves that product's crunch exposure." },
  { term: "Valuation momentum", def: "A bounded swing in your company's value around its fundamentals, driven by recent results. Hits pop it up (a richer valuation and share price), flops drag it down, and it drifts back to neutral over time." },
  { term: "Board confidence", def: "How much your board backs you once public (0–100). Meeting mandates raises it and lifts a tier that multiplies mandate payouts; missing them lowers it. It never touches cash or reputation directly." },
  { term: "Verdict", def: "The launch result band a product lands in — Hit, Solid, Steady or Flop — set by its Fit and build measured against rivals and your reputation. Hits grow fans and reputation; flops cost you both." },
];
