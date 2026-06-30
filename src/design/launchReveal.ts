// Launch-reveal event bus + payload builder. A launch fires emitLaunchReveal(); the <LaunchReveal/>
// overlay (mounted once in App) subscribes and plays the keynote-style reveal. Module singleton, same
// fire-and-forget pattern as celebrateFx/spendFx — no prop drilling, no re-renders on the bus itself.
import { criticReviews, type OutletScore } from "../engine/reviews.ts";
import { postMortem } from "../engine/postmortem.ts";
import { forecastStanding, type ForecastStanding } from "../engine/forecast.ts";
import type { LaunchInsight, Product, Stats } from "../engine/types.ts";
import type { LaunchVerdict } from "./launchFeedback.ts";

export interface LaunchRevealData {
  product: Product;        // for the device render
  verdict: LaunchVerdict;
  aggregate: number;       // 0..100 critic aggregate
  outlets: OutletScore[];  // 3 fictional outlet scores
  headline: string;        // pull-quote
  /** C2: the postmortem "why" (e.g. "Won on Design + price; hurt by 1 stronger rival"), the same
   *  analysis the Market detail shows. One tasteful line under the verdict. Absent if no insight. */
  why?: string;
  units: number;           // projected first-run sales
  /** C6: how this launch's projected sales land against the band promised at build (within / above /
   *  below). Null when the product carries no stashed band (older save). */
  forecastStanding?: ForecastStanding | null;
  isHit: boolean;
  firstLaunch: boolean;    // the company's very first product — gets a special beat
  streak: number;          // consecutive hits incl. this launch (>=2 escalates the celebration)
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
  /** The recorded launch insight (drivers behind the verdict). When present, the reveal carries the
   *  postmortem "why" line (the SAME analysis Market shows, so the two never disagree). */
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
    why: args.insight ? postMortem(args.insight, args.verdict).headline : undefined,
    units: args.units,
    forecastStanding: forecastStanding(args.units, args.product.forecast),
    isHit: args.isHit,
    firstLaunch: args.firstLaunch,
    streak: args.streak ?? 0,
  };
}
