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

// Per-tier increments — deliberately small, so the escalating cost (not a cap) governs the pace. The
// bonus is research-forward ("better tech, faster"): the biggest slice is weekly research, with a
// lighter hand on hype and build-cost, plus a slow design-ceiling bump every 10 tiers for a long spike.
const PER_TIER_RP = 0.05;
const PER_TIER_HYPE = 0.02;
const PER_TIER_BUILD = 0.01;
const DESIGN_EVERY = 10;

/** The cumulative PerkBonus from owning `tier` frontier levels. undefined/0 → the neutral all-zero
 *  bonus, so this is a pure no-op until the first tier is bought. Pure. */
export function frontierBonuses(tier: number | undefined): PerkBonus {
  const t = Math.max(0, Math.floor(tier ?? 0));
  return {
    designCeiling: Math.floor(t / DESIGN_EVERY),
    hype: +(t * PER_TIER_HYPE).toFixed(4),
    rpMult: +(t * PER_TIER_RP).toFixed(4),
    buildCostMult: +(t * PER_TIER_BUILD).toFixed(4),
  };
}

// Flavor: the frontier gets a grander name every 5 tiers. Purely cosmetic (drives the label only).
export const FRONTIER_BANDS = ["Frontier", "Deep Frontier", "Quantum Frontier", "Cosmic Frontier", "Singularity Frontier"] as const;

/** The band name for a given owned-tier count. Tier 0 is still called "Frontier" (the entry rung). */
export function frontierBandName(tier: number | undefined): string {
  const t = Math.max(0, Math.floor(tier ?? 0));
  if (t <= 0) return FRONTIER_BANDS[0];
  const band = Math.min(FRONTIER_BANDS.length - 1, Math.floor((t - 1) / 5));
  return FRONTIER_BANDS[band];
}
