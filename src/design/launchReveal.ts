// Launch-reveal event bus + payload builder. A launch fires emitLaunchReveal(); the <LaunchReveal/>
// overlay (mounted once in App) subscribes and plays the keynote-style reveal. Module singleton, same
// fire-and-forget pattern as celebrateFx/spendFx — no prop drilling, no re-renders on the bus itself.
import { criticReviews, type OutletScore } from "../engine/reviews.ts";
import { topFactorSummary } from "../engine/postmortem.ts";
import type { LaunchInsight, Product, Stats } from "../engine/types.ts";
import type { LaunchVerdict } from "./launchFeedback.ts";

export interface LaunchRevealData {
  product: Product;        // for the device render
  verdict: LaunchVerdict;
  aggregate: number;       // 0..100 critic aggregate
  outlets: OutletScore[];  // 3 fictional outlet scores
  headline: string;        // pull-quote
  units: number;           // projected first-run sales
  isHit: boolean;
  firstLaunch: boolean;    // the company's very first product — gets a special beat
  streak: number;          // consecutive hits incl. this launch (>=2 escalates the celebration)
  /** The #1 post-mortem driver ("Biggest factor: …") — the outcome's WHY, surfaced at the moment
   *  it matters most instead of only in the Market detail sheet. Null = nothing decisive. */
  why: string | null;
}

type Listener = (d: LaunchRevealData) => void;
const listeners = new Set<Listener>();

export function onLaunchReveal(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitLaunchReveal(d: LaunchRevealData): void {
  listeners.forEach((fn) => fn(d));
}

/** Build the reveal payload from launch-moment data (pre-launch plan + the recorded verdict). Pure;
 *  reuses the deterministic criticReviews engine so the scores match the product's detail screen. */
export function buildLaunchReveal(args: {
  product: Product;
  stats: Stats;
  verdict: LaunchVerdict;
  demandFit: number;
  priceFit: number;
  betterRivals: number;
  units: number;
  isHit: boolean;
  firstLaunch: boolean;
  streak?: number;
  /** Launch-moment drivers (insightFromPlan) — powers the reveal's "Biggest factor" line. */
  insight?: LaunchInsight;
}): LaunchRevealData {
  const r = criticReviews({
    productId: args.product.id,
    stats: args.stats,
    verdict: args.verdict,
    demandFit: args.demandFit,
    priceFit: args.priceFit,
    betterRivals: args.betterRivals,
  });
  return {
    product: args.product,
    verdict: args.verdict,
    aggregate: r.aggregate,
    outlets: r.outlets,
    headline: r.headline,
    units: args.units,
    isHit: args.isHit,
    firstLaunch: args.firstLaunch,
    streak: args.streak ?? 0,
    why: args.insight ? (topFactorSummary(args.insight, args.verdict)?.text ?? null) : null,
  };
}
