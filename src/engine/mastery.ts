// Category Mastery — per-category progression earned by SHIPPING in each of the ten device
// categories (FEATURES_RANKED #3). Mastery is derived ENTIRELY from the existing state.launched[]
// history (no new persisted counters), so it self-heals and can never drift out of sync. Levelling a
// category grants a SMALL, category-scoped bonus (cheaper build, a touch more design appeal, a little
// launch hype) that applies only to products IN that category, and level 5 unlocks a cosmetic-only
// signature flourish. PURE — no GameState, no RNG.
import type { CategoryId, LaunchedProduct, Stats } from "./types.ts";
import { CATEGORY_LIST } from "./catalogs.ts";

/** Levels 1..5 — level 0 is "not yet started". */
export const MASTERY_MAX_LEVEL = 5;

/** Points a single launch contributes to its category's mastery. A shipped product is always worth
 *  the base; a "solid"/"hit" verdict adds a quality bonus on top, so mastery rewards good launches
 *  faster than churning flops (but every launch still counts). */
export const MASTERY_POINTS = {
  base: 1,  // any launch, whatever the verdict
  solid: 1, // additional for a "solid" verdict  → 2 total
  hit: 2,   // additional for a "hit" verdict    → 3 total
} as const;

/** Cumulative point thresholds for levels 1..5. Deliberately conservative: level 5 in ONE category is
 *  15 points — 15 launches if they all flopped, ~8 if all solid, 5 if all hits — and there are TEN
 *  categories, so mastering the whole board is a genuine long-run breadth grind, not a single run. */
export const MASTERY_THRESHOLDS: readonly number[] = [1, 3, 6, 10, 15];

/** Per-level, category-scoped bonus increments. Capped low so mastery NEVER outclasses perks/legacy:
 *  at level 5 → −5% build cost, +2 design appeal, +5% launch hype — all only for that category. */
export const MASTERY_PER_LEVEL = {
  buildCostMult: 0.01, // fractional build-cost REDUCTION per level (0.05 at L5)
  design: 0.4,         // + design appeal per level (2.0 at L5)
  hype: 0.01,          // + fractional launch hype per level (0.05 at L5)
} as const;

/** The category-scoped modifier applied to a product's build/launch. Same shape everywhere it's read. */
export interface MasteryBonus {
  buildCostMult: number; // fractional build-cost reduction for this category (0.05 = −5%)
  design: number;        // + design appeal for this category's products
  hype: number;          // + fractional launch hype for this category's launches
}

export const ZERO_MASTERY_BONUS: MasteryBonus = { buildCostMult: 0, design: 0, hype: 0 };

export interface CategoryMasteryState {
  points: number;
  level: number;
  launches: number;
}

/** Points a single launch is worth, from its recorded verdict. Unknown/absent verdict → base only. */
export function pointsForLaunch(verdict?: LaunchedProduct["verdict"]): number {
  if (verdict === "hit") return MASTERY_POINTS.base + MASTERY_POINTS.hit;
  if (verdict === "solid") return MASTERY_POINTS.base + MASTERY_POINTS.solid;
  return MASTERY_POINTS.base; // flop / steady / undefined
}

/** The level (0..5) a running point total has reached. */
export function levelForPoints(points: number): number {
  let level = 0;
  for (const t of MASTERY_THRESHOLDS) if (points >= t) level++;
  return level;
}

/** The point total needed to reach the NEXT level, or null if already maxed. */
export function nextThreshold(level: number): number | null {
  if (level >= MASTERY_MAX_LEVEL) return null;
  return MASTERY_THRESHOLDS[level];
}

/** Point total accrued in ONE category from the launch history (single pass — cheap for the hot
 *  build/launch seams that only need one category). */
export function categoryPoints(launched: readonly LaunchedProduct[], category: CategoryId): number {
  let pts = 0;
  for (const lp of launched) {
    if (lp?.product?.category === category) pts += pointsForLaunch(lp.verdict);
  }
  return pts;
}

/** The mastery level (0..5) reached in ONE category — the value the bonus seams read. */
export function categoryLevelOf(launched: readonly LaunchedProduct[], category: CategoryId): number {
  return levelForPoints(categoryPoints(launched, category));
}

/** Full per-category mastery table derived from the launch history — every category present (0 if
 *  never shipped), for the surfacing UI. */
export function categoryMastery(
  launched: readonly LaunchedProduct[],
): Record<CategoryId, CategoryMasteryState> {
  const out = {} as Record<CategoryId, CategoryMasteryState>;
  for (const c of CATEGORY_LIST) out[c.id] = { points: 0, level: 0, launches: 0 };
  for (const lp of launched) {
    const cat = lp?.product?.category as CategoryId | undefined;
    if (!cat || !out[cat]) continue;
    out[cat].points += pointsForLaunch(lp.verdict);
    out[cat].launches += 1;
  }
  for (const c of CATEGORY_LIST) out[c.id].level = levelForPoints(out[c.id].points);
  return out;
}

/** The category-scoped bonus for a given mastery level. Level is clamped to 0..MAX, so it can never
 *  exceed the L5 cap however it's called. Level 0 → all-zero (exactly), so a disabled/unstarted
 *  category is a byte-exact no-op at every seam. */
export function masteryBonusForLevel(level: number): MasteryBonus {
  const l = Math.max(0, Math.min(MASTERY_MAX_LEVEL, Math.floor(level || 0)));
  if (l === 0) return ZERO_MASTERY_BONUS;
  return {
    buildCostMult: MASTERY_PER_LEVEL.buildCostMult * l,
    design: MASTERY_PER_LEVEL.design * l,
    hype: MASTERY_PER_LEVEL.hype * l,
  };
}

/** A single level's grant, for the "what each level gives" preview in the Mastery view. */
export function masteryLevelGrant(level: number): MasteryBonus {
  return masteryBonusForLevel(level);
}

// ---------- Signatures (cosmetic-only, unlocked at level 5) ------------------------------------

/** The signature flourish a maxed category unlocks — a named "signature edition" title (naming flair)
 *  and an accent colour token used to highlight the category in pickers. Cosmetic only: NO stat or
 *  economic effect (the balance guards never see it). Data-only, one entry per category. */
export interface CategorySignature {
  /** The signature-edition name a maxed founder has earned for this line (naming flair). */
  edition: string;
  /** One-line description of the flourish, for the Mastery view preview. */
  blurb: string;
}

export const CATEGORY_SIGNATURES: Record<CategoryId, CategorySignature> = {
  phone: { edition: "Signature", blurb: "A gold-accented Signature edition badge for your phones." },
  tablet: { edition: "Canvas", blurb: "The Canvas signature finish for your tablets." },
  laptop: { edition: "Studio", blurb: "A Studio signature edition mark for your laptops." },
  desktop: { edition: "Workstation", blurb: "The Workstation signature crest for your desktops." },
  monitor: { edition: "Reference", blurb: "A Reference signature grade for your monitors." },
  console: { edition: "Arcade", blurb: "The Arcade signature edition for your consoles." },
  wearable: { edition: "Couture", blurb: "A Couture signature finish for your wearables." },
  experimental: { edition: "Visionary", blurb: "The Visionary signature edition for your AR glasses." },
  neuralband: { edition: "Synapse", blurb: "A Synapse signature mark for your neural bands." },
  robot: { edition: "Companion", blurb: "The Companion signature edition for your home robots." },
};

/** Is this category's signature unlocked (mastery level 5 reached)? Pure over the launch history. */
export function signatureUnlocked(launched: readonly LaunchedProduct[], category: CategoryId): boolean {
  return categoryLevelOf(launched, category) >= MASTERY_MAX_LEVEL;
}

/** Every category whose signature is unlocked, for the museum/collection style "what have I mastered"
 *  read. */
export function unlockedSignatures(launched: readonly LaunchedProduct[]): CategoryId[] {
  return CATEGORY_LIST.filter((c) => signatureUnlocked(launched, c.id)).map((c) => c.id);
}

/** Convenience for the design bonus injection point — the design appeal (points) a category's mastery
 *  contributes. Kept typed as a Stats-partial-friendly number. */
export function masteryDesignPoints(level: number): Stats["design"] {
  return masteryBonusForLevel(level).design;
}
