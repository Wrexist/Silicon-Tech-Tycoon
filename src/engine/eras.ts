// Tech-era progression. Advancing unlocks higher component tiers + new categories. PURE.
import { BALANCE } from "./balance.ts";
import { toDollars, type Money } from "./money.ts";
import { CATEGORY_LIST } from "./catalogs.ts";
import type { CategoryId } from "./types.ts";

export function eraName(era: number): string {
  return BALANCE.eras.find((e) => e.era === era)?.name ?? `Era ${era}`;
}

/** Can the company advance from its current era right now? */
export function canAdvanceEra(era: number, reputation: number, cumulativeRevenue: Money): boolean {
  if (era >= maxEra()) return false; // already at the final era — nothing to advance to
  const def = BALANCE.eras.find((e) => e.era === era);
  if (!def || !Number.isFinite(def.repToAdvance)) return false;
  return (
    reputation >= def.repToAdvance ||
    toDollars(cumulativeRevenue) >= toDollars(def.revToAdvance as Money)
  );
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
