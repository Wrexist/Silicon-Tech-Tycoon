// Product stat computation + build cost. PURE.
import { BALANCE } from "./balance.ts";
import { CATEGORIES, tierDef } from "./catalogs.ts";
import { sum, type Money, ZERO } from "./money.ts";
import {
  STAT_KEYS,
  type Product,
  type Stats,
  type ComponentKind,
} from "./types.ts";

export function emptyStats(): Stats {
  return { performance: 0, quality: 0, battery: 0, design: 0, ecosystem: 0 };
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Compute a product's five stats from its selected component tiers + design tier.
 * Only the category's applicable slots count. Design tier nudges the Design stat
 * (representing designer effort/skill), clamped to statMax.
 */
export function computeStats(product: Product): Stats {
  const cat = CATEGORIES[product.category];
  const stats = emptyStats();

  for (const kind of cat.slots) {
    const tier = product.tiers[kind];
    if (!tier) continue;
    const def = tierDef(kind, tier);
    if (!def) continue;
    // More camera lenses improve the photography feature (scales the camera contribution).
    const factor =
      kind === "camera"
        ? BALANCE.design.cameraCountFactor[clamp(product.camera?.count ?? 2, 1, 4) - 1]
        : 1;
    for (const key of STAT_KEYS) {
      const add = def.contributes[key];
      if (add) stats[key] += add * factor;
    }
  }

  // Design tier contribution (1 = baseline, no bonus).
  stats.design += (product.designTier - 1) * 6;

  for (const key of STAT_KEYS) {
    stats[key] = Math.round(clamp(stats[key], 0, BALANCE.statMax));
  }
  return stats;
}

/** Per-unit build cost = sum of selected component unit costs + extra camera lenses. */
export function buildCost(product: Product): Money {
  const cat = CATEGORIES[product.category];
  const costs: Money[] = [];
  for (const kind of cat.slots) {
    const tier = product.tiers[kind];
    if (!tier) continue;
    const def = tierDef(kind, tier);
    if (def) costs.push(def.unitCost);
  }
  if (cat.slots.includes("camera")) {
    const extra = Math.max(0, clamp(product.camera?.count ?? 2, 1, 4) - 1);
    for (let i = 0; i < extra; i++) costs.push(BALANCE.design.extraLensCost);
  }
  return costs.length ? sum(costs) : ZERO;
}

/** Which component slots are still unset for this category. */
export function missingSlots(product: Product): ComponentKind[] {
  return CATEGORIES[product.category].slots.filter((k) => !product.tiers[k]);
}

/** A single 0..100 "overall" score, weighted by the category's emphasis. */
export function overallScore(stats: Stats, category: Product["category"]): number {
  const emphasis = CATEGORIES[category].statEmphasis;
  let wSum = 0;
  let acc = 0;
  for (const key of STAT_KEYS) {
    const w = emphasis[key] ?? 0.7;
    wSum += w;
    acc += w * stats[key];
  }
  return Math.round(acc / wSum);
}
