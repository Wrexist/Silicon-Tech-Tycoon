// Product stat computation + build cost. PURE.
import { BALANCE } from "./balance.ts";
import { CATEGORIES, tierDef, maxTier } from "./catalogs.ts";
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

/** The display tier's max drivable refresh rate (Hz) — a budget panel can't push 144Hz. */
export function maxRefreshRate(displayTier: number): number {
  const caps = BALANCE.design.refreshRate.maxByDisplayTier;
  return caps[clamp(displayTier - 1, 0, caps.length - 1)] ?? 60;
}

/** The product's EFFECTIVE refresh rate: the chosen value (default 60 for older saves), capped by
 *  what the display tier can actually drive. */
export function effectiveRefreshRate(product: Product): number {
  return Math.min(product.refreshRate ?? 60, maxRefreshRate(product.tiers.display ?? 1));
}

/** Steps above the 60Hz baseline (0..3) — drives the appeal bump + extra unit cost. */
function refreshSteps(product: Product): number {
  return Math.max(0, BALANCE.design.refreshRate.options.indexOf(effectiveRefreshRate(product)));
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

  // Refresh rate: a fluid, high-Hz screen reads as fast + premium (gated by the display tier).
  const hzSteps = refreshSteps(product);
  if (hzSteps > 0) {
    const ap = BALANCE.design.refreshRate.appealPerStep;
    stats.performance += hzSteps * ap;
    stats.design += hzSteps * ap * 0.5;
  }

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
  // Higher refresh rate adds a per-unit cost per step above 60Hz.
  for (let i = 0; i < refreshSteps(product); i++) costs.push(BALANCE.design.refreshRate.unitCost);
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

/**
 * Component-combination synergy: a product is judged on its WEAKEST link, not just the sum of parts
 * (pillar #5 — the combination of components should matter, not just maxing each slot). Each
 * applicable slot's chosen tier is normalised to 0..1 of its line's range; a coherent build keeps
 * the factor ≈ 1, a flagship dragged down by one budget component is penalised, and a balanced
 * high-end build earns a small bonus. Bounded by balance.synergy so it nudges, never dominates.
 * Returns the multiplier plus the weakest slot (for a readable "weak link" callout), or null when
 * the build is coherent enough not to flag one.
 */
export function componentSynergy(product: Product): { factor: number; weakest: ComponentKind | null } {
  const slots = CATEGORIES[product.category].slots;
  const levels = slots.map((kind) => ({ kind, level: maxTier(kind) > 0 ? (product.tiers[kind] ?? 0) / maxTier(kind) : 0 }));
  if (levels.length === 0) return { factor: 1, weakest: null };
  const mean = levels.reduce((a, b) => a + b.level, 0) / levels.length;
  const weakest = levels.reduce((a, b) => (b.level < a.level ? b : a));
  const bottleneck = Math.max(0, mean - weakest.level); // 0..1 — how far the weakest link sits below the build
  const s = BALANCE.market.synergy;
  let factor = 1 - bottleneck * s.bottleneckPenalty;
  if (mean >= s.flagshipMeanFloor && bottleneck <= s.flagshipMaxGap) factor += s.flagshipBonus;
  factor = clamp(factor, s.minFactor, s.maxFactor);
  return { factor, weakest: bottleneck > s.weakestThreshold ? weakest.kind : null };
}
