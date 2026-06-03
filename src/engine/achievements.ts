// Achievements / milestones — PURE data + a pure evaluator. No React/DOM, fully unit-tested.
//
// Philosophy (premium, no FOMO): these are celebratory milestones the player DISCOVERS by playing
// well, never a checklist that pesters. Every predicate reads ONLY from data the engine already
// tracks (launched[], cumulativeRevenue, reputation, fans, era, holdings, listed, net worth) — we
// never invent state. The evaluator is monotonic: once earned, an id stays earned (the caller keeps
// the union), so an achievement can never "un-unlock".
import type { GameState } from "../state/gameState.ts";
import { netWorth } from "../state/gameState.ts";
import { toDollars } from "./money.ts";
import { maxEra } from "./eras.ts";

/** A Lucide icon NAME (resolved to a component in the UI layer — engine stays DOM-free). */
export type AchievementIconName =
  | "Rocket"
  | "Sparkles"
  | "Boxes"
  | "Factory"
  | "Building2"
  | "Layers"
  | "Cpu"
  | "BadgeDollarSign"
  | "TrendingUp"
  | "Gem"
  | "Users"
  | "Heart"
  | "Globe"
  | "Star"
  | "Crown"
  | "Flame"
  | "PiggyBank"
  | "LineChart";

/** The facts an achievement predicate may read — derived once from GameState, all already tracked. */
export interface AchievementFacts {
  productsShipped: number; // launched products (lifetime)
  hits: number; // launched products with a "hit" verdict
  hitStreak: number; // current run of consecutive hits among the most recent launches
  soldOut: boolean; // any launched product whose run sold out (demand met the whole run)
  cumulativeRevenue: number; // dollars (lifetime)
  netWorth: number; // dollars (cash + rival portfolio + own stake)
  reputation: number; // 0..100
  fans: number;
  era: number;
  atFinalEra: boolean;
  listed: boolean; // company has IPO'd on the exchange
  wentPublic: boolean; // reached the industry pinnacle (endgame flag)
  rivalsInvested: number; // number of distinct rivals the player holds shares in
}

export interface Achievement {
  id: string;
  title: string;
  /** One premium line — celebrates the moment without spoiling exact thresholds in a naggy way. */
  description: string;
  icon: AchievementIconName;
  /** A tasteful hint shown on the LOCKED placeholder (never an exact number to grind toward). */
  hint: string;
  predicate: (f: AchievementFacts) => boolean;
}

/** Derive the (read-only) facts an evaluator needs from a full GameState. Pure. */
export function deriveFacts(state: GameState): AchievementFacts {
  const launched = state.launched; // newest-first
  const hits = launched.filter((lp) => lp.verdict === "hit").length;

  // Current hit streak: consecutive "hit" verdicts from the most recent launch backward.
  let hitStreak = 0;
  for (const lp of launched) {
    if (lp.verdict === "hit") hitStreak++;
    else break;
  }

  // Sold out = a run where realized demand met the whole production run (totalUnits === plannedUnits).
  // This is exactly the engine's sellout condition, recoverable from persisted launched data.
  const soldOut = launched.some(
    (lp) => lp.plannedUnits != null && lp.plannedUnits > 0 && lp.totalUnits >= lp.plannedUnits,
  );

  const rivalsInvested = Object.values(state.holdings).filter((q) => (q ?? 0) > 0).length;

  return {
    productsShipped: launched.length,
    hits,
    hitStreak,
    soldOut,
    cumulativeRevenue: toDollars(state.cumulativeRevenue),
    netWorth: toDollars(netWorth(state)),
    reputation: state.reputation,
    fans: state.fans,
    era: state.era,
    atFinalEra: state.era >= maxEra(),
    listed: state.listed,
    wentPublic: state.wentPublic,
    rivalsInvested,
  };
}

/** The catalog — single source of truth for achievement content. Ordered roughly by journey. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: "first-ship",
    title: "Liftoff",
    description: "Shipped your very first product into the world.",
    icon: "Rocket",
    hint: "Design, build, and launch a product.",
    predicate: (f) => f.productsShipped >= 1,
  },
  {
    id: "first-hit",
    title: "Breakout",
    description: "Your first genuine hit — the market fell in love.",
    icon: "Sparkles",
    hint: "Launch a product that lands as a hit.",
    predicate: (f) => f.hits >= 1,
  },
  {
    id: "sold-out",
    title: "Sold Out",
    description: "Demand outstripped your entire production run.",
    icon: "Flame",
    hint: "Make a product people can't get enough of.",
    predicate: (f) => f.soldOut,
  },
  {
    id: "hat-trick",
    title: "Hat Trick",
    description: "Three hits in a row — you've found your rhythm.",
    icon: "Star",
    hint: "String together consecutive hits.",
    predicate: (f) => f.hitStreak >= 3,
  },
  {
    id: "ship-5",
    title: "Product Line",
    description: "Five products shipped and counting.",
    icon: "Boxes",
    hint: "Keep shipping. The catalog grows.",
    predicate: (f) => f.productsShipped >= 5,
  },
  {
    id: "ship-25",
    title: "Prolific",
    description: "Twenty-five products — a real catalog.",
    icon: "Factory",
    hint: "A steady cadence of launches.",
    predicate: (f) => f.productsShipped >= 25,
  },
  {
    id: "ship-100",
    title: "Industrial",
    description: "One hundred products. A true manufacturer.",
    icon: "Layers",
    hint: "The mark of a relentless studio.",
    predicate: (f) => f.productsShipped >= 100,
  },
  {
    id: "rev-1m",
    title: "First Million",
    description: "Crossed $1M in lifetime revenue.",
    icon: "BadgeDollarSign",
    hint: "Stack up lifetime sales.",
    predicate: (f) => f.cumulativeRevenue >= 1_000_000,
  },
  {
    id: "rev-10m",
    title: "Eight Figures",
    description: "Lifetime revenue past $10M.",
    icon: "TrendingUp",
    hint: "Scale the business.",
    predicate: (f) => f.cumulativeRevenue >= 10_000_000,
  },
  {
    id: "rev-100m",
    title: "Nine Figures",
    description: "Lifetime revenue past $100M.",
    icon: "LineChart",
    hint: "Empire-scale revenue.",
    predicate: (f) => f.cumulativeRevenue >= 100_000_000,
  },
  {
    id: "fans-10k",
    title: "A Following",
    description: "Ten thousand loyal fans.",
    icon: "Users",
    hint: "Win hearts with great products.",
    predicate: (f) => f.fans >= 10_000,
  },
  {
    id: "fans-100k",
    title: "Cult Brand",
    description: "A hundred thousand fans believe in you.",
    icon: "Heart",
    hint: "Build a brand people adore.",
    predicate: (f) => f.fans >= 100_000,
  },
  {
    id: "fans-1m",
    title: "Movement",
    description: "A million fans — a cultural force.",
    icon: "Globe",
    hint: "Reach the whole world.",
    predicate: (f) => f.fans >= 1_000_000,
  },
  {
    id: "rep-50",
    title: "Respected",
    description: "Reputation reached 50 — a name people trust.",
    icon: "Star",
    hint: "Earn the market's respect.",
    predicate: (f) => f.reputation >= 50,
  },
  {
    id: "rep-85",
    title: "Iconic",
    description: "Reputation reached 85 — an industry icon.",
    icon: "Crown",
    hint: "Become a household name.",
    predicate: (f) => f.reputation >= 85,
  },
  {
    id: "era-final",
    title: "State of the Art",
    description: "Reached the most advanced tech era.",
    icon: "Cpu",
    hint: "Push technology to its frontier.",
    predicate: (f) => f.atFinalEra,
  },
  {
    id: "investor",
    title: "Diversified",
    description: "Holding shares in three different rivals.",
    icon: "PiggyBank",
    hint: "Play the market, not just the lab.",
    predicate: (f) => f.rivalsInvested >= 3,
  },
  {
    id: "ipo",
    title: "Ringing the Bell",
    description: "Took the company public on the exchange.",
    icon: "Building2",
    hint: "Grow established enough to go public.",
    predicate: (f) => f.listed,
  },
  {
    id: "networth-1m",
    title: "Millionaire",
    description: "Net worth crossed $1M.",
    icon: "Gem",
    hint: "Build real wealth.",
    predicate: (f) => f.netWorth >= 1_000_000,
  },
  {
    id: "networth-100m",
    title: "Mogul",
    description: "Net worth crossed $100M.",
    icon: "Crown",
    hint: "Reach the heights of the industry.",
    predicate: (f) => f.netWorth >= 100_000_000,
  },
];

const ACHIEVEMENT_BY_ID: Map<string, Achievement> = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENT_BY_ID.get(id);
}

/**
 * Evaluate which achievement ids are currently satisfied by the given facts. PURE — returns the
 * FULL set of satisfied ids (not a diff). Callers union this with what's already unlocked, so the
 * unlocked set only ever grows (an achievement can't un-earn if e.g. fans later dip).
 */
export function evaluateAchievements(facts: AchievementFacts): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (a.predicate(facts)) out.push(a.id);
  }
  return out;
}

/**
 * Given the previously-unlocked ids and the current facts, return the ids that are NEWLY unlocked
 * this evaluation (satisfied now AND not previously unlocked). Pure; used by the state layer to
 * decide which (if any) celebratory toasts to fire. Order follows the catalog.
 */
export function newlyUnlocked(previous: readonly string[], facts: AchievementFacts): string[] {
  const had = new Set(previous);
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!had.has(a.id) && a.predicate(facts)) out.push(a.id);
  }
  return out;
}

export const ACHIEVEMENT_COUNT = ACHIEVEMENTS.length;
