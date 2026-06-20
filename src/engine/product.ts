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
 *  what the display tier can actually drive, then SNAPPED to the nearest supported option ≤ that
 *  (so a legacy/odd value like 75 resolves to a real step instead of silently dropping to the 60Hz
 *  baseline via indexOf === -1 — same hardening the storage path already does). */
export function effectiveRefreshRate(product: Product): number {
  const capped = Math.min(product.refreshRate ?? 60, maxRefreshRate(product.tiers.display ?? 1));
  const opts = BALANCE.design.refreshRate.options;
  return opts.reduce((best, cur) => (cur <= capped ? cur : best), opts[0] ?? 60);
}

/** Steps above the 60Hz baseline (0..3) — drives the appeal bump + extra unit cost. */
function refreshSteps(product: Product): number {
  return Math.max(0, BALANCE.design.refreshRate.options.indexOf(effectiveRefreshRate(product)));
}

/** The software/OS tier's max supported storage (GB) — a basic OS can't manage a terabyte. */
export function maxStorage(softwareTier: number): number {
  const caps = BALANCE.design.storage.maxBySoftwareTier;
  return caps[clamp(softwareTier - 1, 0, caps.length - 1)] ?? 128;
}

/** The product's EFFECTIVE storage (GB): chosen value (default 128 for older saves), capped by the
 *  software/OS tier, then SNAPPED to the nearest supported option ≤ that (so a legacy/odd value like
 *  300 still resolves to a real tier instead of silently dropping to baseline via indexOf === -1). */
export function effectiveStorage(product: Product): number {
  const capped = Math.min(product.storage ?? 128, maxStorage(product.tiers.software ?? 1));
  const opts = BALANCE.design.storage.options;
  return opts.reduce((best, cur) => (cur <= capped ? cur : best), opts[0] ?? 128);
}

/** Steps above the 128GB baseline (0..3) — appeal bump + extra unit cost. */
function storageSteps(product: Product): number {
  return Math.max(0, BALANCE.design.storage.options.indexOf(effectiveStorage(product)));
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

  // Storage: more on-board capacity lifts the platform's ecosystem appeal + perceived quality.
  const stSteps = storageSteps(product);
  if (stSteps > 0) {
    const a = BALANCE.design.storage.appeal;
    stats.ecosystem += stSteps * a.ecosystem;
    stats.quality += stSteps * a.quality;
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
  // More storage adds a per-unit cost per step above the 128GB baseline.
  for (let i = 0; i < storageSteps(product); i++) costs.push(BALANCE.design.storage.unitCost);
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
  // Clamp the chosen tier to its line's range before normalising: a corrupt/forward-compat save
  // with an out-of-range tier would otherwise push level > 1 and skew the mean / weak-link readout.
  const levels = slots.map((kind) => {
    const max = maxTier(kind);
    return { kind, level: max > 0 ? clamp(product.tiers[kind] ?? 0, 0, max) / max : 0 };
  });
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
