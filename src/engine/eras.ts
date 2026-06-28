// Tech-era progression. Advancing unlocks higher component tiers + new categories. PURE.
import { BALANCE } from "./balance.ts";
import { toDollars, type Money } from "./money.ts";
import { CATEGORY_LIST } from "./catalogs.ts";
import type { CategoryId } from "./types.ts";

export function eraName(era: number): string {
  return BALANCE.eras.find((e) => e.era === era)?.name ?? `Era ${era}`;
}

/** Era-distinct mechanic modifiers (Epic D), clamped to the table. Index = era − 1. The Garage +
 *  Growth eras are 1.0 (baseline); the Platform + AI eras shift the economy's texture. */
export function eraModifier(era: number): { marketingHype: number; ecosystemRate: number; demandVariance: number; toolingMult: number; leadWeeks: number } {
  const mods = BALANCE.eraModifiers;
  return mods[Math.max(0, Math.min(Math.floor(era) - 1, mods.length - 1))];
}

/** Plain-language summary of what the given era changes vs. the baseline (for a legible readout). */
export function eraRuleSummary(era: number): string | null {
  const m = eraModifier(era);
  const bits: string[] = [];
  if (m.ecosystemRate > 1) bits.push("ecosystem services pay more");
  if (m.marketingHype > 1) bits.push("marketing reaches further");
  if (m.demandVariance > 1) bits.push("demand is more volatile");
  if (m.toolingMult > 1) bits.push("products cost more to tool up");
  if (m.leadWeeks > 0) bits.push("builds take longer");
  return bits.length ? bits.join(" · ") : null;
}

/** Can the company advance from its current era right now? */
export function canAdvanceEra(era: number, reputation: number, cumulativeRevenue: Money): boolean {
  if (era >= maxEra()) return false; // already at the final era — nothing to advance to
  const def = BALANCE.eras.find((e) => e.era === era);
  if (!def || !Number.isFinite(def.repToAdvance)) return false;
  const repOk = reputation >= def.repToAdvance;
  const revOk = toDollars(cumulativeRevenue) >= toDollars(def.revToAdvance as Money);
  // Era 1→2: either reputation or revenue (early milestone — reward getting off the ground).
  // Era 2+: both required — no shortcuts once you're in the growth phase.
  return era === 1 ? (repOk || revOk) : (repOk && revOk);
}

export function maxEra(): number {
  return BALANCE.eras[BALANCE.eras.length - 1].era;
}

/** Categories unlocked at or below the given era. */
export function unlockedCategories(era: number): CategoryId[] {
  return CATEGORY_LIST.filter((c) => c.unlockEra <= era).map((c) => c.id);
}

export function isCategoryUnlocked(category: CategoryId, era: number): boolean {
  const cat = CATEGORY_LIST.find((c) => c.id === category);
  return !!cat && cat.unlockEra <= era;
}
