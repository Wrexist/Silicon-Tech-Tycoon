// Market fatigue / novelty. The market won't reward shipping the same product again with only
// minimal changes shortly after the last one: a follow-up that's too SIMILAR to a recent
// same-category launch loses organic market demand ("we just bought that"). Real spec upgrades
// (bumping component tiers) OR enough elapsed time clear it. PURE.
//
// This dampens ONLY organic market demand — fans still pre-order (handled by the caller), so a
// loyal base buys the sequel while the broad market shrugs at a rehash. It complements
// competition.selfPenalty (your active products splitting buyers NOW) by penalising sameness over
// TIME, even against products that have stopped selling.
import { BALANCE } from "./balance.ts";
import type { ComponentKind, Product } from "./types.ts";

const TIER_SLOTS: readonly ComponentKind[] = ["chip", "display", "battery", "materials", "software", "camera"];

/** Spec similarity between two products, 0..1 (1 = identical loadout). Different category → 0, so a
 *  tablet after a phone is always "new". Dominated by component tiers (the "stuff"), with a small
 *  contribution from design tier. */
export function productSimilarity(a: Product, b: Product): number {
  if (a.category !== b.category) return 0;
  const span = Math.max(1, BALANCE.novelty.tierSpan);
  let acc = 0;
  let n = 0;
  for (const k of TIER_SLOTS) {
    const ta = a.tiers[k];
    const tb = b.tiers[k];
    if (ta == null && tb == null) continue;
    acc += 1 - Math.min(1, Math.abs((ta ?? 0) - (tb ?? 0)) / span);
    n++;
  }
  const tierSim = n ? acc / n : 0;
  const designSim = 1 - Math.min(1, Math.abs((a.designTier ?? 1) - (b.designTier ?? 1)) / span);
  return Math.max(0, Math.min(1, tierSim * 0.9 + designSim * 0.1));
}

export interface NoveltyResult {
  /** 0..1 organic-demand multiplier (1 = fully fresh, no fatigue). */
  mult: number;
  /** Name of the most fatiguing recent product (the one driving the cut), if any. */
  similarTo?: string;
  /** Weeks since that product launched. */
  weeksAgo?: number;
  /** 0..1 similarity to that product. */
  similarity?: number;
}

/** How much recent, too-similar launches dampen organic demand for `product`. Pass your launched
 *  history (anything with a product + launchedWeek); the most fatiguing match drives the result. */
export function noveltyFor(
  product: Product,
  history: readonly { product: Product; launchedWeek: number }[],
  currentWeek: number,
): NoveltyResult {
  const nb = BALANCE.novelty;
  let worst = 0;
  let result: NoveltyResult = { mult: 1 };
  for (const lp of history) {
    if (lp.product.id === product.id) continue; // never compare a product to itself
    if (lp.product.category !== product.category) continue;
    const weeksAgo = currentWeek - lp.launchedWeek;
    if (weeksAgo < 0 || weeksAgo >= nb.fatigueWeeks) continue;
    const sim = productSimilarity(product, lp.product);
    // Only products above the floor read as "too similar"; remap floor→0, identical→1.
    const over = sim <= nb.similarityFloor ? 0 : (sim - nb.similarityFloor) / (1 - nb.similarityFloor);
    if (over <= 0) continue;
    const recency = 1 - weeksAgo / nb.fatigueWeeks; // 1 just-released → 0 at the window edge
    const fatigue = over * recency;
    if (fatigue > worst) {
      worst = fatigue;
      result = { mult: 1, similarTo: lp.product.name, weeksAgo, similarity: sim };
    }
  }
  result.mult = Math.max(1 - nb.maxPenalty, 1 - worst * nb.maxPenalty);
  return result;
}
