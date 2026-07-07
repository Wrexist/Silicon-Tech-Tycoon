// Achievements / milestones — PURE data + a pure evaluator. No React/DOM, fully unit-tested.
//
// Philosophy (premium, no FOMO): these are celebratory milestones the player DISCOVERS by playing
// well, never a checklist that pesters. Every predicate reads ONLY from data the engine already
// tracks (launched[], cumulativeRevenue, reputation, fans, era, holdings, listed, net worth) — we
// never invent state. The evaluator is monotonic: once earned, an id stays earned (the caller keeps
// the union), so an achievement can never "un-unlock".
import type { GameState } from "../state/gameState.ts";
import { netWorth, scenarioResultFor } from "../state/gameState.ts";
import { toDollars } from "./money.ts";
import { completableProjectCount } from "./research.ts";
import { maxEra } from "./eras.ts";
import { OS_FEATURES, installedBase } from "./platform.ts";
import { MAX_EXPANSION } from "./factoryFloor.ts";

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
  | "LineChart"
  | "FlaskConical"
  | "UserPlus"
  | "Package"
  | "Zap"
  | "Trophy";

/** The facts an achievement predicate may read — derived once from GameState, all already tracked. */
export interface AchievementFacts {
  productsShipped: number; // launched products (lifetime)
  hits: number; // launched products with a "hit" verdict
  flops: number; // launched products with a "flop" verdict
  hitStreak: number; // current run of consecutive hits among the most recent launches
  soldOut: boolean; // any launched product whose run sold out (demand met the whole run)
  comebackFromFlop: boolean; // shipped a hit more recently than a flop
  cumulativeRevenue: number; // dollars (lifetime)
  netWorth: number; // dollars (cash + rival portfolio + own stake)
  reputation: number; // 0..100
  fans: number;
  era: number;
  era2reached: boolean;
  era3reached: boolean;
  atFinalEra: boolean;
  listed: boolean; // company has IPO'd on the exchange
  wentPublic: boolean; // reached the industry pinnacle (endgame flag)
  rivalsInvested: number; // number of distinct rivals the player holds shares in
  staffCount: number; // current headcount
  completedProjects: number; // research projects completed
  biggestRun: number; // largest single production run (units) ever ordered
  categoriesShipped: number; // distinct product categories ever shipped
  wonScenario: boolean; // currently winning the active scenario (≥1★)
  completedChallenge: boolean; // a daily/weekly challenge score has locked in
  releasedOsVersion: boolean; // shipped a new OS version via the Platform division
  osFeaturesBuilt: number; // OS feature modules built into the platform
  osComplete: boolean; // every OS feature module built — a complete platform
  osInstalledBase: number; // devices running your OS (0 unless the division is unlocked)
  osLicenseeCount: number; // rivals currently licensing your OS
  // --- Factory floor facts (all keyed ABOVE the starter defaults so they never auto-unlock at
  //     new-game: the starter floor is just an Intake and a Packer — no arms, no props, no
  //     expansions — so every one of these is genuinely built by the player). ---
  factoryExpanded: boolean; // bought at least one floor expansion
  factoryMaxExpanded: boolean; // expanded the floor to its largest footprint
  factoryProps: number; // decorative props placed on the factory floor
  factoryMachineCount: number; // machines placed on the line
  factoryArms: number; // assembly arms on the line (2+ parallelises the build)
  // --- Mastery (cross-run profile) facts. Supplied by the state layer via MasteryInput; default to
  //     0/false in a pure run so these never false-unlock without real profile data. ---
  scenarioThreeStarRun: boolean; // the CURRENT run has 3-starred its scenario
  scenariosThreeStarred: number; // distinct scenarios 3-starred across ALL runs (lifetime)
  allScenariosWon: boolean; // every scenario in the catalog won (≥1★) across runs
  allScenariosThreeStarred: boolean; // every scenario 3-starred across runs (the mastery peak)
  challengesCompletedTotal: number; // daily/weekly challenges completed across runs (lifetime)
}

/** Cross-run mastery counts, computed by the state layer (which owns the profile stores + the
 *  scenario catalog) and passed into deriveFacts so the engine stays pure / IO-free. */
export interface MasteryInput {
  totalScenarios: number; // size of the current scenario catalog
  scenariosWon: number; // distinct current scenarios won (≥1★), lifetime
  scenariosThreeStarred: number; // distinct current scenarios 3-starred, lifetime
  challengesCompleted: number; // challenges completed, lifetime
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

/** Derive the (read-only) facts an evaluator needs from a full GameState. Pure. The optional
 *  `mastery` carries cross-run profile data the engine can't read itself (localStorage lives in the
 *  state layer); omitted → the mastery facts default to 0/false, so a plain run never false-unlocks
 *  a mastery achievement. */
export function deriveFacts(state: GameState, mastery?: MasteryInput): AchievementFacts {
  const launched = state.launched; // newest-first
  // Count built OS modules by UNIQUE, VALID ids — a malformed/imported save can't over-count its way
  // to "complete".
  const validOsFeatureIds = new Set(OS_FEATURES.map((f) => f.id));
  const osBuiltCount = state.platformUnlocked
    ? new Set(state.osFeatures.filter((id) => validOsFeatureIds.has(id))).size
    : 0;
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
  const biggestRun = launched.reduce((max, lp) => Math.max(max, lp.plannedUnits ?? 0), 0);
  const flops = launched.filter((lp) => lp.verdict === "flop").length;

  // comebackFromFlop: a hit was shipped more recently than a flop (iterate old→new).
  // launched[] is newest-first, so we scan from the end (oldest) toward index 0 (newest).
  let _sawFlop = false;
  let comebackFromFlop = false;
  for (let i = launched.length - 1; i >= 0; i--) {
    const v = launched[i].verdict;
    if (v === "flop") _sawFlop = true;
    else if (_sawFlop && v === "hit") { comebackFromFlop = true; break; }
  }

  const categoriesShipped = new Set(launched.map((lp) => lp.product.category)).size;

  // Factory floor — tolerate malformed/legacy saves (fields may be absent before the backfill runs).
  const floorMachines = state.factoryFloor?.machines ?? [];
  const factoryExpansion = state.factoryExpansion ?? 0;

  return {
    productsShipped: launched.length,
    hits,
    flops,
    hitStreak,
    soldOut,
    comebackFromFlop,
    cumulativeRevenue: toDollars(state.cumulativeRevenue),
    netWorth: toDollars(netWorth(state)),
    reputation: state.reputation,
    fans: state.fans,
    era: state.era,
    era2reached: state.era >= 2,
    era3reached: state.era >= 3,
    atFinalEra: state.era >= maxEra(),
    listed: state.listed,
    wentPublic: state.wentPublic,
    rivalsInvested,
    staffCount: state.staff.length,
    completedProjects: state.completedProjects.length,
    biggestRun,
    categoriesShipped,
    wonScenario: scenarioResultFor(state)?.won ?? false,
    completedChallenge: state.challengeScore != null,
    releasedOsVersion: state.platformUnlocked && state.osVersion > 1,
    osFeaturesBuilt: osBuiltCount,
    osComplete: osBuiltCount >= OS_FEATURES.length,
    osInstalledBase: state.platformUnlocked ? installedBase(state.launched) : 0,
    osLicenseeCount: state.osLicensees.length,
    factoryExpanded: factoryExpansion >= 1,
    factoryMaxExpanded: factoryExpansion >= MAX_EXPANSION,
    factoryProps: (state.factoryProps ?? []).length,
    factoryMachineCount: floorMachines.length,
    factoryArms: floorMachines.filter((m) => m.kind === "arm").length,
    // Use the RUN-LOCKED high-water stars (monotonic, the value recorded to the profile), not a
    // live recompute — so a 3★ run still counts after the earn window closes or metrics later dip.
    scenarioThreeStarRun: (state.scenarioRunStars ?? 0) >= 3,
    scenariosThreeStarred: mastery?.scenariosThreeStarred ?? 0,
    allScenariosWon: !!mastery && mastery.totalScenarios > 0 && mastery.scenariosWon >= mastery.totalScenarios,
    allScenariosThreeStarred:
      !!mastery && mastery.totalScenarios > 0 && mastery.scenariosThreeStarred >= mastery.totalScenarios,
    challengesCompletedTotal: mastery?.challengesCompleted ?? 0,
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
    description: "Your first genuine hit, the market fell in love.",
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
    description: "Three hits in a row, you've found your rhythm.",
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
    description: "Twenty-five products, a real catalog.",
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
    description: "A million fans, a cultural force.",
    icon: "Globe",
    hint: "Reach the whole world.",
    predicate: (f) => f.fans >= 1_000_000,
  },
  {
    id: "rep-50",
    title: "Respected",
    description: "Reputation reached 50, a name people trust.",
    icon: "Star",
    hint: "Earn the market's respect.",
    predicate: (f) => f.reputation >= 50,
  },
  {
    id: "rep-85",
    title: "Iconic",
    description: "Reputation reached 85, an industry icon.",
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
  {
    id: "first-hire",
    title: "Team of Two",
    description: "Recruited your first employee, the founding team grows.",
    icon: "UserPlus",
    hint: "Hire someone beyond the founder.",
    predicate: (f) => f.staffCount >= 2,
  },
  {
    id: "team-5",
    title: "Small Studio",
    description: "Five people on the payroll, a real team.",
    icon: "Users",
    hint: "Build a crew of five or more.",
    predicate: (f) => f.staffCount >= 5,
  },
  {
    id: "hit-streak-5",
    title: "On Fire",
    description: "Five consecutive hits. The market can't get enough.",
    icon: "Zap",
    hint: "Launch five hits in a row.",
    predicate: (f) => f.hitStreak >= 5,
  },
  {
    id: "research-4",
    title: "Research Lab",
    description: "Four research projects completed, the R&D engine is running.",
    icon: "FlaskConical",
    hint: "Complete multiple research projects.",
    predicate: (f) => f.completedProjects >= 4,
  },
  {
    id: "research-all",
    title: "Full R&D",
    description: "Every available research project completed. No stone unturned.",
    icon: "FlaskConical",
    hint: "Research your way to the frontier.",
    predicate: (f) => f.completedProjects >= completableProjectCount(),
  },
  {
    id: "big-run",
    title: "Mass Production",
    description: "A single production run of 50,000 units or more.",
    icon: "Package",
    hint: "Bet big on a major launch.",
    predicate: (f) => f.biggestRun >= 50_000,
  },
  {
    id: "gg",
    title: "Legend",
    description: "Reached the industry pinnacle. A legacy in silicon.",
    icon: "Trophy",
    hint: "Complete the full journey, from garage to public icon.",
    predicate: (f) => f.wentPublic,
  },
  // --- New milestones ---
  {
    id: "first-research",
    title: "Eureka",
    description: "The lab is open, you've completed your first research project.",
    icon: "FlaskConical",
    hint: "Invest RP and complete a research project.",
    predicate: (f) => f.completedProjects >= 1,
  },
  {
    id: "era-2",
    title: "Growth Mode",
    description: "Graduated from the garage into the Growth Era.",
    icon: "TrendingUp",
    hint: "Build reputation or revenue to advance past the Garage Era.",
    predicate: (f) => f.era2reached,
  },
  {
    id: "era-3",
    title: "Platform Play",
    description: "The industry is watching, you've entered the Platform Era.",
    icon: "Layers",
    hint: "Push beyond the Growth Era.",
    predicate: (f) => f.era3reached,
  },
  {
    id: "comeback-kid",
    title: "Comeback Kid",
    description: "Bounced back from a flop and shipped a hit. Resilience wins.",
    icon: "Zap",
    hint: "Launch a hit after suffering a flop.",
    predicate: (f) => f.comebackFromFlop,
  },
  {
    id: "diversified-mfg",
    title: "Full Portfolio",
    description: "Products in three different categories, you're no one-trick company.",
    icon: "Boxes",
    hint: "Ship products across multiple categories.",
    predicate: (f) => f.categoriesShipped >= 3,
  },
  {
    id: "rev-1b",
    title: "Billion Club",
    description: "One billion in lifetime revenue. The industry bows.",
    icon: "Crown",
    hint: "Scale to a billion dollars in lifetime sales.",
    predicate: (f) => f.cumulativeRevenue >= 1_000_000_000,
  },
  {
    id: "team-10",
    title: "Growing Fast",
    description: "Ten people on the payroll, a company, not a crew.",
    icon: "Users",
    hint: "Grow your headcount to ten or more.",
    predicate: (f) => f.staffCount >= 10,
  },
  {
    id: "all-rivals",
    title: "Market Maker",
    description: "Shares in every rival on the exchange. You own the whole industry.",
    icon: "Globe",
    hint: "Invest in every competitor on the stock exchange.",
    predicate: (f) => f.rivalsInvested >= 6,
  },
  {
    id: "ship-10",
    title: "Serial Launcher",
    description: "Ten products shipped. You've found your manufacturing cadence.",
    icon: "Factory",
    hint: "Keep the launch pipeline full.",
    predicate: (f) => f.productsShipped >= 10,
  },
  {
    id: "dual-category",
    title: "Two-Front War",
    description: "Products launched in two distinct categories, the portfolio expands.",
    icon: "Layers",
    hint: "Ship into more than one product category.",
    predicate: (f) => f.categoriesShipped >= 2,
  },
  {
    id: "mega-run",
    title: "Mega Run",
    description: "A single production run of 200,000 units. The factory ran at full tilt.",
    icon: "Package",
    hint: "Bet big on a breakout product.",
    predicate: (f) => f.biggestRun >= 200_000,
  },
  {
    id: "rev-500m",
    title: "Half a Billion",
    description: "Five hundred million in lifetime revenue. The next zero is close.",
    icon: "TrendingUp",
    hint: "Keep compounding revenue across product generations.",
    predicate: (f) => f.cumulativeRevenue >= 500_000_000,
  },
  {
    id: "networth-10m",
    title: "Deep Pockets",
    description: "Net worth crossed $10M. The runway is very comfortable.",
    icon: "PiggyBank",
    hint: "Build your personal wealth alongside the company.",
    predicate: (f) => f.netWorth >= 10_000_000,
  },
  {
    id: "flop-proof",
    title: "Perfect Record",
    description: "Ten or more products shipped with zero flops, pure consistency.",
    icon: "Star",
    hint: "Launch many products without a single flop.",
    predicate: (f) => f.productsShipped >= 10 && f.flops === 0,
  },
  {
    id: "rep-75",
    title: "Celebrated",
    description: "Reputation reached 75, your brand is widely admired.",
    icon: "Sparkles",
    hint: "Keep delivering hits and the world notices.",
    predicate: (f) => f.reputation >= 75,
  },
  {
    id: "scenario-win",
    title: "Goal Oriented",
    description: "Won a Scenario, you met a hand-crafted challenge's objectives.",
    icon: "Star",
    hint: "Take on a Scenario and hit its goal.",
    predicate: (f) => f.wonScenario,
  },
  {
    id: "challenge-done",
    title: "Daily Grind",
    description: "Completed a daily or weekly Challenge, scored under the mutators.",
    icon: "Zap",
    hint: "Play a Challenge through to its scoring week.",
    predicate: (f) => f.completedChallenge,
  },
  {
    id: "os-release",
    title: "Platform Owner",
    description: "Released a new version of your OS across the installed base.",
    icon: "Layers",
    hint: "Build the Platform division and ship an OS version.",
    predicate: (f) => f.releasedOsVersion,
  },
  {
    id: "os-first-feature",
    title: "Platform Pioneer",
    description: "Built your first capability into your OS, the platform takes shape.",
    icon: "Sparkles",
    hint: "Build a feature module in the Platform division.",
    predicate: (f) => f.osFeaturesBuilt >= 1,
  },
  {
    id: "os-complete",
    title: "Walled Garden",
    description: "Every capability built into your OS, a complete, self-reinforcing platform.",
    icon: "Boxes",
    hint: "Build every OS feature module.",
    predicate: (f) => f.osComplete,
  },
  {
    id: "os-reach-100k",
    title: "Going Mainstream",
    description: "A hundred thousand devices now run your OS.",
    icon: "Users",
    hint: "Sell enough devices to spread your platform.",
    predicate: (f) => f.osInstalledBase >= 100_000,
  },
  {
    id: "os-reach-1m",
    title: "Ubiquitous",
    description: "A million devices running your OS, it's everywhere.",
    icon: "Globe",
    hint: "Grow your installed base to a million.",
    predicate: (f) => f.osInstalledBase >= 1_000_000,
  },
  {
    id: "os-kingmaker",
    title: "Kingmaker",
    description: "Three rivals license your OS, the industry runs on your platform.",
    icon: "Crown",
    hint: "License your OS to several competitors at once.",
    predicate: (f) => f.osLicenseeCount >= 3,
  },
  // --- Mastery tier (cross-run; the engaged-player tail, per RETENTION_ROADMAP Wave 4) ---
  {
    id: "scenario-3star",
    title: "Flawless Run",
    description: "Three-starred a Scenario, every objective, every tier, in a single run.",
    icon: "Star",
    hint: "Master a Scenario's hardest tier.",
    predicate: (f) => f.scenarioThreeStarRun,
  },
  {
    id: "scenarios-3starred-3",
    title: "Triple Threat",
    description: "Three-starred three different Scenarios. A serial master.",
    icon: "Flame",
    hint: "Master several Scenarios, not just one.",
    predicate: (f) => f.scenariosThreeStarred >= 3,
  },
  {
    id: "scenarios-all-won",
    title: "Campaign Complete",
    description: "Won every Scenario in the catalog. You've answered every brief.",
    icon: "Trophy",
    hint: "Earn at least one star in every Scenario.",
    predicate: (f) => f.allScenariosWon,
  },
  {
    id: "scenarios-all-3star",
    title: "Grand Master",
    description: "Three-starred every Scenario. Total mastery of the game.",
    icon: "Crown",
    hint: "Master all three tiers of every Scenario.",
    predicate: (f) => f.allScenariosThreeStarred,
  },
  {
    id: "challenges-10",
    title: "Daily Devotee",
    description: "Completed ten daily or weekly Challenges. A creature of habit.",
    icon: "Zap",
    hint: "Keep coming back for the Challenge.",
    predicate: (f) => f.challengesCompletedTotal >= 10,
  },
  // --- Factory floor (the line you build by hand; keyed above the starter so they're earned) ---
  {
    id: "factory-parallel",
    title: "Second Shift",
    description: "Two assembly arms on the line, builds now run in parallel.",
    icon: "Zap",
    hint: "Run two assembly arms on your factory line.",
    predicate: (f) => f.factoryArms >= 2,
  },
  {
    id: "factory-expand",
    title: "Breaking Ground",
    description: "Expanded the factory floor for the first time, room to grow.",
    icon: "Building2",
    hint: "Buy a floor expansion in Factory mode.",
    predicate: (f) => f.factoryExpanded,
  },
  {
    id: "factory-decor",
    title: "Shop Floor Style",
    description: "Dressed the factory with your own decor, a place with character.",
    icon: "Sparkles",
    hint: "Place several decorative props on the factory floor.",
    predicate: (f) => f.factoryProps >= 5,
  },
  {
    id: "factory-big-line",
    title: "Production Powerhouse",
    description: "A sprawling line of a dozen machines, humming end to end.",
    icon: "Layers",
    hint: "Build a dozen machines onto your factory floor.",
    predicate: (f) => f.factoryMachineCount >= 12,
  },
  {
    id: "factory-max",
    title: "Megafactory",
    description: "Expanded the floor to its largest footprint. Industrial scale.",
    icon: "Factory",
    hint: "Keep expanding the factory floor to the limit.",
    predicate: (f) => f.factoryMaxExpanded,
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
