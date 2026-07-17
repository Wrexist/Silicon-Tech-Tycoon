// Frontier Tech — the ENDLESS extension of the finite Legacy Tree. Megaprojects bank Legacy Points;
// the Legacy Tree (engine/legacyTree.ts) is a fixed 12-perk spend, so once it's bought out the points
// dead-end. Frontier tiers give them a permanent sink: repeatable levels at an escalating Legacy-Point
// cost, each a small stacking boon delivered through the SAME PerkBonus plumbing the tree already uses
// (prestigeBonuses in gameState). So "your labs push past the industry ceiling" never stops being a
// thing to grind toward, and no new sim seam is introduced — it folds into an aggregation that's
// already gated on wentPublic.
//
// Sim-safe by construction: everything keys off the tier count, which is 0 (undefined) until the
// player — who must be public — buys one. frontierBonuses(0/undefined) is the neutral all-zero
// PerkBonus, so the pinned solo sim (never IPOs) and every existing save are byte-identical.
import type { PerkBonus } from "./perks.ts";

export const FRONTIER_BASE_COST = 6;   // Legacy Points for the first tier (0 → 1)
export const FRONTIER_COST_STEP = 2;   // added per tier already owned — a linear, ever-rising sink

/** Legacy-Point cost to buy the NEXT frontier tier, given how many you already own. Pure. */
export function frontierCost(tier: number | undefined): number {
  const t = Math.max(0, Math.floor(tier ?? 0));
  return FRONTIER_BASE_COST + t * FRONTIER_COST_STEP;
}

// Per-tier increments for the LEGACY flat buy (pre-lanes) — deliberately small, so the escalating cost
// (not a cap) governs the pace. Research-forward: the biggest slice is weekly research, a lighter hand
// on hype and build-cost, plus a slow design-ceiling bump every 10 tiers. Tiers a player bought BEFORE
// Frontier Lanes shipped keep exactly this bonus, so every existing save is byte-identical.
const PER_TIER_RP = 0.05;
const PER_TIER_HYPE = 0.02;
const PER_TIER_BUILD = 0.01;
const DESIGN_EVERY = 10;

const ZERO_BONUS: PerkBonus = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 };

function sumBonuses(...bs: PerkBonus[]): PerkBonus {
  const acc = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 };
  for (const b of bs) {
    acc.designCeiling += b.designCeiling;
    acc.hype += b.hype;
    acc.rpMult += b.rpMult;
    acc.buildCostMult += b.buildCostMult;
  }
  return {
    designCeiling: acc.designCeiling,
    hype: +acc.hype.toFixed(4),
    rpMult: +acc.rpMult.toFixed(4),
    buildCostMult: +acc.buildCostMult.toFixed(4),
  };
}

/** The legacy flat bonus for `n` un-laned tiers (the original pre-lanes formula). */
function flatBonus(n: number): PerkBonus {
  const t = Math.max(0, Math.floor(n));
  return {
    designCeiling: Math.floor(t / DESIGN_EVERY),
    hype: +(t * PER_TIER_HYPE).toFixed(4),
    rpMult: +(t * PER_TIER_RP).toFixed(4),
    buildCostMult: +(t * PER_TIER_BUILD).toFixed(4),
  };
}

// ---- Frontier Lanes (feature #6) — pick-a-route specialization instead of a flat "buy next tier" ----
// Each tier you advance is assigned to ONE lane; a lane pushes its own axis harder than the old generalist
// tier did, so the frontier becomes a build-defining choice. Mirrors the Legacy Tree's route grammar.
export type FrontierLaneId = "research" | "market" | "operations" | "design";
export type FrontierLanes = Partial<Record<FrontierLaneId, number>>;

export interface FrontierLane {
  id: FrontierLaneId;
  name: string;
  blurb: string;
  icon: string; // lucide icon name, resolved in the UI
  /** One-line of what each tier in this lane grants (for the card). */
  perTierLabel: string;
}

export const FRONTIER_LANES: readonly FrontierLane[] = [
  { id: "research", name: "Deep R&D", blurb: "Compounding weekly research — the fastest labs in the industry.", icon: "FlaskConical", perTierLabel: "+8% research / tier" },
  { id: "market", name: "Market Reach", blurb: "Every launch lands louder — a standing hype multiplier.", icon: "Megaphone", perTierLabel: "+5% hype / tier" },
  { id: "operations", name: "Frontier Ops", blurb: "Cheaper to build at scale — a standing build-cost cut.", icon: "Factory", perTierLabel: "−3% build cost / tier" },
  { id: "design", name: "Frontier Design", blurb: "Raise the design ceiling faster, with a little hype on the side.", icon: "PencilRuler", perTierLabel: "+1 ceiling / 4 tiers · +1.5% hype" },
] as const;

const DESIGN_LANE_EVERY = 4; // the design lane grants +1 design ceiling every this-many tiers in it

/** Total tiers routed through lanes (0 for a legacy/pre-lanes save). */
export function laneTotal(lanes: FrontierLanes | undefined): number {
  if (!lanes) return 0;
  return (lanes.research ?? 0) + (lanes.market ?? 0) + (lanes.operations ?? 0) + (lanes.design ?? 0);
}

/** The cumulative bonus from all lane allocations. */
function laneBonus(lanes: FrontierLanes): PerkBonus {
  const r = lanes.research ?? 0, m = lanes.market ?? 0, o = lanes.operations ?? 0, d = lanes.design ?? 0;
  return sumBonuses(
    { designCeiling: 0, hype: 0, rpMult: r * 0.08, buildCostMult: 0 },
    { designCeiling: 0, hype: m * 0.05, rpMult: 0, buildCostMult: 0 },
    { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: o * 0.03 },
    { designCeiling: Math.floor(d / DESIGN_LANE_EVERY), hype: d * 0.015, rpMult: 0, buildCostMult: 0 },
  );
}

// ---- Band unlocks (feature #6) — a one-time "you earned something" spike at each 5-tier boundary ----
// Discrete milestones that punctuate the otherwise-linear grind. Cycles endlessly past the table.
export interface FrontierBandUnlock {
  tier: number;   // the total-tier boundary that grants it
  name: string;
  blurb: string;
  bonus: PerkBonus;
}
const BAND_EVERY = 5;
const BAND_UNLOCK_BONUSES: readonly { name: string; blurb: string; bonus: PerkBonus }[] = [
  { name: "Deep Frontier breakthrough", blurb: "+1 design ceiling", bonus: { designCeiling: 1, hype: 0, rpMult: 0, buildCostMult: 0 } },
  { name: "Quantum Frontier breakthrough", blurb: "+10% research", bonus: { designCeiling: 0, hype: 0, rpMult: 0.10, buildCostMult: 0 } },
  { name: "Cosmic Frontier breakthrough", blurb: "+5% hype", bonus: { designCeiling: 0, hype: 0.05, rpMult: 0, buildCostMult: 0 } },
  { name: "Singularity Frontier breakthrough", blurb: "+1 design ceiling & −3% build cost", bonus: { designCeiling: 1, hype: 0, rpMult: 0, buildCostMult: 0.03 } },
];

/** The band unlock granted at a given band index (1-based) — cycles the table endlessly. */
export function frontierBandUnlockAt(band: number): FrontierBandUnlock {
  const b = Math.max(1, Math.floor(band));
  const spec = BAND_UNLOCK_BONUSES[(b - 1) % BAND_UNLOCK_BONUSES.length];
  return { tier: b * BAND_EVERY, name: spec.name, blurb: spec.blurb, bonus: spec.bonus };
}

/** The number of band boundaries crossed at `tier` total tiers. */
export function frontierBandsCrossed(tier: number | undefined): number {
  return Math.floor(Math.max(0, Math.floor(tier ?? 0)) / BAND_EVERY);
}

/** The cumulative one-time bonus from every band boundary crossed ABOVE `sinceTier`. Bands whose
 *  boundary falls at or below `sinceTier` are excluded, so a legacy (pre-lanes) save doesn't retroactively
 *  collect every historical band bonus the instant it buys its first lane tier — only new frontier
 *  progress earns them. `sinceTier` defaults to 0 (a fully-laned run gets every band it crossed). */
function bandUnlockBonus(tier: number, sinceTier = 0): PerkBonus {
  const first = frontierBandsCrossed(sinceTier) + 1;
  const last = frontierBandsCrossed(tier);
  const parts: PerkBonus[] = [];
  for (let k = first; k <= last; k++) parts.push(frontierBandUnlockAt(k).bonus);
  return parts.length ? sumBonuses(...parts) : ZERO_BONUS;
}

/** The NEXT band unlock a player is working toward (for the "reach tier X" line). */
export function nextFrontierBandUnlock(tier: number | undefined): FrontierBandUnlock {
  return frontierBandUnlockAt(frontierBandsCrossed(tier) + 1);
}

/** The cumulative PerkBonus from owning `tier` frontier levels. Backward compatible:
 *  - No `lanes` (legacy/pre-lanes save, or the neutral no-op): EXACTLY the old flat formula, so every
 *    existing save and the pinned solo sim (never IPOs) stay byte-identical.
 *  - With `lanes`: the tiers that predate lanes keep the flat bonus, lane tiers add their route's boon,
 *    and every 5-tier band boundary crossed adds its one-time unlock spike. Pure. */
export function frontierBonuses(tier: number | undefined, lanes?: FrontierLanes): PerkBonus {
  const t = Math.max(0, Math.floor(tier ?? 0));
  const laneN = laneTotal(lanes);
  if (laneN === 0) return flatBonus(t); // legacy path — untouched
  const legacyTiers = Math.max(0, t - laneN); // pre-lane tiers keep the flat bonus
  // Band unlocks only for boundaries ABOVE the legacy tiers — a pre-lanes save that starts routing
  // shouldn't bank every historical breakthrough at once.
  return sumBonuses(flatBonus(legacyTiers), laneBonus(lanes!), bandUnlockBonus(t, legacyTiers));
}

// Flavor: the frontier gets a grander name every 5 tiers. Purely cosmetic (drives the label only).
export const FRONTIER_BANDS = ["Frontier", "Deep Frontier", "Quantum Frontier", "Cosmic Frontier", "Singularity Frontier"] as const;

/** The band name for a given owned-tier count. Tier 0 is still called "Frontier" (the entry rung). */
export function frontierBandName(tier: number | undefined): string {
  const t = Math.max(0, Math.floor(tier ?? 0));
  if (t <= 0) return FRONTIER_BANDS[0];
  // Switch the label at each 5-tier boundary so it matches the band UNLOCK earned there (tier 5 =
  // "Deep Frontier breakthrough" → the band reads "Deep Frontier").
  const band = Math.min(FRONTIER_BANDS.length - 1, Math.floor(t / BAND_EVERY));
  return FRONTIER_BANDS[band];
}
