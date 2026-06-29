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

/** Authored "what the world looks like now" context per era — flavour, not mechanics (Track A:
 *  narrative & voice). Eras were economically named but never narratively lived; this gives each one
 *  a tagline + a couple of sentences that frame the strategic moment. IP-safe, no real brands/dates.
 *  Consistent with eraModifiers (Platform = ecosystem lock-in; AI = hype-driven + volatile). */
export interface EraContext {
  tagline: string;
  story: string;
}
const ERA_CONTEXT: Record<number, EraContext> = {
  1: {
    tagline: "Two builders and a bench.",
    story: "Nobody knows your name yet, and that is your edge. The giants are not watching, so a clever device can punch far above its budget. Reputation is the only currency that compounds. Ship something people remember.",
  },
  2: {
    tagline: "The market notices you.",
    story: "Your first hits bought a seat at the table. The majors are watching now, retail wants shelf space, and every launch is measured against the incumbents. Scale up without losing what made you worth noticing.",
  },
  3: {
    tagline: "Own the stack, not just the device.",
    story: "Hardware is table stakes. The winners bind customers with ecosystems: services, accounts, lock-in. Your OS and installed base are starting to be worth more than any single product you ship.",
  },
  4: {
    tagline: "The frontier rewrites the rules.",
    story: "On-device intelligence resets the board. Hype moves faster and cuts deeper, demand swings hard, and yesterday's winning playbook ages overnight. Bet boldly, defend what you have built, or be left behind.",
  },
};

/** Authored narrative context for an era (clamped). Index by era number, not era-1. */
export function eraContext(era: number): EraContext {
  return ERA_CONTEXT[Math.max(1, Math.min(Math.round(era), BALANCE.eras.length))] ?? ERA_CONTEXT[1];
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
