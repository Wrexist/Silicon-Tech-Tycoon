// Launch-reveal event bus + payload builder. A launch fires emitLaunchReveal(); the <LaunchReveal/>
// overlay (mounted once in App) subscribes and plays the keynote-style reveal. Module singleton, same
// fire-and-forget pattern as celebrateFx/spendFx — no prop drilling, no re-renders on the bus itself.
import { criticReviews, type OutletScore } from "../engine/reviews.ts";
import { topFactorSummary } from "../engine/postmortem.ts";
import { franchiseStem } from "../engine/franchise.ts";
import type { LaunchedProduct, LaunchInsight, Product, Stats } from "../engine/types.ts";
import type { LaunchVerdict } from "./launchFeedback.ts";

export interface LaunchRevealData {
  product: Product;        // for the device render
  verdict: LaunchVerdict;
  aggregate: number;       // 0..100 critic aggregate
  outlets: OutletScore[];  // 3 fictional outlet scores
  headline: string;        // pull-quote
  units: number;           // recorded demand forecast (falls back to the pre-launch projection)
  /** Fans / reputation the launch moved, when known — the consequences that used to live only in the feed. */
  fansGained?: number;
  repGained?: number;
  isHit: boolean;
  firstLaunch: boolean;    // the company's very first product — gets a special beat
  streak: number;          // consecutive hits incl. this launch (>=2 escalates the celebration)
  /** The #1 post-mortem driver ("Biggest factor: …") — the outcome's WHY, surfaced at the moment
   *  it matters most instead of only in the Market detail sheet. Null = nothing decisive. */
  why: string | null;
  /** Critics' aggregate vs the product this one follows (same franchise line, else same category).
   *  Null on a first product in its category. Presentation only. */
  vsPrevious: { name: string; delta: number } | null;
  /** True when this launch out-reviewed every product the company has shipped before (needs ≥1). */
  personalBest: boolean;
}

/** The critics' aggregate a shipped product earned, through the same deterministic engine the Market
 *  detail and the reveal use — so a "vs previous" delta compares like with like. */
export function reviewAggregateOf(lp: LaunchedProduct): number {
  return criticReviews({
    productId: lp.product.id,
    stats: lp.stats,
    verdict: lp.verdict ?? "steady",
    demandFit: lp.insight?.demandFit ?? 60,
    priceFit: lp.insight?.priceFit ?? 1,
    betterRivals: lp.insight?.betterRivals ?? 0,
  }).aggregate;
}

/** The product a new launch is judged against: the latest in its franchise line, else the latest in
 *  its category (`launched` is newest-first). */
export function predecessorOf(product: Product, launchedBefore: readonly LaunchedProduct[]): LaunchedProduct | null {
  const stem = franchiseStem(product.name);
  return (stem ? launchedBefore.find((lp) => franchiseStem(lp.product.name) === stem) : undefined)
    ?? launchedBefore.find((lp) => lp.product.category === product.category)
    ?? null;
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

// Whether the keynote reveal is currently on screen. The reveal is bus-driven (not part of game
// state), so the interrupt overlays (RivalStrike/AwardsCeremony) can't see it via useGame — they
// subscribe here to defer while it's up, instead of mounting invisibly BEHIND it (z58/59 < z60)
// and stealing its Escape/Continue. LaunchReveal owns setting this on show/hide.
let revealActive = false;
const activeListeners = new Set<() => void>();
export function setLaunchRevealActive(v: boolean): void {
  if (revealActive === v) return;
  revealActive = v;
  activeListeners.forEach((fn) => fn());
}
export function isLaunchRevealActive(): boolean {
  return revealActive;
}
export function onLaunchRevealActiveChange(fn: () => void): () => void {
  activeListeners.add(fn);
  return () => activeListeners.delete(fn);
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
  fansGained?: number;
  repGained?: number;
  /** Launch-moment drivers (insightFromPlan) — powers the reveal's "Biggest factor" line. */
  insight?: LaunchInsight;
  /** The shipped history BEFORE this launch (newest-first) — powers "vs previous" + personal best. */
  launchedBefore?: readonly LaunchedProduct[];
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
    fansGained: args.fansGained,
    repGained: args.repGained,
    why: args.insight ? (topFactorSummary(args.insight, args.verdict)?.text ?? null) : null,
    ...compareToHistory(args.product, r.aggregate, args.launchedBefore ?? []),
  };
}

function compareToHistory(product: Product, aggregate: number, before: readonly LaunchedProduct[]): Pick<LaunchRevealData, "vsPrevious" | "personalBest"> {
  if (before.length === 0) return { vsPrevious: null, personalBest: false };
  const prev = predecessorOf(product, before);
  const best = Math.max(...before.map(reviewAggregateOf));
  return {
    vsPrevious: prev ? { name: prev.product.name, delta: aggregate - reviewAggregateOf(prev) } : null,
    personalBest: aggregate > best,
  };
}
