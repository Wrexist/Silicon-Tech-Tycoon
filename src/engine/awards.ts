// The Silicon Awards — an annual industry ceremony judging EVERY launch of the past year, the
// player's and the rivals' alike (rival releases are fully rendered products with real scores,
// so the field is honest). PURE + deterministic: a fold over data already in state, zero RNG —
// the ceremony can never disturb the pinned sim. Rewards apply only via the player-opt-in
// collectAwards reducer.
import type { CategoryId, LaunchedProduct, Product, Stats } from "./types.ts";
import type { RivalRelease } from "./rivalAI.ts";
import { overallScore } from "./product.ts";
import { styleAppeal } from "./aesthetics.ts";
import { toDollars } from "./money.ts";
import { rivalDef } from "./competitors.ts";

export type AwardCategoryId = "device" | "design" | "value";

export interface AwardWinner {
  categoryId: AwardCategoryId;
  title: string;
  productName: string;
  companyName: string;
  byPlayer: boolean;
  /** The judged score, rounded for display (overall / style appeal / value index). */
  score: number;
  category: CategoryId;
}

export interface AwardsCeremony {
  /** 1-based award year (week 52 → year 1). */
  year: number;
  week: number;
  winners: AwardWinner[];
  playerWins: number;
  /** How many products competed (player + rival), for the "field of N" line. */
  fieldSize: number;
}

interface Entry {
  productName: string;
  companyName: string;
  byPlayer: boolean;
  category: CategoryId;
  product: Product;
  stats: Stats | null; // player entries carry launch stats; rivals are judged on `overall`
  overall: number;
  /** Device-of-the-Year floor: an ESTABLISHED brand's device is judged at least at flagship
   *  caliber (brand reputation), so a no-name garage startup can't win the top prize over
   *  Pomelo/Oqular with a merely-decent first device. 0 for the player + unknown challengers. */
  deviceFloor: number;
}

const TITLES: Record<AwardCategoryId, string> = {
  device: "Device of the Year",
  design: "Design of the Year",
  value: "Value Champion",
};

/** Judge the award year ending at `week` (inclusive; the past 52 weeks). Returns null when nobody
 *  launched anything — no field, no ceremony. Ties break toward the PLAYER (the home crowd), then
 *  by name for full determinism. */
export function judgeAwards(
  week: number,
  launched: readonly LaunchedProduct[],
  rivalReleases: readonly RivalRelease[],
  companyName: string,
): AwardsCeremony | null {
  const from = week - 51;
  const entries: Entry[] = [];
  for (const lp of launched) {
    if (lp.launchedWeek < from || lp.launchedWeek > week) continue;
    entries.push({
      productName: lp.product.name,
      companyName,
      byPlayer: true,
      category: lp.product.category,
      product: lp.product,
      stats: lp.stats,
      overall: overallScore(lp.stats, lp.product.category),
      deviceFloor: 0,
    });
  }
  for (const r of rivalReleases) {
    if (r.week < from || r.week > week) continue;
    entries.push({
      productName: r.product.name,
      companyName: r.rivalName,
      byPlayer: false,
      category: r.category,
      product: r.product,
      stats: null,
      overall: r.overall,
      // 0.85 × brand reputation: high enough that an unknown startup can't take Device of the Year
      // early (Pomelo rep 72 → floor 61), low enough that a genuinely flagship device (overall >60s)
      // still wins it — a real mid-game milestone instead of a Year-1 freebie.
      deviceFloor: Math.round((rivalDef(r.rivalId)?.reputation ?? 0) * 0.85),
    });
  }
  if (entries.length === 0) return null;

  const pick = (categoryId: AwardCategoryId, score: (e: Entry) => number): AwardWinner | null => {
    let best: Entry | null = null;
    let bestScore = -Infinity;
    for (const e of entries) {
      const s = score(e);
      if (!Number.isFinite(s)) continue;
      if (
        s > bestScore ||
        (s === bestScore && best !== null && !best.byPlayer && e.byPlayer) ||
        (s === bestScore && best !== null && best.byPlayer === e.byPlayer && e.productName < best.productName)
      ) {
        best = e;
        bestScore = s;
      }
    }
    if (!best) return null;
    return {
      categoryId,
      title: TITLES[categoryId],
      productName: best.productName,
      companyName: best.companyName,
      byPlayer: best.byPlayer,
      score: Math.round(bestScore),
      category: best.category,
    };
  };

  const winners = [
    pick("device", (e) => Math.max(e.overall, e.deviceFloor)),
    pick("design", (e) => styleAppeal(e.product)),
    // Value = quality per dollar, scaled to a readable index. Guarded against free/corrupt prices.
    pick("value", (e) => (toDollars(e.product.price) > 0 ? (e.overall / toDollars(e.product.price)) * 100 : Number.NaN)),
  ].filter((w): w is AwardWinner => w !== null);
  if (winners.length === 0) return null;

  return {
    year: Math.floor(week / 52),
    week,
    winners,
    playerWins: winners.filter((w) => w.byPlayer).length,
    fieldSize: entries.length,
  };
}
