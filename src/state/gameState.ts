// GameState + pure reducers. Composes the engine; owns NO React. Fully testable.
// The React hook (useGame) wraps these and drives the tick.
import { BALANCE } from "../engine/balance.ts";
import { CATEGORIES, tierDef } from "../engine/catalogs.ts";
import {
  advanceCompetitors,
  initCompetitors,
  rivalMarketCap,
  rivalDef,
  rivalDoctrine,
  countersDoctrine,
  spawnChallenger,
  RIVALS,
  type CompetitorLaunch,
} from "../engine/competitors.ts";
import {
  assignedSkill,
  buildWeeks,
  designCeiling,
  gainWeeklyXp,
  salaryFor,
  trainCost,
  weeklyBurn,
  weeklyPayroll,
} from "../engine/economy.ts";
import {
  forkLockedBy,
  hasProject,
  launchRpReward,
  projectById,
  RESEARCH_PROJECTS,
  rpSources,
  techRpCost,
  weeklyRp,
  type ProjectId,
} from "../engine/research.ts";
import {
  designSpecialtyBonus,
  levelFromSkills,
  makeIdentity,
  makeSkills,
  perfectionistCeilingBonus,
  ROLE_DISCIPLINE,
  ROLE_TITLE,
  visionaryHype,
} from "../engine/staff.ts";
import { pickChoiceEvent, pickEvent, type ChoiceEvent, type ChoiceOption, type MarketEvent } from "../engine/events.ts";
import { chainById, pickChain, type EventChain } from "../engine/eventChains.ts";
import { pickPoachTarget } from "../engine/poaching.ts";
import { mentorshipXpMult } from "../engine/org.ts";
import { accrueLoans, creditLimit, loanRate, makeLoan, type Loan } from "../engine/financing.ts";
import { channelById, type ChannelId } from "../engine/marketing.ts";
import {
  addItem as addFurniture,
  canPlace,
  defaultLayout,
  deskItems,
  furnitureCost,
  moveItem as moveFurnitureOp,
  officeAttrs,
  removeItem as removeFurnitureOp,
  rotateItem as rotateFurnitureOp,
  type FurnitureId,
  type PlacedItem,
  type Rot,
} from "../engine/furniture.ts";
import {
  buildCostMult,
  buildWeekReduction,
  designCeilingBonus,
  designStatBonus,
  marketingHype,
  moodBonus,
  nextUpgradeCost,
  qualityStatBonus,
  rpMultiplier,
  upgradeLine,
  upgradeLockedBy,
  type UpgradeId,
} from "../engine/upgrades.ts";
import { canAdvanceEra, eraModifier, eraName, eraRuleSummary, isCategoryUnlocked, maxEra } from "../engine/eras.ts";
import { deriveFacts, evaluateAchievements, type MasteryInput } from "../engine/achievements.ts";
import { newlyCompletedObjectives } from "../engine/objectives.ts";
import {
  advanceTrends,
  categoryTrendDirection,
  demandVarianceMultiplier,
  initialTrends,
  priceFit,
  randomTrendTarget,
  scoreLaunch,
} from "../engine/market.ts";
import {
  add,
  cents,
  dollars,
  format,
  scale,
  sub,
  toDollars,
  ZERO,
  type Money,
} from "../engine/money.ts";
import { archetypeBonus, buildCost, componentSynergy, computeStats, missingSlots, overallScore, tuningCostMultiplier } from "../engine/product.ts";
import { supplierLeadWeeks, supplierLoyaltyDiscount, supplierCrunchMult, supplierEthicsRepDelta, contractTerm, contractDiscount, supplierFor, DEFAULT_SUPPLIER_ID, type ContractTerm } from "../engine/suppliers.ts";
import { factoryToolingMult, factoryUnitMult, factorySpeedMult, factoryCapacityPerWeek, resolveCapacity, totalFactoryUpkeep, factoryFor, isFactoryUnlocked, type CapacityOutcome, type CapacityStrategy } from "../engine/factories.ts";
import type { FactoryId, SupplierId } from "../engine/types.ts";
import { segmentDemand, brandPriceToleranceMult, type SegmentDemand } from "../engine/segments.ts";
import { regionById, regionReach } from "../engine/regions.ts";
import { generateRivalProduct, type RivalRelease } from "../engine/rivalAI.ts";
import { forecastConfidence, forecastBand } from "../engine/forecast.ts";
import { noveltyFor } from "../engine/novelty.ts";
import { styleAppeal } from "../engine/aesthetics.ts";
import { brandEquity, franchiseStem, equityPreorderBonus, equityHypeBonus, type BrandEquity } from "../engine/franchise.ts";
import { distributeOverCurve, forecast } from "../engine/salesCurve.ts";
import { buyCost, holdingsValue, sellProceeds, weeklyDividends, type Holdings } from "../engine/stocks.ts";
import { makeRng, type Rng } from "../engine/rng.ts";
import { canEarnStars, deriveScenarioFacts, evaluateScenario, metricValue, scenarioById, type ScenarioResult, type ScenarioMetric } from "../engine/scenarios.ts";
import { dailyChallenge, weeklyChallenge, type Challenge, type ChallengeKind } from "../engine/challenges.ts";
import { canInstallOsFeature, canReleaseVersion, installedBase, licenseeMood, licenseeStrengthUplift, osEcosystemBonus, osFeatureById, osFeatureRows, osReleaseReward, osServicesMultiplier, osTier, philosophyServicesMult, philosophyStatBonus, rivalLicenseFee, updateLicenseeRelations, type OsFeatureRow, type OsTierInfo } from "../engine/platform.ts";
import { perkBonuses } from "../engine/perks.ts";
import type {
  Assignment,
  BuildJob,
  Candidate,
  CategoryId,
  ComponentKind,
  ConsumerTrends,
  CompetitorState,
  LaunchedProduct,
  Product,
  Recruitment,
  RecruitTier,
  RegionId,
  Staff,
  StaffRole,
  Stats,
} from "../engine/types.ts";
import { FINISH_ORDER } from "../engine/types.ts";

export const SAVE_VERSION = 1;

export type FeedTone = "neutral" | "positive" | "negative" | "accent";
export interface FeedItem {
  id: string;
  week: number;
  text: string;
  tone: FeedTone;
}

export interface GameState {
  version: number;
  seed: number;
  rngState: number;
  companyName: string;
  week: number;
  cash: Money;
  reputation: number;
  fans: number; // loyal customer base — guaranteed pre-orders, grows with hits
  era: number;
  cumulativeRevenue: Money;
  trends: ConsumerTrends;
  trendRetargetWeek: number;
  competitors: CompetitorState[];
  /** highest unlocked tier per component line (>=1 means researched up to that tier) */
  researched: Partial<Record<ComponentKind, number>>;
  /** max camera lens count the Design Lab offers (2 at start; 3rd/4th bought with RP) */
  lensLimit: number;
  /** highest unlocked index into FINISH_ORDER (1 at start = plastic+aluminium; titanium/gold bought with RP) */
  finishLimit: number;
  staff: Staff[];
  /** in-progress recruitment search (null when idle), and the candidates it produced */
  recruitment: Recruitment | null;
  candidates: Candidate[];
  candidateCounter: number;
  candidatesExpire: number; // week the current shortlist lapses (0 when none)
  facilityTier: number;
  upgrades: Partial<Record<UpgradeId, number>>;
  researchPoints: number;
  completedProjects: ProjectId[];
  /** Geographic markets unlocked for distribution (engine/regions.ts). Always contains "home". */
  unlockedRegions: RegionId[];
  /** Owned manufacturing lines the player has acquired (engine/factories.ts). Each carries weekly
   *  upkeep and can be selected for builds. Empty for contract-only companies / older saves. */
  ownedFactories: FactoryId[];
  /** Builds run through each supplier — the relationship/loyalty count that earns a standing unit-
   *  cost discount (engine/suppliers.ts). Optional; absent/0 = no relationship yet. */
  supplierLoyalty?: Partial<Record<SupplierId, number>>;
  /** Active fixed-price contracts per supplier: a locked discount + crunch immunity for `weeksLeft`
   *  weeks (engine/suppliers.ts). Optional; absent = spot pricing. */
  supplierContracts?: Partial<Record<SupplierId, { discount: number; weeksLeft: number }>>;
  /** The production plan from the most recent build, so the wizard can offer a one-tap "repeat last
   *  plan" (Q1). Optional; absent on a fresh company / older saves (the wizard simply hides the
   *  shortcut until the player ships their first product). */
  lastBuildPlan?: { units: number; channelId: ChannelId; regions: RegionId[]; strategy: CapacityStrategy };
  building: BuildJob[];
  ready: Product[]; // built, awaiting launch
  launched: LaunchedProduct[];
  cashHistory: { week: number; cash: number }[];
  feed: FeedItem[];
  nextEventWeek: number;
  lastEvent: { text: string; tone: FeedTone; week: number } | null;
  lastActive: number;
  bankrupt: boolean;
  productCounter: number;
  staffCounter: number;
  /** player-arranged office furniture (the builder) */
  layout: PlacedItem[];
  furnitureCounter: number;
  /** room theming — indices into FLOOR_FINISHES / WALL_STYLES */
  roomStyle: { floor: number; wall: number };
  /** standalone computer desks the player has bought to populate the garage (0–4) */
  desktops: number;
  sandboxUnlocked: boolean;
  onboarded: boolean;
  tutorialDone: boolean;
  wentPublic: boolean; // endgame "reached the pinnacle" flag (drives the New Game+ celebration)
  legacy: number; // prestige level carried in from prior companies
  // --- Equity / stock market ---
  listed: boolean; // the player's company has IPO'd (is publicly traded)
  ownership: number; // founder's fraction of the company (1 = fully private)
  /** Performance-reactive momentum overlay on the company's value (Track B): a fractional swing
   *  (±cap) bumped by launch verdicts + the #1 premium, decaying back to 0. Optional → 0 on old saves. */
  valuationMomentum?: number;
  /** Recent company-valuation samples for the sparkline (newest last). Optional on old saves. */
  valuationHistory?: number[];
  /** An in-progress cascading event chain (Track B): which chain, the next beat to fire, and when.
   *  null/undefined when no chain is running. Optional on old saves. */
  eventChain?: { id: string; step: number; nextWeek: number } | null;
  holdings: Holdings; // shares owned in rival companies, by id
  /** Best (lowest) industry-leaderboard rank ever reached (1 = biggest company in the industry).
   *  Starts at 7 (a fresh garage is dead last behind the six rivals); each time the player climbs
   *  to a new best, the tick celebrates overtaking the rival(s) they passed. Monotonic downward. */
  bestIndustryRank: number;
  // --- Achievements ---
  /** ids of celebratory milestones the player has earned (monotonic — only ever grows). */
  unlockedAchievements: string[];
  /** ids of "Next Move" objectives the player has completed (the HQ guidance ladder). Monotonic;
   *  resets per company (each new run re-walks the ladder). See engine/objectives.ts. */
  completedObjectives: string[];
  /** A market event requiring a player decision — resolved via resolveChoice. */
  pendingChoice: { event: ChoiceEvent; week: number } | null;
  /** A rival poaching one of your staff, awaiting a counter-offer decision (Track C). Resolved via
   *  resolvePoach. Optional/null → golden-invariant safe (old saves load with no pending poach). */
  pendingPoach?: { staffId: string; staffName: string; rivalId: string; rivalName: string; retainCost: Money; week: number } | null;
  /** Outstanding debt-financing loans (Track C). Optional/empty → golden-invariant safe (old saves
   *  load debt-free). Each loan is amortized weekly in the tick; see engine/financing.ts. */
  loans?: Loan[];
  /** Week until which another company-wide morale spend (offsite/bonus) is unavailable (Track C).
   *  Optional → old saves default 0 (available immediately). */
  moraleCooldownUntil?: number;
  /** IDs of choice events already resolved THIS RUN — prevents repeats within a company. */
  resolvedChoices: string[];
  /** IDs of choice events resolved across ALL companies (carried through New Game+ like the legacy
   *  bonus) — lets pickChoiceEvent surface never-seen dilemmas first so a prestige run feels fresh. */
  seenChoices: string[];
  /** Scenario this run is playing (id from engine/scenarios.ts), or null for a freeform game.
   *  Per-RUN only — the BEST stars earned per scenario live in the profile store (scenarioProgress). */
  activeScenario: string | null;
  /** Stars earned in THIS run (run-scoped, monotonic, frozen after a deadline passes). The tracker
   *  reads this — never the cross-run profile best — so a replay reflects the current run, not history. */
  scenarioRunStars: number;
  /** Active daily/weekly challenge run (null otherwise). The full challenge is re-derivable from
   *  kind+dateKey (deterministic); scoreMetric/scoreWeek are stored for a cheap, explicit tick check. */
  activeChallenge: { kind: ChallengeKind; dateKey: string; scoreMetric: ScenarioMetric; scoreWeek: number } | null;
  /** Final locked challenge score, set once the challenge's scoreWeek is reached (null until then). */
  challengeScore: number | null;
  // --- Platform / OS division (DLC #1) ---
  /** DLC entitlement — the Platform division UI + levers are hidden unless this is true. */
  platformUnlocked: boolean;
  /** Player-named OS line (empty → defaults to "<Company> OS" for display). */
  osName: string;
  /** Released OS version number — caught up to the software research tier via releaseOsVersion. */
  osVersion: number;
  /** Rival ids currently licensing your OS — each pays a weekly fee but gains a competitiveness uplift. */
  osLicensees: string[];
  /** Per-licensee satisfaction (id → 0..100). Decays when you dominate them; low satisfaction can
   *  make a licensee drop the license (churn). Defaults to startHealth for any licensee not present. */
  osLicenseeHealth: Record<string, number>;
  /** Installed OS feature modules (engine/platform.ts OS_FEATURES). Each lifts the ecosystem stat of
   *  every device you launch AND multiplies recurring services income. Empty → no effect. */
  osFeatures: string[];
  /** Weekly installed-base samples for the Platform "OS reach" sparkline (capped). Only recorded
   *  while the division is unlocked, so it reflects the OS era. */
  osBaseHistory: number[];
  /** Chosen OS philosophy id (engine/platform.ts OS_PHILOSOPHIES), or null. A lasting identity choice
   *  that tilts every device you launch + your services. Null → no effect. */
  osPhilosophy: string | null;
  /** Epic B — rivals' recently-released products (newest first, capped). Each is a real renderable
   *  device the player can see and learn from, instead of an invisible "strength" number. */
  rivalReleases: RivalRelease[];
  /** Uncapped per-`rivalId:category` launch counts → stable rival series numbers ("Pomelo Lumen 2"…).
   *  Kept separate from the capped `rivalReleases` gallery so series numbering never regresses when
   *  old releases are sliced off in a long game. */
  rivalLineCounters: Record<string, number>;
  /** Epic B3 — ids of rivals the player has acquired (removed from competition). Tracked so an
   *  acquired rival never re-enters as a fresh challenger, and for UI/achievements. */
  acquiredRivals: string[];
  /** Epic E delegation toggles. Each automates an action the player can already do, gated behind a
   *  premium research division + a recruited specialist (whose salary is the standing weekly cost).
   *  The `*Free` flags grandfather saves that already had an automation ON before the gating shipped,
   *  so they keep working without the new prerequisites. Persisted per save. */
  automation: { autoAssign: boolean; autoResearch: boolean; autoAssignFree?: boolean; autoResearchFree?: boolean };
}

/** Cap on the rolling Rival Releases list (newest first). Bounds save size + the UI gallery. */
export const RIVAL_RELEASES_CAP = 24;

export const REV_MILESTONES = [
  10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
  1_000_000, 2_500_000, 5_000_000, 10_000_000,
  25_000_000, 50_000_000, 100_000_000,
];

function revMilestoneItems(prev: Money, next: Money, week: number): FeedItem[] {
  const prevD = toDollars(prev);
  const nextD = toDollars(next);
  return REV_MILESTONES
    .filter((m) => prevD < m && nextD >= m)
    .map((m) => feedItem(week, `Revenue milestone: ${format(dollars(m))} earned lifetime.`, "positive"));
}

const FAN_MILESTONES: { fans: number; text: string; repBonus: number }[] = [
  { fans:     1_000, text: "1,000 fans, your brand is gaining recognition.", repBonus: 1 },
  { fans:     5_000, text: "5,000 fans, a real community is forming.", repBonus: 1 },
  { fans:    10_000, text: "10,000 fans! You're becoming a household name.", repBonus: 2 },
  { fans:    50_000, text: "50,000 fans, a major following. Brands take notice.", repBonus: 2 },
  { fans:   100_000, text: "100,000 fans! You're a leader in the market.", repBonus: 3 },
  { fans:   500_000, text: "500,000 fans, half a million people follow you.", repBonus: 3 },
  { fans: 1_000_000, text: "One million fans! Your brand is iconic.", repBonus: 5 },
];

function fanMilestoneResult(prevFans: number, newFans: number, week: number): { feed: FeedItem[]; repBonus: number } {
  const crossed = FAN_MILESTONES.filter((m) => prevFans < m.fans && newFans >= m.fans);
  return {
    feed: crossed.map((m) => feedItem(week, m.text, "positive")),
    repBonus: crossed.reduce((s, m) => s + m.repBonus, 0),
  };
}

let feedSeq = 0;
function feedItem(week: number, text: string, tone: FeedTone): FeedItem {
  return { id: `f${week}-${feedSeq++}`, week, text, tone };
}

/**
 * F4 — feedSeq is a module-level counter that resets to 0 on reload while persisted feed items
 * keep their old ids (`f<week>-<seq>`). After loading a save, seed the counter above the highest
 * existing suffix so newly generated ids never collide with restored ones (which would cause
 * duplicate React keys). Ids stay stable + deterministic.
 */
export function seedFeedSeq(state: GameState): void {
  let max = -1;
  for (const item of state.feed) {
    const m = /-(\d+)$/.exec(item.id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  if (max + 1 > feedSeq) feedSeq = max + 1;
}

function rngFrom(state: GameState): Rng {
  // `??` not `||`: a mulberry32 state of exactly 0 is valid (rng.state() returns `a >>> 0`), and
  // `||` would treat it as falsy and silently re-seed from `state.seed`, breaking the deterministic
  // stream the save system + test suite depend on. newGame seeds rngState and persistence backfills
  // it, so `??` only falls through on a genuinely absent field.
  return makeRng(state.rngState ?? state.seed);
}

const STARTER_NAMES = ["You (Founder)"];
// Applicant name pool for recruitment (no real people / brands).
const NAMES = ["Riley", "Sam", "Jordan", "Casey", "Ari", "Noa", "Quinn", "Devin", "Max", "Robin", "Sky", "Frankie", "Ellis", "Rowan", "Tatum", "Wren"];

export interface LegacyBonus {
  cash: Money;
  reputation: number;
  fans: number;
  rp: number;
}

/** The permanent head-start a New Game+ founding inherits at the given prestige `level`. Resource
 *  bonuses escalate triangularly (level 1 → ×1, level 2 → ×3, level 3 → ×6, …) so each empire is
 *  mightier than the last; reputation stays linear so the early game remains a climb. Pure — the
 *  win overlay previews legacyBonus(level+1) to show the player exactly what going again earns. */
export function legacyBonus(level: number): LegacyBonus {
  const L = Math.max(0, Math.floor(level));
  const tri = (L * (L + 1)) / 2; // 0,1,3,6,10,15,… — escalating reward per prestige
  return {
    cash: scale(BALANCE.legacy.cashPerLevel, tri),
    reputation: L * BALANCE.legacy.repPerLevel,
    fans: Math.round(BALANCE.legacy.fansPerLevel * tri),
    rp: Math.round(BALANCE.legacy.rpPerLevel * tri),
  };
}

export function newGame(seed = (Math.random() * 2 ** 31) >>> 0, legacy = 0): GameState {
  const lb = legacyBonus(legacy);
  const rng = makeRng(seed);
  const trends = initialTrends(rng);
  const competitors = initCompetitors(rng);
  const founderIdentity = makeIdentity(rng, "engineer");
  const founder: Staff = {
    id: "s0",
    role: "engineer",
    name: STARTER_NAMES[0],
    skill: 3,
    skills: makeSkills(rng, "engineer", 3),
    salary: ZERO, // the founder works for free
    assignment: "rnd",
    xp: 0,
    ...founderIdentity,
    mood: 75, // founders start motivated
  };
  return {
    version: SAVE_VERSION,
    seed,
    rngState: rng.state(),
    companyName: "Silicon",
    week: 0,
    cash: add(BALANCE.startingCash, lb.cash),
    reputation: BALANCE.startingReputation + lb.reputation,
    fans: BALANCE.fans.starting + lb.fans,
    era: 1,
    cumulativeRevenue: ZERO,
    trends,
    trendRetargetWeek: BALANCE.market.trendDrift.retargetEveryWeeks,
    competitors,
    researched: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    staff: [founder],
    recruitment: null,
    candidates: [],
    candidateCounter: 0,
    candidatesExpire: 0,
    facilityTier: 1,
    upgrades: {},
    researchPoints: lb.rp,
    completedProjects: [],
    unlockedRegions: ["home"],
    ownedFactories: [],
    building: [],
    ready: [],
    launched: [],
    cashHistory: [{ week: 0, cash: toDollars(BALANCE.startingCash) }],
    feed: [feedItem(0, "Company founded. Time to design something great.", "accent")],
    nextEventWeek: BALANCE.events.firstWeek,
    lastEvent: null,
    lastActive: Date.now(),
    bankrupt: false,
    productCounter: 1,
    staffCounter: 1,
    layout: defaultLayout(),
    furnitureCounter: 3, // starter layout uses f1 (desk) + f2 (plant)
    roomStyle: { floor: 0, wall: 0 },
    desktops: 0,
    lensLimit: 2,
    finishLimit: BALANCE.design.freeFinishes - 1,
    sandboxUnlocked: false,
    onboarded: false,
    tutorialDone: false,
    wentPublic: false,
    legacy,
    listed: false,
    ownership: 1,
    valuationMomentum: 0,
    valuationHistory: [],
    eventChain: null,
    holdings: {},
    bestIndustryRank: 7, // a fresh garage is dead last behind the six public rivals
    unlockedAchievements: [],
    completedObjectives: [],
    pendingChoice: null,
    pendingPoach: null,
    loans: [],
    moraleCooldownUntil: 0,
    resolvedChoices: [],
    seenChoices: [],
    activeScenario: null,
    scenarioRunStars: 0,
    activeChallenge: null,
    challengeScore: null,
    platformUnlocked: false,
    osName: "",
    osVersion: 1,
    osLicensees: [],
    osLicenseeHealth: {},
    osFeatures: [],
    osBaseHistory: [],
    osPhilosophy: null,
    rivalReleases: [],
    rivalLineCounters: {},
    acquiredRivals: [],
    automation: { autoAssign: false, autoResearch: false, autoAssignFree: false, autoResearchFree: false },
  };
}

/** Start a daily/weekly challenge: a freeform run seeded from the date with the challenge's
 *  date-seeded mutators applied as start overrides. Deterministic — everyone playing the same
 *  date's challenge gets the same market. Score locks at scoreWeek (see withChallengeScore). */
export function newChallengeGame(kind: ChallengeKind, dateKey: string): GameState {
  const ch = kind === "weekly" ? weeklyChallenge(dateKey) : dailyChallenge(dateKey);
  const base = newGame(ch.seed);
  let cash = base.cash;
  let reputation = base.reputation;
  let fans = base.fans;
  for (const m of ch.mutators) {
    if (m.cashMult != null) cash = scale(cash, m.cashMult);
    if (m.reputation != null) reputation = m.reputation;
    if (m.fans != null) fans = m.fans;
  }
  return {
    ...base,
    cash,
    reputation,
    fans,
    onboarded: true,
    tutorialDone: true,
    activeChallenge: { kind: ch.kind, dateKey: ch.dateKey, scoreMetric: ch.scoreMetric, scoreWeek: ch.scoreWeek },
    challengeScore: null,
    cashHistory: [{ week: 0, cash: toDollars(cash) }],
    feed: [feedItem(0, `${kind === "weekly" ? "Weekly" : "Daily"} challenge, ${ch.mutators.map((m) => m.name).join(" + ")}. Score: best ${ch.scoreMetric} by week ${ch.scoreWeek}.`, "accent")],
  };
}

/** Lock the challenge's final score once its scoreWeek is reached (pure, idempotent). Called from
 *  the tick alongside evaluateAndUnlock; the score is a snapshot of the scored metric at that week. */
export function withChallengeScore(state: GameState): GameState {
  const ch = state.activeChallenge;
  if (!ch || state.challengeScore != null || state.week < ch.scoreWeek) return state;
  const score = Math.round(metricValue(deriveScenarioFacts(state), ch.scoreMetric));
  return { ...state, challengeScore: score };
}

export interface ChallengeView {
  challenge: Challenge;
  /** Current value of the scored metric (live progress before the score locks). */
  current: number;
  /** The locked final score, or null while still in progress. */
  final: number | null;
  weeksLeft: number;
}

/** UI view of the active challenge (null for non-challenge runs). */
export function challengeViewFor(state: GameState): ChallengeView | null {
  const ch = state.activeChallenge;
  if (!ch) return null;
  const challenge = ch.kind === "weekly" ? weeklyChallenge(ch.dateKey) : dailyChallenge(ch.dateKey);
  return {
    challenge,
    current: Math.round(metricValue(deriveScenarioFacts(state), ch.scoreMetric)),
    final: state.challengeScore,
    weeksLeft: Math.max(0, ch.scoreWeek - state.week),
  };
}

/** Start a scenario run: a normal new game with the scenario's authored start overrides applied on
 *  top (era/cash/reputation/fans — the fields that vary a start without touching protected engine
 *  init). Scenarios skip the freeform onboarding + tutorial coach (the player chose a goal-driven
 *  run, not a fresh founding). Unknown id → a normal freeform game (defensive). */
export function newScenarioGame(scenarioId: string, seed = (Math.random() * 2 ** 31) >>> 0, legacy = 0): GameState {
  const base = newGame(seed, legacy);
  const scn = scenarioById(scenarioId);
  if (!scn) return base;
  const { era, cash, reputation, fans } = scn.setup;
  const startCash = cash ?? base.cash;
  return {
    ...base,
    activeScenario: scenarioId,
    era: era ?? base.era,
    cash: startCash,
    reputation: reputation ?? base.reputation,
    fans: fans ?? base.fans,
    onboarded: true,
    tutorialDone: true,
    cashHistory: [{ week: 0, cash: toDollars(startCash) }],
    feed: [feedItem(0, `Scenario started, ${scn.name}. ${scn.tagline}`, "accent")],
  };
}

/** Evaluate the active scenario against the current state. null for a freeform game (or an unknown
 *  scenario id). Pure — the UI tracker and the tick both read this. */
export function scenarioResultFor(state: GameState): ScenarioResult | null {
  if (!state.activeScenario) return null;
  const scn = scenarioById(state.activeScenario);
  if (!scn) return null;
  return evaluateScenario(scn, deriveScenarioFacts(state));
}

/** Advance the run-scoped scenario star count (pure, idempotent). Monotonic and only ever rises
 *  while stars are still EARNABLE (gated by canEarnStars), so it freezes once a deadline passes —
 *  the tracker reads this for a replay-accurate, history-free result. Folded into the tick like
 *  withChallengeScore. */
export function withScenarioRunStars(state: GameState): GameState {
  if (!state.activeScenario) return state;
  const scn = scenarioById(state.activeScenario);
  if (!scn || !canEarnStars(scn, state.week)) return state;
  const res = evaluateScenario(scn, deriveScenarioFacts(state));
  if (res.stars <= state.scenarioRunStars) return state;
  return { ...state, scenarioRunStars: res.stars };
}

// ---------- Derived selectors ----------
export const rndSkill = (s: GameState) => assignedSkill(s.staff, "rnd");
export const designerSkill = (s: GameState) => assignedSkill(s.staff, "design");
export const marketerSkill = (s: GameState) =>
  assignedSkill(s.staff, "marketing") * BALANCE.staff.marketerHypePerSkill;
export const facilityRent = (s: GameState): Money =>
  BALANCE.facilities[s.facilityTier - 1].weeklyRent;
export const facility = (s: GameState) => BALANCE.facilities[s.facilityTier - 1];
export const burn = (s: GameState): Money =>
  add(weeklyBurn(s.staff, facilityRent(s)), totalFactoryUpkeep(s.ownedFactories)) as Money;
export const designTierCeiling = (s: GameState) =>
  designCeiling(designerSkill(s)) + perfectionistCeilingBonus(s.staff) + designCeilingBonus(s.upgrades) + perkBonuses(s.legacy).designCeiling;
// ---------- Office shop: furniture buffs (capped, additive with the HQ upgrades) ----------
/** Mood-target bonus from the room's comfort furniture (capped). Added to the weekly mood target. */
export const officeComfortMoodBonus = (s: GameState): number =>
  Math.min(BALANCE.shop.comfortCap, officeAttrs(s.layout).comfort * BALANCE.shop.comfortK);
/** Research multiplier from the room's focus furniture (≥1, capped). */
export const officeFocusMult = (s: GameState): number =>
  1 + Math.min(BALANCE.shop.focusCap, officeAttrs(s.layout).focus * BALANCE.shop.focusK);
/** Design-stat bonus from the room's inspiration furniture (capped). */
export const officeInspoBonus = (s: GameState): number =>
  Math.min(BALANCE.shop.inspCap, officeAttrs(s.layout).inspiration * BALANCE.shop.inspK);
/** Can the player afford to buy + place this furniture id right now? */
export const canAffordFurniture = (s: GameState, type: FurnitureId): boolean =>
  s.cash >= dollars(furnitureCost(type));

export const weeklyRpGen = (s: GameState) => weeklyRp(s.staff, s.era) * rpMultiplier(s.upgrades) * officeFocusMult(s) * (1 + perkBonuses(s.legacy).rpMult);

/** The global multiplier applied to base RP output (R&D upgrades × office focus × legacy perk). */
export const rpGlobalMult = (s: GameState) => rpMultiplier(s.upgrades) * officeFocusMult(s) * (1 + perkBonuses(s.legacy).rpMult);

/** Weekly RP itemized by source, with the global multiplier folded in — so the displayed sum equals
 *  weeklyRpGen(s). Sorted by contribution, biggest first. For the Research "income" breakdown. */
export const weeklyRpSources = (s: GameState) => {
  const g = rpGlobalMult(s);
  return rpSources(s.staff, s.era)
    .map((src) => ({ ...src, rp: src.rp * g }))
    .sort((a, b) => b.rp - a.rp);
};
export const hypeBonus = (s: GameState) =>
  (hasProject(s.completedProjects, "brandStudio") ? 0.35 : 0) +
  (hasProject(s.completedProjects, "marketingAutomation") ? 0.20 : 0) +
  (hasProject(s.completedProjects, "megaLaunch") ? 0.30 : 0) +
  visionaryHype(s.staff) + marketingHype(s.upgrades) + perkBonuses(s.legacy).hype;

/** Which stat each engineering-doctrine house is built around (Track D fork). */
const DOCTRINE_STAT: Partial<Record<ProjectId, keyof Stats>> = {
  perfHouse: "performance",
  effHouse: "battery",
  qualityHouse: "quality",
};

/** D6: the engineering doctrine's "teeth": once a house is committed, a product that LEANS INTO its
 *  stat (that stat stands clearly above the build's average) earns a compounding launch-hype bonus, so
 *  the doctrine is a specialize-AND-build-aligned identity rather than a static +5. A balanced build
 *  (no stat stands out) keeps the +5 stat but earns nothing here, so this rewards specialization
 *  specifically. Pure; 0 when no doctrine is owned or the build does not lean into it. */
export function doctrineAlignHype(completedProjects: readonly ProjectId[], stats: Stats): number {
  let doc: keyof Stats | undefined;
  for (const proj of Object.keys(DOCTRINE_STAT) as ProjectId[]) {
    if (hasProject(completedProjects, proj)) { doc = DOCTRINE_STAT[proj]; break; }
  }
  if (!doc) return 0;
  const vals = Object.values(stats);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return stats[doc] >= mean + BALANCE.design.doctrineLeadMargin ? BALANCE.design.doctrineAlignHype : 0;
}

/** Ceiling for the summed launch hype bonus (studio + visionary marketers + marketing
 * upgrade + channel). scoreLaunch clamps total hype too; this caps the bonus side so
 * stacking marketers can't drive the launch score to absurd volumes. Safety guard, not a
 * balance lever — set well above any reachable legitimate bonus. */
const HYPE_BONUS_MAX = 3;

/** Coerce research points to a non-negative integer. Partial (offline, rate=0.5) ticks
 * accrue fractional RP, so floor on accrual to keep the counter a clean non-negative int. */
const floorRP = (n: number) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));

/** Product stats including bonuses from design specialists + the company's equipment. */
export function productStats(s: GameState, product: Product): Stats {
  const base = computeStats(product);
  const bonus = designSpecialtyBonus(s.staff);
  bonus.design = (bonus.design ?? 0) + designStatBonus(s.upgrades) + officeInspoBonus(s);
  bonus.quality = (bonus.quality ?? 0) + qualityStatBonus(s.upgrades);
  // Premium finishes (titanium/gold) read as more desirable → a small Design-appeal bonus.
  bonus.design = (bonus.design ?? 0) + (BALANCE.design.finishDesignBonus[product.finish] ?? 0);
  if (hasProject(s.completedProjects, "brandManual")) bonus.design = (bonus.design ?? 0) + 4;
  // Engineering Doctrine fork (Track D): the chosen house stamps a permanent stat identity on every
  // product. Mutually exclusive, so at most one of these ever applies.
  if (hasProject(s.completedProjects, "perfHouse")) bonus.performance = (bonus.performance ?? 0) + 5;
  if (hasProject(s.completedProjects, "effHouse")) bonus.battery = (bonus.battery ?? 0) + 5;
  if (hasProject(s.completedProjects, "qualityHouse")) bonus.quality = (bonus.quality ?? 0) + 5;
  // Performance/efficiency tuning — trades points between performance and battery (a real build
  // choice that depends on what the market wants). Neutral when balanced/undefined → no ripple.
  const shift = BALANCE.design.tuningShift;
  if (product.tuning === "performance") {
    bonus.performance = (bonus.performance ?? 0) + shift;
    bonus.battery = (bonus.battery ?? 0) - shift;
  } else if (product.tuning === "efficiency") {
    bonus.battery = (bonus.battery ?? 0) + shift;
    bonus.performance = (bonus.performance ?? 0) - shift;
  } else if (product.tuning === "value" || product.tuning === "premium") {
    // Margin axis: "premium" buys quality+design appeal (and costs more to build, see
    // effectiveUnitCost/toolingCost); "value" trades that appeal away for a cheaper build.
    const m = product.tuning === "premium" ? BALANCE.design.marginShift : -BALANCE.design.marginShift;
    bonus.quality = (bonus.quality ?? 0) + m;
    bonus.design = (bonus.design ?? 0) + m;
  }
  // Named synergy archetypes (Track D): high-end component pairings unlock a themed, capped stat
  // bonus. Neutral (empty) until a build hits the high tiers, so early/old products are unchanged.
  const arche = archetypeBonus(product);
  for (const k of Object.keys(arche) as (keyof Stats)[]) bonus[k] = (bonus[k] ?? 0) + (arche[k] ?? 0);

  // Platform / OS division — the OS your devices run lifts their ecosystem stat (a strong OS makes
  // every device you ship better), and the chosen OS philosophy tilts a stat of its own. Gated on the
  // entitlement, so the base game is byte-identical until the player opts into the division.
  if (s.platformUnlocked) {
    bonus.ecosystem = (bonus.ecosystem ?? 0) + osEcosystemBonus(s.osFeatures);
    const phil = philosophyStatBonus(s.osPhilosophy);
    for (const k of Object.keys(phil) as (keyof Stats)[]) bonus[k] = (bonus[k] ?? 0) + (phil[k] ?? 0);
  }
  const out = { ...base };
  for (const k of Object.keys(bonus) as (keyof Stats)[]) {
    // Clamp BOTH ends (tuning can subtract): never below 0, never above statMax.
    out[k] = Math.max(0, Math.min(BALANCE.statMax, Math.round(out[k] + (bonus[k] ?? 0))));
  }
  return out;
}

/** Cash cost to buy the next tier of an upgrade line (null if maxed). */
export function upgradeCost(s: GameState, id: UpgradeId): Money | null {
  return nextUpgradeCost(id, s.upgrades[id] ?? 0);
}

/** Tiers whose purchase physically changes the 3D office — the feed says what appeared, so the
 *  upgrade visibly "did something" beyond a stat line (Garage3D renders these objects). */
const UPGRADE_ROOM_CHANGES: Partial<Record<UpgradeId, Record<number, string>>> = {
  amenities: { 1: "A coffee station appeared in your office.", 2: "A new plant brightens the room.", 3: "More greenery arrives.", 4: "The office is turning lush." },
  marketing: { 1: "A branded wall screen now plays your campaigns." },
  designSuite: { 1: "A drafting easel stands by the wall." },
  testLab: { 1: "A glass test chamber hums in the corner." },
  computers: { 3: "Every desk gains a second monitor." },
};

/** Cash cost of the next tier, OR the research project that must be completed first (locked). */
export function upgradeGate(s: GameState, id: UpgradeId): ProjectId | null {
  return upgradeLockedBy(id, (s.upgrades[id] ?? 0) + 1, s.completedProjects);
}

export function buyUpgrade(state: GameState, id: UpgradeId): GameState {
  const cur = state.upgrades[id] ?? 0;
  const cost = nextUpgradeCost(id, cur);
  if (cost === null || state.cash < cost) return state;
  // The advanced tiers are research-gated — refuse until the prerequisite project is done.
  if (upgradeLockedBy(id, cur + 1, state.completedProjects) !== null) return state;
  const line = upgradeLine(id);
  const feed = [...state.feed];
  const roomChange = UPGRADE_ROOM_CHANGES[id]?.[cur + 1];
  feed.push(feedItem(state.week, `Upgraded ${line.name} → ${line.tierNames[cur]}.${roomChange ? ` ${roomChange}` : ""}`, "accent"));
  return {
    ...state,
    cash: sub(state.cash, cost),
    upgrades: { ...state.upgrades, [id]: cur + 1 },
    feed: trimFeed(feed),
  };
}

/** Price of the next garage desktop, or null when the player already owns the maximum. */
export function desktopCost(owned: number): Money | null {
  if (owned >= BALANCE.desktops.max) return null;
  const tiers = BALANCE.desktops.cost;
  return tiers[owned] ?? tiers[tiers.length - 1];
}

/** Buy one more standalone computer desk for the garage (capped at BALANCE.desktops.max). */
export function buyDesktop(state: GameState): GameState {
  const cost = desktopCost(state.desktops);
  if (cost === null || state.cash < cost) return state;
  const feed = trimFeed([...state.feed, feedItem(state.week, "Set up a new office desk in the garage.", "accent")]);
  return { ...state, cash: sub(state.cash, cost), desktops: state.desktops + 1, feed };
}

/** Pay to open distribution into a new geographic market (engine/regions.ts). No-op if it's already
 *  unlocked, unknown, or unaffordable. Sandbox/Creative cash floor still applies via the normal path. */
export function unlockRegion(state: GameState, id: RegionId): GameState {
  const region = regionById(id);
  if (!region || state.unlockedRegions.includes(id) || state.cash < region.unlockCost) return state;
  const feed = trimFeed([...state.feed, feedItem(state.week, `Expanded into ${region.name}, a new market is open.`, "positive")]);
  return { ...state, cash: sub(state.cash, region.unlockCost), unlockedRegions: [...state.unlockedRegions, id], feed };
}

/** Company supply-crunch exposure WITH contracts: a contracted supplier is price-locked → immune
 *  (contributes 0); otherwise the product's crunch multiplier. Mirrors the pure sourcingExposure's
 *  source selection (in-production builds, else last shipped, else neutral). */
function sourcingExposureWithContracts(s: GameState): number {
  const products = s.building.length
    ? s.building.map((j) => j.product)
    : s.launched.length
      ? [s.launched[s.launched.length - 1].product]
      : [];
  if (!products.length) return 1;
  const mults = products.map((p) => {
    const sid = p.supplierId ?? DEFAULT_SUPPLIER_ID;
    const c = s.supplierContracts?.[sid];
    if (c && c.weeksLeft > 0) return 0; // price-locked → immune to the crunch
    return supplierCrunchMult(p);
  });
  return mults.reduce((a, b) => a + b, 0) / mults.length;
}

/** Upfront fee to sign a supplier contract: scales with the term length and the tech era. */
export function contractSignFee(era: number, term: ContractTerm): Money {
  return scale(BALANCE.supply.contract.signFeeBase, (term.weeks / 13) * Math.max(1, era));
}

/** Negotiate a fixed-price contract with a supplier: pay the sign fee to lock a discount (your
 *  reputation sweetens the terms) + crunch immunity for the term. No-op if the supplier is era-locked
 *  or you can't afford the fee. Re-signing replaces the existing contract. */
export function negotiateContract(state: GameState, supplierId: SupplierId, termId: ContractTerm["id"]): GameState {
  const sup = supplierFor(supplierId);
  if (sup.era > state.era) return state;
  const term = contractTerm(termId);
  const fee = contractSignFee(state.era, term);
  if (state.cash < fee) return state;
  const discount = contractDiscount(term, state.reputation, BALANCE.supply.contract.repDiscountMax);
  const feed = trimFeed([...state.feed, feedItem(
    state.week,
    `Signed a ${term.name.toLowerCase()} contract with ${sup.name}, ${Math.round(discount * 100)}% off, price-locked for ${term.weeks} wk.`,
    "positive",
  )]);
  return {
    ...state,
    cash: sub(state.cash, fee),
    supplierContracts: { ...state.supplierContracts, [supplierId]: { discount, weeksLeft: term.weeks } },
    feed,
  };
}

/** Buy an OWNED manufacturing line (engine/factories.ts): pay the one-time acquire cost; from then
 *  it carries weekly upkeep and can be selected for builds. No-op if it's not an owned line, already
 *  owned, era-locked, or unaffordable. */
export function acquireFactory(state: GameState, id: FactoryId): GameState {
  const fac = factoryFor(id);
  const owned = state.ownedFactories ?? [];
  if (fac.kind !== "owned" || owned.includes(id) || !isFactoryUnlocked(id, state.era) || state.cash < fac.acquireCost) return state;
  const feed = trimFeed([...state.feed, feedItem(state.week, `Acquired ${fac.name}, your own production line (${format(fac.weeklyUpkeep)}/wk upkeep).`, "positive")]);
  return { ...state, cash: sub(state.cash, fac.acquireCost), ownedFactories: [...owned, id], feed };
}
export const projectBuildFast = (s: GameState) => hasProject(s.completedProjects, "assemblyLine");
export const buildWeeksFor = (s: GameState, product?: Product) => {
  // Supplier sourcing lead time adds weeks on top of the assembly time (a far, cheap supplier is
  // slower to the line). Unset/standard supplier → 0, so existing callers (no product) are unchanged.
  const lead = product ? supplierLeadWeeks(product) : 0;
  // The very first product of a brand-new company builds fast (minWeeks): a first-time player
  // reaches the launch keynote — the game's core payoff — in a beat instead of watching ~3 weeks
  // tick by during the tutorial. So the first hit of dopamine (and the App Store review prompt that
  // rides it) lands sooner. First playthrough only (legacy 0), first build only (nothing in flight).
  const firstEver = s.legacy === 0 && s.launched.length === 0 && s.building.length === 0 && s.ready.length === 0;
  if (firstEver) return BALANCE.build.minWeeks + lead;
  // Factory speed multiplies the assembly time (a fast line ships sooner); standard = ×1.
  const speed = product ? factorySpeedMult(product) : 1;
  const assembly = Math.round((buildWeeks(rndSkill(s), projectBuildFast(s)) - buildWeekReduction(s.upgrades)) * speed)
    - (hasProject(s.completedProjects, "quickPrototype") ? 1 : 0);
  // Living Late Game: late eras add manufacturing lead time (eraModifier.leadWeeks; 0 in eras 1–2),
  // so the endgame ships fewer, weightier products instead of a near-continuous relaunch conveyor.
  const eraLead = eraModifier(s.era).leadWeeks;
  return Math.max(BALANCE.build.minWeeks, assembly) + lead + eraLead;
};

/** Resolve a run against its factory's capacity + the product's capacity strategy (overtime / stretch
 *  / defects). Shared by planProduction (cost + weeks) and the build wizard (the prospective quality
 *  hit it bakes onto the product). `assemblyWeeks` is the pre-stretch build time. */
export function capacityPlan(s: GameState, product: Product, plannedUnits: number): CapacityOutcome {
  return resolveCapacity({
    plannedUnits: Math.max(0, Math.round(plannedUnits)),
    capacityPerWeek: factoryCapacityPerWeek(product),
    assemblyWeeks: buildWeeksFor(s, product),
    strategy: product.capacityStrategy ?? "overtime",
    overtimeSurcharge: BALANCE.factory.overtimeSurcharge,
    defectMaxPenalty: BALANCE.factory.defectMaxPenalty,
  });
}

/** Upfront tooling / first-production-run cost charged when a build starts (Assembly cuts it). */
export function toolingCost(s: GameState, product: Product): Money {
  const margin = tuningCostMultiplier(product.tuning);
  const perk = 1 - perkBonuses(s.legacy).buildCostMult; // NG+ Supply Chain / Industrialist perks
  // Living Late Game: late eras tool up bigger (eraModifier.toolingMult; 1.0 in eras 1–2 → no-op).
  const eraTooling = eraModifier(s.era).toolingMult;
  const base = scale(buildCost(product), BALANCE.build.toolingUnits * buildCostMult(s.upgrades) * margin * perk * factoryToolingMult(product) * eraTooling);
  return base > BALANCE.build.minTooling ? base : BALANCE.build.minTooling;
}

/** Per-unit manufacturing cost after company projects + upgrades + the value/premium margin axis
 *  + any NG+ build-cost perks. */
export function effectiveUnitCost(s: GameState, product: Product): Money {
  let unitCost = scale(buildCost(product), tuningCostMultiplier(product.tuning));
  if (hasProject(s.completedProjects, "leanSupply")) unitCost = scale(unitCost, 0.85);
  if (hasProject(s.completedProjects, "verticalIntegration")) unitCost = scale(unitCost, 0.80);
  unitCost = scale(unitCost, 1 - perkBonuses(s.legacy).buildCostMult);
  unitCost = scale(unitCost, factoryUnitMult(product)); // factory assembly cost (standard = ×1)
  // Supplier relationship: repeat business earns a standing discount (engine/suppliers.ts). 0 when
  // you've no history with this supplier, so it's a no-op for fresh games / older saves.
  const sid = product.supplierId ?? DEFAULT_SUPPLIER_ID;
  const loyaltyDiscount = supplierLoyaltyDiscount(s.supplierLoyalty?.[sid] ?? 0);
  if (loyaltyDiscount > 0) unitCost = scale(unitCost, 1 - loyaltyDiscount);
  // A fixed-price contract locks in a further discount on top of the relationship rate.
  const contract = s.supplierContracts?.[sid];
  if (contract && contract.weeksLeft > 0 && contract.discount > 0) unitCost = scale(unitCost, 1 - contract.discount);
  return scale(unitCost, buildCostMult(s.upgrades));
}

export interface ProductionPlan {
  plannedUnits: number;
  unitCost: Money;
  productionCost: Money; // unitCost × plannedUnits (paid upfront at build)
  tooling: Money;
  channelCost: Money;
  totalUpfront: Money;
  overtimeCost: Money; // surcharge for units built beyond factory capacity (0 = within capacity)
  overtimeUnits: number; // units that exceeded capacity × build-weeks
  overCapacity: boolean; // the run pushes the factory past its throughput
  factoryCapacityPerWeek: number; // chosen factory's weekly throughput (Infinity = no ceiling)
  assemblyWeeks: number; // base build duration before any capacity stretch
  buildWeeks: number; // resolved build duration (= assemblyWeeks, or longer under the "stretch" strategy)
  capacityStrategy: CapacityStrategy; // how an over-capacity run is being handled
  launchScore: number;
  demandFit: number; // 0..100 — how well the product matches current demand
  priceFit: number; // 0..1.35 — price fairness vs. perceived value (1 = on the money; →0 = gouging)
  hype: number; // total launch hype multiplier (reputation + marketing)
  overall: number; // product's overall quality score
  matchingRivals: number; // rivals roughly as good as you, splitting the market
  betterRivals: number; // rivals clearly better than you
  selfCompeting: number; // your OWN products still selling in this category (cannibalization)
  competitionFactor: number; // 0..1 share you keep after competition
  noveltyMult: number; // 0..1 organic-demand multiplier from market fatigue (1 = fresh)
  similarTo?: string; // the recent too-similar product dragging novelty down (if any)
  similarWeeksAgo?: number; // weeks since that product launched
  synergy: number; // 0.8..1.06 — component-combination balance (weak-link penalty / flagship bonus)
  preOrders: number; // guaranteed buyers from your fanbase
  marketDemand: number; // additional organic demand (after competition)
  totalDemand: number; // preOrders + marketDemand
  projectedSales: number; // min(plannedUnits, totalDemand)
  sellsOut: boolean;
  projectedRevenue: Money;
  projectedProfit: Money; // revenue − full production − tooling − channel (unsold = sunk cost)
  maxAffordableUnits: number;
  segments: SegmentDemand; // Epic A — per-buyer-segment breakdown driving demand + the verdict
  brand: BrandEquity; // product-line brand equity lifting pre-orders + launch hype
}

/** The smart demand model: fans (pre-orders) + demand-fit + how many rivals match/beat you.
 *  Pure — drives both the build-wizard preview and the actual launch. */
export function planProduction(
  s: GameState,
  product: Product,
  plannedUnits: number,
  channelId: ChannelId = "none",
): ProductionPlan {
  const stats = productStats(s, product);
  const unitCost = effectiveUnitCost(s, product);
  const tooling = toolingCost(s, product);
  const channel = channelById(channelId);

  let marketSize = CATEGORIES[product.category].marketSize;
  if (hasProject(s.completedProjects, "globalDistribution")) marketSize *= 1.25;
  // Era-scaled volume — small early market (slow garage phase), grows each era.
  const eraScales = BALANCE.market.eraVolumeScale;
  marketSize *= eraScales[Math.max(0, Math.min(s.era - 1, eraScales.length - 1))];
  // Global expansion (engine/regions.ts): scale the addressable market by the regions this product
  // ships to. Home-only is exactly ×1.0, so this never changes a domestic launch or an old save.
  marketSize *= regionReach(s.unlockedRegions, product.regions, stats, s.week);

  // Epic A — segmented demand. The market is split into buyer segments (engine/segments.ts), each
  // weighting the five stats AND price differently; the product wins a share of each, summed. This
  // replaces the single global demandScore/priceFit with a positioning decision ("who is this for?").
  // A balanced product scores ≈ the old single-trend demand (the segment sizes average back to it),
  // so the macro-economy is preserved; lopsided products diverge — that divergence IS the new depth.
  // G1 — the device's form (styleAppeal) lifts the Style segment, so the parametric render is a lever.
  // D1: the build's tier bottleneck feeds the segment model's coherence discount (computed once here
  // and reused for the global synergy factor below, so the two never diverge).
  const synergy = componentSynergy(product);
  // D2: the chosen campaign's segment affinity amplifies that segment's reach, so matching the channel
  // to the product's audience is a real launch decision. D3: reputation widens the price band, so an
  // established brand can sustainably charge a premium a no-name brand could not.
  const segments = segmentDemand(stats, product.price, s.trends, product.category, styleAppeal(product), s.week, synergy.bottleneck, channel.affinity, brandPriceToleranceMult(s.reputation));

  // Epic D — the Platform/AI eras amplify marketing reach (reputation/word-of-mouth is era-neutral).
  const mktMult = eraModifier(s.era).marketingHype;
  // Brand equity — a proven product LINE launches with loyal pre-orders + anticipation (0 for a new
  // line, so this never changes a first-in-line launch).
  const brand = brandEquity(s.launched, franchiseStem(product.name));

  // Score WITHOUT the strength-based competition term — competition is modelled below as a
  // count of rivals that match/beat you, which is clearer and is what the player sees.
  const breakdown = scoreLaunch({
    stats,
    category: product.category,
    price: product.price,
    trends: s.trends,
    reputation: s.reputation,
    marketerSkill: marketerSkill(s) * mktMult,
    competitorStrength: 0,
    // Bound the combined hype bonus (studio + visionary marketers + marketing upgrade +
    // channel) before it reaches scoreLaunch, which also clamps total hype. Without this,
    // stacking many visionary marketers makes launchScore/volume explode. Safety guard.
    // D6: a committed engineering doctrine adds compounding hype when the build leans into its stat.
    hypeBonus: Math.max(0, Math.min(HYPE_BONUS_MAX, (hypeBonus(s) + channel.hype + doctrineAlignHype(s.completedProjects, stats)) * mktMult + equityHypeBonus(brand.equity))),
    // Component-combination synergy: a glaring weak link drags the launch down; a coherent build
    // is rewarded — so designing the right MIX of components matters, not just maxing each slot.
    synergy: synergy.factor,
    // Drive demand + price reaction from the segment model (the two aggregates are on the same
    // 0..100 / 0..maxFit scales as the originals they replace).
    demandOverride: segments.demandIndex,
    priceFitOverride: segments.effectivePriceFit,
  });

  const overall = overallScore(stats, product.category);
  const comp = BALANCE.market.competition;
  const margin = comp.beatMargin;
  // D5: the player's positioning, read by the rival-doctrine counters: a build priced under fair
  // value undercuts; priced over it goes premium; launching into a rising category out-times a
  // trend-chaser. A rival whose doctrine is countered presses less hard (penalty scaled by relief).
  const fairValueDollars = Math.max(1, overall * toDollars(BALANCE.market.price.valueToPrice));
  const positioning = {
    priceRatio: toDollars(product.price) / fairValueDollars,
    trendRising: categoryTrendDirection(s.trends, product.category) === "rising",
  };
  const up = licenseeStrengthUplift();
  let matchingRivals = 0;
  let betterRivals = 0;
  let rivalPenalty = 0;
  for (const c of s.competitors) {
    const base = c.strengthByCategory[product.category];
    if (!base || base <= 0) continue;
    // Licensees of your OS compete harder in shared categories (the Phase-C trade-off for their fee).
    const strength = s.osLicensees?.includes(c.id) ? base + up : base;
    const relief = countersDoctrine(rivalDoctrine(c.id), positioning, comp.doctrine) ? comp.doctrine.relief : 1;
    if (strength > overall + margin) { betterRivals++; rivalPenalty += comp.beatPenalty * relief; }
    else if (strength >= overall - margin) { matchingRivals++; rivalPenalty += comp.matchPenalty * relief; }
  }
  // Self-competition: your OWN products still selling in this category split the same buyers.
  // Without this, relaunching one proven design back-to-back farmed a fresh, full demand pool
  // every time — the dominant no-thought strategy. Tracked separately from rivals so the wizard
  // can tell the player exactly why demand shrank.
  let selfCompeting = 0;
  for (const lp of s.launched) {
    if (lp.product.category === product.category && lp.weeksElapsed < lp.weeklyUnits.length) selfCompeting++;
  }
  // Era-scaled pressure: the Garage Era protects new players from being crushed before they've
  // built up; full competitive pressure applies from the Growth Era on.
  const pressure = comp.eraPressure[Math.max(0, Math.min(s.era - 1, comp.eraPressure.length - 1))];
  const competitionFactor =
    1 /
    (1 +
      // D5: rivalPenalty is the per-rival match/beat penalty sum WITH doctrine-counter relief folded
      // in (equals matchingRivals*matchPenalty + betterRivals*beatPenalty when nothing is countered).
      rivalPenalty * pressure +
      // Self-competition is era-independent: cannibalization is about YOUR line-up, not rivals.
      selfCompeting * comp.selfPenalty);

  const demandFit = breakdown.demand;
  // A proven line's loyal followers pre-order more strongly (brand equity → preorder lift).
  const rawPreOrders = Math.round(s.fans * BALANCE.fans.preOrderConversion * (demandFit / 100) * (1 + equityPreorderBonus(brand.equity)));
  const organic = forecast(breakdown.launchScore, marketSize, breakdown.priceFit).totalUnits;
  const competedOrganic = Math.round(organic * competitionFactor); // before market fatigue
  // Market fatigue: a product too similar to a recent same-category launch loses ORGANIC demand
  // (the broad market won't re-buy a rehash). Fans (pre-orders) are NOT fatigued — they still want
  // the sequel — so this multiplies only the organic market, and the pre-order ceiling below is
  // based on the un-fatigued organic. Real spec upgrades or elapsed time clear it. See novelty.ts.
  const novelty = noveltyFor(product, s.launched, s.week);
  const marketDemand = Math.round(competedOrganic * novelty.mult);
  // B4 — cap fan pre-orders to a share of TOTAL demand so a huge fanbase can't single-handedly
  // satisfy (and guarantee a sellout of) a token run. Pre-orders may cover at most preOrderCap of
  // (preOrders + organic market); the rest must come from the open market. Keeps fans meaningful
  // without letting them trivialise the production bet. Uses the un-fatigued organic so market
  // sameness never shrinks the loyal pre-order base.
  const cap = BALANCE.fans.preOrderCap;
  // Solve preOrders ≤ cap × (preOrders + competedOrganic) → preOrders ≤ cap/(1-cap) × competedOrganic.
  const preOrderCeil = cap < 1 ? Math.round((cap / (1 - cap)) * competedOrganic) : rawPreOrders;
  const preOrders = Math.min(rawPreOrders, preOrderCeil);
  const totalDemand = preOrders + marketDemand;

  const planned = Math.max(0, Math.round(plannedUnits));
  const projectedSales = Math.min(planned, totalDemand);
  const sellsOut = totalDemand > planned && planned > 0;

  // Factory throughput: a run beyond capacity × build-weeks is resolved by the product's capacity
  // strategy — overtime cost, a stretched schedule, or (baked separately) defects. The neutral
  // "standard" factory has unlimited capacity → no overage → zero ripple for old saves/default.
  const capacityPerWeek = factoryCapacityPerWeek(product);
  const capOutcome = capacityPlan(s, product, planned);
  const overtimeCost = scale(unitCost, capOutcome.overUnits * capOutcome.overtimeFraction);

  const productionCost = scale(unitCost, planned);
  const channelCost = channel.cost;
  const totalUpfront = add(add(add(tooling, productionCost), channelCost), overtimeCost) as Money;
  const projectedRevenue = scale(product.price, projectedSales);
  const projectedProfit = sub(sub(projectedRevenue, add(productionCost, overtimeCost)), add(tooling, channelCost)) as Money;
  const spendable = sub(s.cash, add(tooling, channelCost));
  const maxAffordableUnits = unitCost > 0 ? Math.max(0, Math.floor(toDollars(spendable) / toDollars(unitCost))) : BALANCE.build.maxRun;

  return {
    plannedUnits: planned,
    unitCost,
    productionCost,
    tooling,
    channelCost,
    totalUpfront,
    overtimeCost,
    overtimeUnits: capOutcome.overUnits,
    overCapacity: capOutcome.overUnits > 0,
    factoryCapacityPerWeek: capacityPerWeek,
    assemblyWeeks: buildWeeksFor(s, product),
    buildWeeks: capOutcome.buildWeeks,
    capacityStrategy: product.capacityStrategy ?? "overtime",
    launchScore: breakdown.launchScore,
    demandFit,
    priceFit: breakdown.priceFit,
    hype: breakdown.hype,
    overall,
    matchingRivals,
    betterRivals,
    selfCompeting,
    competitionFactor,
    noveltyMult: novelty.mult,
    similarTo: novelty.similarTo,
    similarWeeksAgo: novelty.weeksAgo,
    synergy: breakdown.synergy,
    preOrders,
    marketDemand,
    totalDemand,
    projectedSales,
    sellsOut,
    projectedRevenue,
    projectedProfit,
    maxAffordableUnits,
    segments,
    brand,
  };
}

/** Safety reserve the recommended run must leave untouched so the player stays solvent THROUGH
 *  the build (rent/payroll burn for buildWeeks, no revenue yet) + a small flat margin. B1: without
 *  this, recommending a run that spends nearly all cash on tooling+units bankrupts a fresh save
 *  before its first product ever launches. */
export function buildSafetyReserve(s: GameState, product?: Product): Money {
  const weeks = buildWeeksFor(s, product);
  return add(scale(burn(s), weeks), BALANCE.build.safetyReserveMargin) as Money;
}

/** Units you can afford while still leaving the build-through safety reserve intact. B1. */
export function affordableRun(s: GameState, product: Product, channelId: ChannelId = "none"): number {
  const probe = planProduction(s, product, BALANCE.build.minRun, channelId);
  const reserve = buildSafetyReserve(s, product);
  // Cash left for tooling+units after holding back the reserve, then after paying fixed costs
  // (tooling + channel) the rest funds units.
  const spendable = sub(sub(s.cash, reserve), add(probe.tooling, probe.channelCost));
  if (toDollars(probe.unitCost) <= 0) return BALANCE.build.maxRun;
  const units = Math.floor(toDollars(spendable) / toDollars(probe.unitCost));
  return Math.max(0, units);
}

/** A sensible default production run: the projected demand, capped by what you can afford WHILE
 *  keeping the build-through safety reserve (B1). Never recommends a run that bankrupts you mid-build. */
export function recommendedRun(s: GameState, product: Product, channelId: ChannelId = "none"): number {
  const probe = planProduction(s, product, BALANCE.build.defaultRun, channelId);
  const target = Math.max(BALANCE.build.minRun, Math.round(probe.totalDemand));
  const safeMax = affordableRun(s, product, channelId);
  // If even the floor run breaches the reserve, still allow the minimum so the wizard stays usable
  // (the wizard surfaces the runway warning) — but prefer the safe, demand-matched run.
  const capped = Math.min(target, Math.max(BALANCE.build.minRun, safeMax));
  return Math.max(BALANCE.build.minRun, capped);
}
export const counts = (s: GameState) => ({ assigned: s.staff.filter((x) => x.assignment !== "idle").length });

/** Recurring-services revenue multiplier from the OS division (1 unless the division is unlocked).
 *  Steps up with each released OS version, each installed module + synergy, and the chosen philosophy
 *  (re-capped at servicesMultCap so the philosophy can't break the rail). */
export const osServicesMult = (s: GameState): number =>
  s.platformUnlocked
    ? Math.min(
        BALANCE.platform.features.servicesMultCap,
        osServicesMultiplier(s.osVersion, s.osFeatures) + philosophyServicesMult(s.osPhilosophy),
      )
    : 1;

/** Weekly ecosystem service income from all launched products with an ecosystem stat above threshold. */
export function weeklyEcosystemRevenue(s: GameState): Money {
  // Epic D — the Platform/AI eras amplify ecosystem lock-in (services pay more).
  const rate = BALANCE.ecosystem.weeklyServiceRate * eraModifier(s.era).ecosystemRate;
  const minStat = BALANCE.ecosystem.minEcosystemStat;
  let acc = 0;
  for (const lp of s.launched) {
    const eco = lp.stats.ecosystem;
    if (eco > minStat) acc += lp.unitsSold * eco * rate;
  }
  // OS feature modules + version multiply recurring services (1.0 when the division is off → unchanged).
  return cents(Math.round(acc * osServicesMult(s)));
}

export function nextWeekRevenue(s: GameState): Money {
  let acc = 0;
  for (const lp of s.launched) {
    if (lp.weeksElapsed < lp.weeklyUnits.length) {
      const units = lp.weeklyUnits[lp.weeksElapsed];
      // Production was prepaid at build, so a sale brings the FULL price into cash — subtracting
      // unitCost here made every runway/forecast read low while a product was selling.
      acc += units * lp.product.price;
    }
  }
  return add(cents(acc), weeklyEcosystemRevenue(s));
}

export function researchedTier(s: GameState, kind: ComponentKind): number {
  return s.researched[kind] ?? 0;
}

/** RP cost to unlock the next tier of a component line (null if maxed or era-locked). */
export function rdRpCostFor(s: GameState, kind: ComponentKind): number | null {
  const next = researchedTier(s, kind) + 1;
  const def = tierDef(kind, next);
  if (!def) return null;
  if (def.era > s.era) return null; // gated by era
  let base = techRpCost(toDollars(def.rdCost));
  if (hasProject(s.completedProjects, "prototypeBench")) base = Math.max(1, Math.round(base * 0.8));
  if (hasProject(s.completedProjects, "componentStandards")) base = Math.max(1, Math.round(base * 0.85));
  return base;
}

// ---------- Reducers (pure: return a NEW state) ----------

export function advanceOneWeek(state: GameState, rate = 1, offline = false): GameState {
  if (state.bankrupt) return state;
  // Delegation (Epic E): apply enabled, capability-gated automations BEFORE the week runs, so an
  // auto-assigned staffer contributes this week and an auto-claimed project is active immediately.
  // Pure + off by default, so a save without delegation is byte-identical (determinism preserved).
  state = applyWeeklyAutomation(state);
  const rng = rngFrom(state);
  const week = state.week + 1;

  // Trends
  let trends = state.trends;
  let trendRetargetWeek = state.trendRetargetWeek;
  let newTarget: Stats | undefined;
  if (week >= state.trendRetargetWeek) {
    newTarget = randomTrendTarget(rng);
    trendRetargetWeek =
      week +
      BALANCE.market.trendDrift.retargetEveryWeeks +
      rng.int(BALANCE.market.trendDrift.retargetJitter);
  }
  trends = advanceTrends(trends, newTarget);

  // Competitors — pass the player's recent hit categories so the lead rival can react.
  const hitWindow = BALANCE.competitors.reactHitWindowWeeks;
  const recentPlayerHitCats = state.launched
    .filter((lp) => lp.launchedWeek >= week - hitWindow && (lp.verdict === "hit" || lp.verdict === "solid"))
    .map((lp) => lp.product.category);
  const { competitors: competitorsBase, launches, arcBeats } = advanceCompetitors(state.competitors, week, state.era, rng, recentPlayerHitCats);
  // `let` so B3 can append a fresh challenger that rises to refill a field thinned by acquisitions.
  let competitors = competitorsBase;

  // Sales + revenue
  let cash = state.cash;
  let cumulativeRevenue = state.cumulativeRevenue;
  const productsFeed: FeedItem[] = [];
  const launched = state.launched.map((lp) => {
    if (lp.weeksElapsed >= lp.weeklyUnits.length) return lp;
    const units = lp.weeklyUnits[lp.weeksElapsed];
    // Production was paid upfront at build, so each sale brings FULL price into cash.
    const gross = scale(lp.product.price, units * rate);
    cash = add(cash, gross);
    cumulativeRevenue = add(cumulativeRevenue, gross);
    const newElapsed = lp.weeksElapsed + 1;
    const newUnitsSold = Math.min(lp.totalUnits, lp.unitsSold + Math.round(units * rate));
    const newRevenue = add(lp.revenueToDate, gross);
    // When the last sales week completes, surface a lifecycle summary in the feed.
    if (newElapsed >= lp.weeklyUnits.length) {
      const sellThrough = lp.plannedUnits && lp.plannedUnits > 0
        ? Math.round((lp.totalUnits / lp.plannedUnits) * 100)
        : 100;
      productsFeed.push(feedItem(
        week,
        `"${lp.product.name}" lifecycle complete, ${newUnitsSold.toLocaleString()} sold (${sellThrough}% sell-through), ${format(newRevenue)} total.`,
        sellThrough >= 85 ? "positive" : "neutral",
      ));
    }
    return {
      ...lp,
      weeksElapsed: newElapsed,
      // Cap at the run's total so "X of Y sold" can never exceed Y on a partial (offline,
      // rate=0.5) tick where rounding could otherwise push the cumulative count over.
      unitsSold: newUnitsSold,
      revenueToDate: newRevenue,
    };
  });

  // Revenue milestones
  for (const item of revMilestoneItems(state.cumulativeRevenue, cumulativeRevenue, week)) {
    productsFeed.push(item);
  }

  // Ecosystem service revenue — recurring income from the installed base of high-ecosystem
  // products. Reads the freshly-updated `launched` (not `state.launched`) so this week's sales
  // join the installed base immediately instead of paying with a one-week lag.
  const ecosystemRate = BALANCE.ecosystem.weeklyServiceRate * eraModifier(state.era).ecosystemRate;
  const ecoMinStat = BALANCE.ecosystem.minEcosystemStat;
  // OS feature modules + released version multiply services income (1.0 when the division is off, so
  // this is identical to the prior calculation for the base game).
  const osMult = osServicesMult(state);
  for (const lp of launched) {
    const eco = lp.stats.ecosystem;
    if (eco > ecoMinStat) {
      cash = add(cash, cents(Math.round(lp.unitsSold * eco * ecosystemRate * osMult * rate)));
    }
  }

  // Platform licensing fees — recurring income from rivals licensing your OS (Phase C).
  cash = add(cash, scale(weeklyLicenseFees(state), rate));

  // Burn
  cash = sub(cash, scale(burn(state), rate));

  // Loan debt service (Track C financing): amortize outstanding loans + take this week's payment.
  // Defaults to a no-op when the player has no debt, so a never-borrows game (and the harness) is
  // byte-identical. Scaled by `rate` so a partial offline catch-up tick services debt proportionally.
  let loans = state.loans ?? [];
  if (loans.length) {
    const serviced = accrueLoans(loans, rate);
    loans = serviced.loans;
    cash = sub(cash, cents(serviced.payment));
  }

  // Dividend income from rival shares the player holds (uses this week's fresh prices).
  cash = add(cash, scale(weeklyDividends(state.holdings, competitors), rate));

  // Creative / sandbox mode: top cash up to the (effectively unlimited) floor for free experimentation.
  if (state.sandboxUnlocked && cash < BALANCE.creative.cashFloor) cash = BALANCE.creative.cashFloor;

  // Feed events
  const feed = [...state.feed];
  for (const item of productsFeed) feed.push(item);
  // Rival launches: flag when a rival enters a category where the player has an active product.
  const activePlayerCats = new Set<CategoryId>(
    state.launched
      .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
      .map((lp) => lp.product.category),
  );

  // Epic B — turn each rival launch into a real, renderable product the player can see and learn from
  // (visibility only; the strength number above still drives the market math, so no balance ripple).
  // A DERIVED rng (seeded from the save + week + index) keeps the MAIN sim rng stream byte-identical,
  // so the pinned determinism test and every seed-specific test are unaffected.
  let rivalReleases = state.rivalReleases;
  let rivalLineCounters = state.rivalLineCounters;
  if (launches.length) {
    const idByName = new Map(competitors.map((c) => [c.name, c.id]));
    // The series number for a rival's category line comes from an UNCAPPED per-line counter (not the
    // capped rivalReleases gallery), so "Pomelo Lumen 2/3/4" never regresses once old releases slice off.
    const nextSeriesIndex = (rivalId: string, category: CategoryId): number => {
      const key = `${rivalId}:${category}`;
      const index = rivalLineCounters[key] ?? 0;
      rivalLineCounters = { ...rivalLineCounters, [key]: index + 1 };
      return index;
    };
    const fresh = launches.map((l, i) => {
      const rivalId = idByName.get(l.competitor) ?? l.competitor;
      return generateRivalProduct({
        rivalId,
        rivalName: l.competitor,
        category: l.category,
        era: state.era,
        strength: l.strength,
        week,
        rng: makeRng(((state.rngState ?? state.seed) >>> 0) ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(i + 1, 0x85ebca77)),
        contested: l.contested,
        seriesIndex: nextSeriesIndex(rivalId, l.category),
      });
    });
    launches.forEach((l, i) => pushRivalFeed(feed, l, activePlayerCats, fresh[i].product.name, l.contested));
    rivalReleases = [...fresh, ...state.rivalReleases].slice(0, RIVAL_RELEASES_CAP);
  }

  // Rival story-arc beats (Track B): a rival rising/peaking/faltering speaks in the feed so the world
  // visibly turns. Bootstrap rolls are silent (no beat), so this only fires at real lifecycle turns.
  for (const b of arcBeats) feed.push(feedItem(b.week, b.text, b.tone as FeedTone));

  // B3 — refill the field: if acquisitions have thinned the roster below its starting size, a fresh
  // challenger occasionally rises to keep the industry alive. The rng is only drawn on this branch,
  // which a normal (no-acquisition) game never enters — so the determinism pin stays byte-identical.
  if (competitors.length < RIVALS.length) {
    const entrant = spawnChallenger(competitors.map((c) => c.id), state.acquiredRivals, week, rng);
    if (entrant) {
      competitors = [...competitors, entrant];
      feed.push(feedItem(week, `A new challenger, ${entrant.name}, enters the market.`, "accent"));
    }
  }

  // A rival entering a category where the player is ACTIVELY selling now dents the remaining
  // sales curve (pre-fix, the "faces new competition" feed line was mechanically hollow — the
  // curve was a frozen snapshot). Forecast total is re-derived so sell-through stays honest,
  // and the mid-life price cut gains a real job: answering a rival's entry.
  const contestedCats = new Set(launches.filter((l) => activePlayerCats.has(l.category)).map((l) => l.category));
  const launchedFinal = contestedCats.size === 0 ? launched : launched.map((lp) => {
    if (!contestedCats.has(lp.product.category) || lp.weeksElapsed >= lp.weeklyUnits.length) return lp;
    const haircut = 1 - BALANCE.market.competition.rivalEntrySalesHaircut;
    const weeklyUnits = lp.weeklyUnits.map((u, i) => (i >= lp.weeksElapsed ? Math.round(u * haircut) : u));
    const remaining = weeklyUnits.slice(lp.weeksElapsed).reduce((a, b) => a + b, 0);
    // C4: record WHEN a rival dented this product's curve, so the "Selling now" row can flag it as
    // "Contested" while the pressure is fresh (optional field; absent on older saves).
    return { ...lp, weeklyUnits, totalUnits: lp.unitsSold + remaining, contestedWeek: week };
  });

  // Research points generated this week — accrue through the SAME selector the UI shows, so the
  // displayed rate and the earned amount can never diverge (this previously omitted the office-focus
  // multiplier and, later, the legacy perk bonus — the UI lied for players who had them).
  // RP must stay a non-negative integer: partial (offline, rate=0.5) ticks accrue
  // fractional RP, so floor on accrual to keep the counter clean.
  let researchPoints = floorRP(state.researchPoints + weeklyRpGen(state) * rate);
  // Creative / sandbox mode: research is free too, so every tier + OS module is open to experiment with.
  if (state.sandboxUnlocked && researchPoints < BALANCE.creative.rpFloor) researchPoints = BALANCE.creative.rpFloor;

  // Manufacturing: advance build jobs; completed ones move to the "ready" shelf
  const building: BuildJob[] = [];
  const ready = [...state.ready];
  for (const job of state.building) {
    const weeksElapsed = job.weeksElapsed + rate;
    if (weeksElapsed >= job.totalWeeks) {
      ready.push(job.product);
      feed.push(feedItem(week, `“${job.product.name}” finished manufacturing, ready to launch.`, "accent"));
    } else {
      building.push({ ...job, weeksElapsed });
    }
  }

  // Staff XP / leveling + mood drift + churn
  const cashDropping = cash < state.cash;
  const teamPlayers = state.staff.filter((s) => s.trait === "teamPlayer").length;
  const churnCfg = BALANCE.churn;
  // People Operations: a People Lead (hr) keeps the whole team happy and resolves burnout before it
  // forces anyone out. The strongest lead drives the effect; presence (not count) gates the no-quit
  // safety, so a roster with no People Lead is byte-identical to before this shipped.
  const hrCfg = BALANCE.hr;
  const peopleLeadSkill = state.staff.reduce((best, m) => (m.role === "hr" ? Math.max(best, m.skill) : best), 0);
  const hasPeopleLead = state.staff.some((m) => m.role === "hr");
  const hrTargetLift = hasPeopleLead ? Math.min(hrCfg.maxTargetLift, hrCfg.moodTargetBase + peopleLeadSkill * hrCfg.perSkillTarget) : 0;
  const quitIds: string[] = [];
  const staff = state.staff.map((s) => {
    const { staff: levelResult, leveledUp } = gainWeeklyXp(s, mentorshipXpMult(s, state.staff));
    if (leveledUp) feed.push(feedItem(week, `${s.name} leveled up to skill ${levelResult.skill}.`, "positive"));
    // Salary is NOT auto-updated on level-up — player must give a raise manually.
    // Underpaid staff drift unhappy over time and may eventually quit.
    const next = leveledUp ? { ...levelResult, salary: s.salary } : levelResult;
    // Keep primary discipline score in sync with the headline skill level on a level-up.
    const skills = leveledUp
      ? { ...next.skills, [ROLE_DISCIPLINE[next.role]]: Math.min(100, Math.max(next.skills[ROLE_DISCIPLINE[next.role]], next.skill * 10)) }
      : next.skills;
    let target = 60 + moodBonus(state.upgrades) + officeComfortMoodBonus(state) + hrTargetLift;
    if (s.trait === "hustler") target -= 12;
    if (cashDropping) target -= 12;
    else target += 6;
    const lift = teamPlayers * 1.5 + (hasPeopleLead ? hrCfg.weeklyMoodLift : 0);
    // Underpaid penalty: salary lagging behind skill level pulls mood target down. A People Lead
    // mediates, absorbing part of the sting (they can't fix the player's wallet, only the morale).
    const marketSalary = salaryFor(next.role, next.skill);
    const isUnderpaid = next.id !== "s0" && toDollars(next.salary) < toDollars(marketSalary);
    if (isUnderpaid) target -= churnCfg.underpaidMoodPenalty * (hasPeopleLead ? 1 - hrCfg.underpaidRelief : 1);
    const mood = clampMood(next.mood + (target - next.mood) * 0.12 + lift + rng.range(-1.5, 1.5));
    // Track consecutive weeks in the danger zone.
    const newLowWeeks = mood < churnCfg.moodQuitThreshold
      ? (s.moodLowWeeks ?? 0) + 1
      : 0;
    // After enough consecutive low weeks, a weekly chance of quitting (founder never quits).
    // Never quit during offline catch-up: it's an irreversible loss the player couldn't react to
    // (mirrors the fan-decay offline protection). At-risk staff can still quit on the next ONLINE
    // tick, giving the player a chance to intervene (e.g. a raise). `!offline` is first so the
    // active path's rng consumption is unchanged (the determinism test runs active-only).
    // A People Lead resolves burnout before it forces anyone out: while one is employed, sustained
    // low mood never triggers a quit. `!hasPeopleLead` is placed BEFORE rng.next() so a roster with
    // no People Lead consumes the rng exactly as before (determinism preserved for old saves).
    if (!offline && next.id !== "s0" && toDollars(next.salary) > 0 && newLowWeeks >= churnCfg.weeksUntilQuitRisk && !hasPeopleLead && rng.next() < churnCfg.quitChancePerWeek) {
      quitIds.push(next.id);
    }
    return { ...next, skills, mood, moodLowWeeks: newLowWeeks };
  });
  // Remove quitters and log them (can't splice inside map).
  let finalStaff = staff;
  for (const qid of quitIds) {
    const q = finalStaff.find((m) => m.id === qid);
    if (!q) continue;
    finalStaff = finalStaff.filter((m) => m.id !== qid);
    // C3: name the real reason. Underpay reads differently from burnout (and matches the "Wants
    // raise" tag the player saw), so don't always blame burnout.
    const underpaid = q.id !== "s0" && toDollars(q.salary) < toDollars(salaryFor(q.role, q.skill));
    feed.push(feedItem(week, underpaid
      ? `${q.name} quit for a better offer, their pay had fallen behind the market.`
      : `${q.name} quit, sustained burnout pushed them to leave.`, "negative"));
  }

  // Recruitment search progress — resolves into a candidate shortlist when the timer runs out,
  // and the shortlist lapses if it sits unsigned for too long.
  let recruitment = state.recruitment;
  let candidates = state.candidates;
  let candidateCounter = state.candidateCounter;
  let candidatesExpire = state.candidatesExpire;
  if (recruitment) {
    const weeksLeft = recruitment.weeksLeft - rate;
    if (weeksLeft <= 0) {
      const gen = generateCandidates(state, recruitment.tier, rng);
      candidates = gen.candidates;
      candidateCounter = gen.counter;
      candidatesExpire = week + BALANCE.recruitment.expireWeeks;
      recruitment = null;
      feed.push(feedItem(week, `${candidates.length} candidates ready to interview.`, "accent"));
    } else {
      recruitment = { ...recruitment, weeksLeft };
    }
  } else if (candidates.length && candidatesExpire && week >= candidatesExpire) {
    candidates = [];
    candidatesExpire = 0;
    feed.push(feedItem(week, "The candidate shortlist moved on to other offers.", "neutral"));
  }

  const bankrupt = cash < 0;
  if (bankrupt) {
    feed.push(feedItem(week, "Out of cash. The company has gone under.", "negative"));
  }

  const cashHistory = [...state.cashHistory, { week, cash: toDollars(cash) }];
  if (cashHistory.length > 260) cashHistory.shift();

  // Installed-base history for the Platform "OS reach" sparkline — one sample per week while the
  // division exists, capped to a sparkline-friendly window.
  let osBaseHistory = state.osBaseHistory;
  if (state.platformUnlocked) {
    osBaseHistory = [...osBaseHistory, installedBase(launched)];
    if (osBaseHistory.length > 40) osBaseHistory = osBaseHistory.slice(-40);
  }

  // Licensee relationships: a rival paying to license your OS resents being dominated. Each live week
  // their satisfaction shifts with your reputation lead, and an unhappy licensee may walk (churn).
  // Gated to live play (never offline) so a returning player can't lose partners while away.
  let osLicensees = state.osLicensees;
  let osLicenseeHealth = state.osLicenseeHealth;
  if (!offline && state.platformUnlocked && osLicensees.length > 0) {
    const rel = updateLicenseeRelations({
      licensees: osLicensees,
      health: osLicenseeHealth,
      playerReputation: state.reputation,
      rivalRepById: (id) => competitors.find((c) => c.id === id)?.reputation,
      rivalNameById: (id) => competitors.find((c) => c.id === id)?.name ?? "A licensee",
      rng: () => rng.next(),
    });
    osLicensees = rel.licensees;
    osLicenseeHealth = rel.health;
    for (const d of rel.dropped) {
      feed.push(feedItem(week, `${d.name} dropped ${osDisplayName(state)}, they couldn't keep competing while paying to license it.`, "negative"));
    }
  }

  const loyaltyDecay = hasProject(state.completedProjects, "loyaltyProgram")
    ? 1 - (1 - BALANCE.fans.decayPerWeek) * 0.5
    : BALANCE.fans.decayPerWeek;
  const newFans = Math.round(
    state.fans * Math.pow(loyaltyDecay, rate)
    + (hasProject(state.completedProjects, "contentMarketing") ? 100 * rate : 0)
  );

  // Quarterly checkpoint: a snapshot feed item every BALANCE.quartersWeeks weeks to mark
  // the end of a "fiscal quarter" — gives the player a regular moment of reflection.
  if (!bankrupt && week > 0 && week % BALANCE.quartersWeeks === 0) {
    const qNum = Math.floor(week / BALANCE.quartersWeeks);
    const fansStr = newFans >= 1000 ? `${(newFans / 1000).toFixed(1)}k` : String(newFans);
    feed.push(feedItem(
      week,
      `Q${qNum} complete, ${format(cash)} cash · Rep ${Math.round(state.reputation)} · ${fansStr} fans.`,
      "accent",
    ));
  }

  // Late-game reputation maintenance (BALANCE.reputation.decay*): in the final era a top brand
  // erodes toward a floor each week, so it must be defended by continued hits — never touches the
  // early climb or any progression gate (final era only). Launch/event rep gains apply on top.
  let reputation = state.reputation;
  {
    const rc = BALANCE.reputation;
    if (!bankrupt && state.era >= rc.decayFromEra && reputation > rc.decayFloor) {
      // Scale by `rate` so a partial offline catch-up tick decays proportionally (matches the rest
      // of the tick math, which weights offline weeks by `rate`).
      reputation = Math.max(rc.decayFloor, reputation - rc.decayPerWeekLate * rate);
    }
  }

  // Supplier contracts tick down each week; an expired one drops back to spot pricing (with a heads-up).
  let supplierContracts = state.supplierContracts;
  if (supplierContracts && Object.keys(supplierContracts).length) {
    const next: NonNullable<GameState["supplierContracts"]> = {};
    for (const [sid, c] of Object.entries(supplierContracts)) {
      if (!c) continue;
      const weeksLeft = c.weeksLeft - rate;
      if (weeksLeft > 0) next[sid as SupplierId] = { ...c, weeksLeft };
      else feed.push(feedItem(week, `Your contract with ${supplierFor(sid as SupplierId).name} expired, back to spot pricing.`, "accent"));
    }
    supplierContracts = next;
  }

  const base: GameState = {
    ...state,
    week,
    cash,
    reputation,
    cumulativeRevenue,
    fans: newFans,
    researchPoints,
    building,
    ready,
    supplierContracts,
    staff: finalStaff,
    recruitment,
    candidates,
    candidateCounter,
    candidatesExpire,
    trends,
    trendRetargetWeek,
    competitors,
    launched: launchedFinal,
    cashHistory,
    osBaseHistory,
    osLicensees,
    osLicenseeHealth,
    feed,
    rivalReleases,
    rivalLineCounters,
    loans,
    rngState: rng.state(),
    bankrupt,
    // lastActive is stamped by the persistence layer on save, not per tick (keeps the reducer pure).
  };

  // Rival poaching (Track C): a rival on the rise occasionally tries to hire away one of your best —
  // surfaced as a counter-offer DECISION, not a silent stat drop. A DERIVED rng keeps the main sim
  // stream byte-identical, so the harness + determinism pin are unaffected. One decision at a time:
  // only when nothing else is pending, online, solvent, and the team can spare the attention.
  if (!offline && !bankrupt && !base.pendingPoach && !base.pendingChoice && base.staff.length >= BALANCE.poaching.minTeam) {
    const prng = makeRng(((state.rngState ?? state.seed) >>> 0) ^ Math.imul(week + 1, 0x2545f491));
    if (prng.next() < BALANCE.poaching.chancePerWeek) {
      const target = pickPoachTarget(base.staff, base.competitors, week, prng);
      if (target) {
        const retainCost = scale(salaryFor(target.staff.role, target.staff.skill), BALANCE.poaching.retainWeeksSalary);
        base.pendingPoach = { staffId: target.staff.id, staffName: target.staff.name, rivalId: target.rival.id, rivalName: target.rival.name, retainCost, week };
        base.feed.push(feedItem(week, `${target.rival.name} is trying to poach ${target.staff.name}, one of your best. Match their offer or let them walk.`, "negative"));
      }
    }
  }

  // Industry leaderboard: this tick's sales grew cumulativeRevenue → companyValuation, so re-rank
  // the player against the six public rivals. Climbing to a new best rank (overtaking a rival, all
  // the way to #1) is the late-game chase — celebrate it. Rank is monotonic-best so a rival's share
  // surge can never "demote" the milestone. Updated silently offline; celebrated only in live play.
  {
    const newRank = industryRank(base);
    if (newRank < state.bestIndustryRank) {
      if (!offline) {
        const board = industryLeaderboard(base);
        const overtaken = board
          .slice(newRank, Math.min(state.bestIndustryRank, board.length))
          .filter((e) => !e.isPlayer);
        for (const r of overtaken) {
          base.feed.push(feedItem(week, `${base.companyName} overtook ${r.name}, now #${newRank} in the industry.`, "positive"));
        }
        if (newRank === 1) {
          base.feed.push(feedItem(week, `${base.companyName} is now the #1 company in the industry. The throne is yours.`, "positive"));
        }
      }
      base.bestIndustryRank = newRank;
    }

    // Performance-reactive company value (Track B): the launch-driven momentum overlay decays back
    // toward the fundamental each week; while you sit at #1 it holds a small standing premium. Then
    // record a valuation sample for the sparkline. Bounded, so a pop can never compound; cash +
    // reputation are untouched, so bankruptcy and the win gate are unaffected.
    {
      const vm = BALANCE.valuationMomentum;
      let m = (base.valuationMomentum ?? 0) * Math.pow(vm.decayPerWeek, rate);
      if (newRank === 1) m = Math.max(m, vm.rankOnePremiumFloor);
      base.valuationMomentum = Math.max(-vm.cap, Math.min(vm.cap, m));
      const sample = toDollars(companyValuation(base));
      base.valuationHistory = [...(base.valuationHistory ?? []), sample].slice(-vm.historyLength);
    }
  }

  // Resolve an in-progress event chain (Track B) on its OWN schedule, independent of the normal
  // event cadence: each due beat applies its consequence, or hands off the terminal choice.
  if (!offline && !bankrupt && !state.pendingChoice && !base.pendingPoach && base.eventChain && week >= base.eventChain.nextWeek) {
    return resolveChainStep(base, week);
  }

  // Market events only during live play — offline catch-up skips all events so the state stays
  // deterministic and the player isn't surprised by consequences they couldn't interact with.
  if (!offline && !bankrupt && !base.pendingPoach && week >= state.nextEventWeek) {
    // Choice events also require the player to be present to resolve them.
    if (!state.pendingChoice) {
      const choice = pickChoiceEvent(rng, state.era, state.resolvedChoices, state.seenChoices);
      if (choice) {
        const nextEventWeek = week + BALANCE.events.everyWeeks + rng.int(BALANCE.events.jitter);
        return {
          ...base,
          pendingChoice: { event: choice, week },
          nextEventWeek,
          feed: trimFeed([...base.feed, feedItem(week, `Decision required: ${choice.title}`, choice.tone as FeedTone)]),
          rngState: rng.state(),
        };
      }
      // Otherwise, a cascading chain may start instead of a one-shot event (Track B).
      if (!base.eventChain) {
        const chain = pickChain(rng, state.era);
        if (chain) return startChain(base, chain, week, rng);
      }
    }
    const ev = pickEvent(rng, state.era);
    return applyMarketEvent(base, ev, week, rng);
  }
  base.feed = trimFeed(base.feed);
  return base;
}

/** Apply a single EventEffect to the state and push a feed item. Shared by market events and
 *  choice resolutions. Exported for tests (the crunch cash-clamp is a bankruptcy-fairness guard). */
export function applyEventEffect(
  s: GameState,
  eff: MarketEvent["effect"],
  week: number,
  feedText: string,
  feedTone: FeedTone,
): GameState {
  const feed = [...s.feed];
  let text = feedText; // mutable so a supply crunch can annotate WHY it cost more / less
  let cash = s.cash;
  let reputation = s.reputation;
  let researchPoints = s.researchPoints;
  let trends = s.trends;
  let competitors = s.competitors;
  let staff = s.staff;
  let fans = s.fans;

  switch (eff.kind) {
    case "viralTrend": {
      const target: Stats = { performance: 0.1, quality: 0.1, battery: 0.1, design: 0.1, ecosystem: 0.1 };
      target[eff.stat] = 0.6;
      trends = { ...s.trends, targetWeights: target };
      break;
    }
    case "rpBonus":
      researchPoints += eff.amount;
      break;
    case "rivalScandal":
      competitors = s.competitors.map((c) => {
        const next: typeof c.strengthByCategory = {};
        for (const [cat, v] of Object.entries(c.strengthByCategory)) next[cat as keyof typeof next] = (v as number) * eff.factor;
        return { ...c, strengthByCategory: next };
      });
      break;
    case "talentWave":
    case "burnout":
      staff = s.staff.map((m) => ({ ...m, mood: clampMood(m.mood + eff.mood) }));
      break;
    case "supplyCrunch": {
      // P1.5 — the shock scales by your sourcing: premium suppliers on your active orders weather a
      // crunch; bargain sourcing amplifies it. A FIXED-PRICE CONTRACT makes that supplier immune
      // (the price is locked), so a contracted line shrugs the crunch off entirely.
      const exposure = sourcingExposureWithContracts(s);
      const scaledCash = eff.cash * exposure;
      // Sting, never kill: cap the hit at a share of cash on hand so a random event can't
      // push a by-the-book player below $0 (instant bankruptcy) mid-build.
      const capDollars = Math.max(0, toDollars(cash)) * BALANCE.events.crunchMaxCashShare;
      cash = sub(cash, dollars(Math.min(scaledCash, capDollars)));
      if (exposure <= 0.8) text += " (resilient sourcing softened the blow)";
      else if (exposure >= 1.2) text += " (bargain sourcing left you exposed)";
      break;
    }
    case "pressFeature":
      reputation = Math.min(BALANCE.reputation.max, reputation + eff.reputation);
      break;
    case "fansBonus":
      fans = Math.max(0, Math.round(fans + eff.fans));
      break;
    case "repBoost":
      reputation = Math.min(BALANCE.reputation.max, reputation + eff.rep);
      break;
    case "cashWindfall":
      cash = add(cash, dollars(eff.cash)) as Money;
      break;
  }

  // C1: append the realized magnitude (cash / rep / fans delta) so the player can ATTRIBUTE the
  // swing to the event instead of watching the numbers move with no stated cause.
  const parts: string[] = [];
  const cashD = toDollars(cash) - toDollars(s.cash);
  if (Math.round(cashD) !== 0) parts.push(`${cashD > 0 ? "+" : "-"}${format(dollars(Math.abs(cashD)))}`);
  const repD = Math.round(reputation - s.reputation);
  if (repD !== 0) parts.push(`${repD > 0 ? "+" : ""}${repD} rep`);
  const fansD = Math.round(fans - s.fans);
  if (fansD !== 0) parts.push(`${fansD > 0 ? "+" : ""}${fansD.toLocaleString()} fans`);
  feed.push(feedItem(week, parts.length ? `${text} · ${parts.join(", ")}` : text, feedTone));
  return { ...s, cash, reputation, researchPoints, trends, competitors, staff, fans, feed: trimFeed(feed) };
}

function applyMarketEvent(s: GameState, ev: MarketEvent, week: number, rng: ReturnType<typeof rngFrom>): GameState {
  const applied = applyEventEffect(s, ev.effect, week, ev.title, ev.tone as FeedTone);
  const nextEventWeek = week + BALANCE.events.everyWeeks + rng.int(BALANCE.events.jitter);
  return { ...applied, nextEventWeek, lastEvent: { text: ev.title, tone: ev.tone as FeedTone, week }, rngState: rng.state() };
}

/** Start a cascading event chain (Track B): fire its opening beat now and schedule the next. */
function startChain(s: GameState, chain: EventChain, week: number, rng: ReturnType<typeof rngFrom>): GameState {
  const step0 = chain.steps[0];
  const nextEventWeek = week + BALANCE.events.everyWeeks + rng.int(BALANCE.events.jitter);
  const applied = step0.kind === "effect"
    ? applyEventEffect(s, step0.effect, week, step0.title, step0.tone as FeedTone)
    : s;
  const next = chain.steps[1];
  return {
    ...applied,
    eventChain: next ? { id: chain.id, step: 1, nextWeek: week + Math.max(1, next.delayWeeks) } : null,
    nextEventWeek,
    rngState: rng.state(),
  };
}

/** Resolve the due beat of an in-progress chain: apply its effect + schedule the next, or hand the
 *  terminal choice off to the pending-choice system. Deterministic (no rng draw). */
function resolveChainStep(s: GameState, week: number): GameState {
  const ec = s.eventChain;
  const chain = ec ? chainById(ec.id) : undefined;
  const step = chain && ec ? chain.steps[ec.step] : undefined;
  if (!chain || !ec || !step) return { ...s, eventChain: null, feed: trimFeed(s.feed) };
  if (step.kind === "choice") {
    if (s.resolvedChoices.includes(step.choice.id)) return { ...s, eventChain: null, feed: trimFeed(s.feed) };
    return {
      ...s,
      eventChain: null,
      pendingChoice: { event: step.choice, week },
      feed: trimFeed([...s.feed, feedItem(week, `Decision required: ${step.choice.title}`, step.choice.tone as FeedTone)]),
    };
  }
  const applied = applyEventEffect(s, step.effect, week, step.title, step.tone as FeedTone);
  const nextIdx = ec.step + 1;
  const next = chain.steps[nextIdx];
  return {
    ...applied,
    eventChain: next ? { id: ec.id, step: nextIdx, nextWeek: week + Math.max(1, next.delayWeeks) } : null,
  };
}

function pushRivalFeed(feed: FeedItem[], l: CompetitorLaunch, activePlayerCats?: ReadonlySet<CategoryId>, productName?: string, contested?: boolean) {
  const catName = CATEGORIES[l.category]?.displayName ?? l.category;
  const threat = activePlayerCats?.has(l.category);
  // The product name already carries the rival's name (e.g. "Pomelo Vync Pro"), so use it as the
  // subject; fall back to the bare rival name for callers that don't generate a product.
  const subject = productName ?? l.competitor;
  const text = contested
    ? `${subject} undercuts your ${catName} on price, a value war for the segment.`
    : threat
      ? `${subject} launches, your active ${catName} faces new competition.`
      : `${subject} launches into ${catName}.`;
  feed.push(feedItem(l.week, text, threat || contested ? "negative" : "neutral"));
}

function trimFeed(feed: FeedItem[]): FeedItem[] {
  return feed.length > 60 ? feed.slice(feed.length - 60) : feed;
}

export interface ActionResult {
  state: GameState;
  ok: boolean;
  reason?: string;
  launchScore?: number;
  /** The recorded launch verdict (competition-adjusted, era-scaled) — the source of truth the
   *  UI must use for the launch celebration so the moment can't contradict what Market records. */
  verdict?: "hit" | "solid" | "flop" | "steady";
}

/** Queue a designed product for manufacturing with a production plan (run size + marketing).
 *  Tooling + the full production run + the marketing campaign are paid upfront — so deciding
 *  HOW MANY to make is a real bet. It becomes launchable when built. */
export function startBuild(
  state: GameState,
  product: Product,
  plannedUnits?: number,
  channelId: ChannelId = "none",
): ActionResult {
  if (state.bankrupt) return { state, ok: false, reason: "Company is bankrupt." };
  const miss = missingSlots(product);
  if (miss.length) return { state, ok: false, reason: "Pick every component first." };
  if (!isCategoryUnlocked(product.category, state.era))
    return { state, ok: false, reason: "Category not unlocked yet." };
  if (product.price <= 0) return { state, ok: false, reason: "Set a price." };

  const units = Math.min(
    BALANCE.build.maxRun,
    Math.max(
      BALANCE.build.minRun,
      Math.round(plannedUnits ?? recommendedRun(state, product, channelId)),
    ),
  );
  const plan = planProduction(state, product, units, channelId);
  if (state.cash < plan.totalUpfront) {
    return { state, ok: false, reason: `Need ${format(plan.totalUpfront)} for tooling + ${units.toLocaleString()} units.` };
  }

  const totalWeeks = plan.buildWeeks; // strategy-resolved (longer under "stretch")
  // C6: stash the SAME projected-sales band the wizard showed, so the launch can reconcile the
  // actual against this promise (tightens with marketer skill + Demand Sensing, exactly as the wizard).
  const variancePct = forecastBand(forecastConfidence({
    marketerSkill: marketerSkill(state),
    demandSensing: state.completedProjects.includes("demandSensing"),
  })) * eraModifier(state.era).demandVariance;
  const forecast = {
    low: Math.round(plan.projectedSales * (1 - variancePct)),
    high: Math.round(plan.projectedSales * (1 + variancePct)),
  };
  const job: BuildJob = {
    product: { ...product, id: `prod-${state.productCounter}`, plannedUnits: units, channelId, forecast },
    totalWeeks,
    weeksElapsed: 0,
    plannedUnits: units,
    channelId,
  };
  const feed = [...state.feed];
  feed.push(
    feedItem(
      state.week,
      `Started a ${units.toLocaleString()}-unit run of “${product.name}”, ${format(plan.totalUpfront)} (${totalWeeks} wk).`,
      "accent",
    ),
  );
  // Deepen the relationship with this run's supplier (the discount this run got was from PRIOR
  // history; the increment rewards the next one).
  const sid = product.supplierId ?? DEFAULT_SUPPLIER_ID;
  const supplierLoyalty = { ...state.supplierLoyalty, [sid]: (state.supplierLoyalty?.[sid] ?? 0) + 1 };
  return {
    state: {
      ...state,
      cash: sub(state.cash, plan.totalUpfront),
      building: [...state.building, job],
      productCounter: state.productCounter + 1,
      supplierLoyalty,
      // Q1: remember this run's plan so the next build can repeat it in one tap.
      lastBuildPlan: {
        units,
        channelId,
        regions: product.regions ?? ["home"],
        strategy: product.capacityStrategy ?? "overtime",
      },
      feed: trimFeed(feed),
    },
    ok: true,
  };
}

/** Launch a built product into the market. Production + marketing were already paid at build;
 *  the timing of THIS launch decides how the product meets current demand. Sales are capped to
 *  the production run, so over/under-producing matters. */
export function launchReady(state: GameState, productId: string): ActionResult {
  const product = state.ready.find((p) => p.id === productId);
  if (!product) return { state, ok: false, reason: "Not ready yet." };

  const channelId = (product.channelId ?? "none") as ChannelId;
  const channel = channelById(channelId);
  const plannedUnits = product.plannedUnits ?? recommendedRun(state, product, channelId);
  const plan = planProduction(state, product, plannedUnits, channelId);

  // B9 / C2 — apply seeded demand variance to the ACTUAL realized demand at launch. planProduction
  // gives the deterministic forecast the wizard showed; the real market lands within the forecast BAND
  // of it. The band tightens with market knowledge (forecastConfidence), so investing in marketers +
  // Demand Sensing makes the realized outcome land closer to the estimate — the wizard's band is an
  // honest promise. Driven by the persisted RNG (deterministic per seed, NOT Math.random).
  const rng = rngFrom(state);
  const rawVariance = demandVarianceMultiplier(rng);
  // Epic D — the AI era is a more volatile, hype-driven market (over/under-production is a bigger bet).
  const band = forecastBand(forecastConfidence({
    marketerSkill: marketerSkill(state),
    demandSensing: hasProject(state.completedProjects, "demandSensing"),
  })) * eraModifier(state.era).demandVariance;
  // Remap the ±baseBand jitter into the (narrower) confidence-scaled band, keeping the seeded sign.
  const variance = 1 + (rawVariance - 1) * (band / BALANCE.market.forecast.baseBand);
  const realizedDemand = Math.max(0, Math.round(plan.totalDemand * variance));
  // Sales are still capped by the production run — you can never sell more than you built.
  const totalUnits = Math.min(plannedUnits, realizedDemand);
  const sellsOut = realizedDemand > plannedUnits && plannedUnits > 0;
  const weeklyUnits = distributeOverCurve(totalUnits);

  const lp: LaunchedProduct = {
    product,
    stats: productStats(state, product),
    unitCost: plan.unitCost,
    launchScore: plan.launchScore,
    launchedWeek: state.week,
    totalUnits,
    plannedUnits,
    weeklyUnits,
    unitsSold: 0,
    weeksElapsed: 0,
    revenueToDate: ZERO,
    // Snapshot the launch-moment drivers so the post-launch detail screen can explain the outcome
    // (pillar #5: readable simulation). These reflect the market the instant this product shipped.
    insight: {
      demandFit: plan.demandFit,
      priceFit: plan.priceFit,
      hype: plan.hype,
      matchingRivals: plan.matchingRivals,
      betterRivals: plan.betterRivals,
      competitionFactor: plan.competitionFactor,
      // Epic A — which segments this launch won/lost (the readable verdict).
      dominantSegment: plan.segments.dominant,
      weakestSegment: plan.segments.weakest,
      perSegment: plan.segments.perSegment.map((r) => ({
        id: r.id,
        name: r.name,
        captured: r.captured,
        fit: r.fit,
        priceFit: r.priceFit,
      })),
    },
  };

  // Reputation response (QA Lab softens flops, boosts hits).
  const qa = hasProject(state.completedProjects, "qaLab");
  let reputation = state.reputation;
  const rep = BALANCE.reputation;
  // F8 — hit/flop must track ACTUAL performance, not the competition-FREE launchScore. A product
  // can score well in isolation yet sell almost nothing once rivals split the market, so flagging
  // it "a hit" (+rep/+fans) would be a lie. Gate on the competition-adjusted score: launchScore
  // scaled by the same competitionFactor that already discounts real demand. The thresholds in
  // BALANCE.reputation keep their meaning (they're applied to the same score scale).
  const effectiveScore = plan.launchScore * plan.competitionFactor;
  // Era-scaled verdict bars (the bar for a "hit" rises as the company grows — see verdictBands).
  const bands = verdictBands(state.era);
  // hitFactory lowers the hit threshold, so more polished products qualify as hits
  const hitThreshold = hasProject(state.completedProjects, "hitFactory")
    ? Math.round(bands.hit * 0.88)
    : bands.hit;
  const isHit = effectiveScore >= hitThreshold;
  const isFlop = effectiveScore <= bands.flop;
  const isSolid = !isHit && !isFlop && effectiveScore >= bands.solid;
  const hasCrisisComms = hasProject(state.completedProjects, "crisisComms");
  if (isHit) reputation = Math.min(rep.max, reputation + rep.gainPerHit * (qa ? 1.5 : 1));
  else if (isSolid) reputation = Math.min(rep.max, reputation + rep.gainPerSolid);
  else if (isFlop) reputation = Math.max(rep.min, reputation - rep.lossPerFlop * (qa ? 0.6 : 1) * (hasCrisisComms ? 0.5 : 1));
  reputation = Math.min(rep.max, reputation + channel.reputation);
  if (hasProject(state.completedProjects, "pressKit")) reputation = Math.min(rep.max, reputation + 1);
  // Ethics of the supply chain: responsible sourcing slowly builds the brand; cheap/exploitative
  // sourcing erodes it (0 for standard sourcing → no change for older saves / default builds).
  const ethicsRep = supplierEthicsRepDelta(product);
  if (ethicsRep !== 0) reputation = Math.max(rep.min, Math.min(rep.max, reputation + ethicsRep));

  // Fanbase response — hits win fans (more for bigger sellers), flops lose them, sellouts add buzz.
  const fb = BALANCE.fans;
  let fans = state.fans;
  if (isHit) fans += fb.gainOnHitFlat + (totalUnits / 1000) * fb.gainPerHitUnitsK;
  else if (isSolid) fans += fb.gainOnSolidFlat + (totalUnits / 1000) * fb.gainPerHitUnitsK * 0.5;
  else if (isFlop) fans = Math.max(0, fans - fb.lossPerFlop);
  else fans += fb.gainOnSteadyFlat; // a steady seller still wins a few new fans (beats the decay)
  // B4 — the sellout buzz is only earned if the run actually met a reasonable share of demand.
  // A deliberately tiny run that sells out while ignoring most of the market no longer farms fans;
  // instead chronic severe undersupply costs you fans ("couldn't meet demand"). This kills the
  // free fan-grind exploit while keeping the genuine "slightly under-produce a hot product" reward.
  const metShare = realizedDemand > 0 ? plannedUnits / realizedDemand : 1;
  if (sellsOut) {
    if (metShare >= fb.selloutMinDemandShare) fans *= 1 + fb.selloutFanBonus;
    else fans = Math.max(0, fans * (1 - fb.undersupplyFanPenalty));
  }
  fans = Math.round(fans);

  // Fan milestones — surface crossing big numbers as celebratory feed items + rep bonus.
  const fanMilestones = fanMilestoneResult(state.fans, fans, state.week);
  reputation = Math.min(rep.max, reputation + fanMilestones.repBonus);

  // The whole team feels the result.
  const moodSwing = isHit ? 12 : isFlop ? -12 : 3;
  const staff = state.staff.map((s) => ({ ...s, mood: clampMood(s.mood + moodSwing) }));

  // Record the verdict the player saw on the launched product, so the history screen can report it.
  lp.verdict = isHit ? "hit" : isFlop ? "flop" : isSolid ? "solid" : "steady";
  // Performance-reactive company value (Track B): the launch pops or dents the momentum overlay.
  // Bounded; decays back to 0 over the following weeks. Does not touch cash or reputation.
  const vm = BALANCE.valuationMomentum;
  let valuationMomentum = (state.valuationMomentum ?? 0) + (isHit ? vm.popOnHit : isSolid ? vm.popOnSolid : isFlop ? -vm.dipOnFlop : 0);
  valuationMomentum = Math.max(-vm.cap, Math.min(vm.cap, valuationMomentum));
  // Research excitement: a strong launch funds the next breakthrough (RP earned through play).
  const rpReward = launchRpReward(lp.verdict);

  // B8 — surface the deltas the player otherwise can't see: how this launch moved fans + reputation.
  const fanDelta = fans - state.fans;
  const repDelta = Math.round(reputation - state.reputation);
  const part = (n: number, unit: string) =>
    n === 0 ? null : `${n > 0 ? "+" : "−"}${Math.abs(n).toLocaleString()} ${unit}`;
  const deltaBits = [part(fanDelta, "fans"), part(repDelta, "reputation"), part(rpReward, "RP")].filter(Boolean);
  const deltaStr = deltaBits.length ? ` ${deltaBits.join(" · ")}.` : "";

  const feed = [...state.feed];
  // A flop verdict can coexist with a sellout (the verdict is market reception of the product
  // itself; sales are capped by the run size) — so the flop line must carry its cause, and the
  // sellout line must not read as a pure celebration next to it, or the two contradict each other.
  const verdict = isHit ? 'a hit' : isFlop ? 'a flop, out of step with what buyers wanted' : isSolid ? 'a solid performer' : 'a steady seller';
  feed.push(
    feedItem(
      state.week,
      `Launched “${product.name}”, ${verdict} (~${totalUnits.toLocaleString()} of ${plannedUnits.toLocaleString()} units forecast).${deltaStr}`,
      isHit ? 'positive' : isFlop ? 'negative' : isSolid ? 'positive' : 'accent',
    ),
  );
  if (sellsOut) {
    if (isFlop) {
      feed.push(feedItem(state.week, `“${product.name}” will sell out its small run, but the wider market wasn't won over. Tap it on Market for the full story.`, "accent"));
    } else {
      feed.push(feedItem(state.week, `“${product.name}” is selling out, demand outstrips your run.`, "positive"));
    }
  } else if (plannedUnits - totalUnits > plannedUnits * 0.35) {
    feed.push(feedItem(state.week, `Overproduced “${product.name}”, unsold stock is a write-off.`, "negative"));
  }
  for (const item of fanMilestones.feed) feed.push(item);

  return {
    state: {
      ...state,
      ready: state.ready.filter((p) => p.id !== productId),
      launched: [lp, ...state.launched],
      reputation,
      valuationMomentum,
      fans,
      researchPoints: state.researchPoints + rpReward,
      staff,
      feed: trimFeed(feed),
      // Persist the RNG advance from the demand-variance roll so the launch outcome is deterministic
      // per seed and the next tick continues from the correct RNG state.
      rngState: rng.state(),
    },
    ok: true,
    launchScore: plan.launchScore,
    verdict: lp.verdict,
  };
}

/** Mid-lifecycle price cut: reduces price on an active product, scaling up demand for remaining
 *  weeks proportionally to the improved priceFit. Limited to one cut per product — used when rivals
 *  enter your category and you want to defend market share at the cost of margin. */
export function cutProductPrice(state: GameState, productId: string, newPrice: Money): ActionResult {
  const lp = state.launched.find((l) => l.product.id === productId);
  if (!lp) return { state, ok: false, reason: "Product not found." };
  if (lp.weeksElapsed >= lp.weeklyUnits.length) return { state, ok: false, reason: "Product lifecycle has ended." };
  if (newPrice >= lp.product.price) return { state, ok: false, reason: "New price must be lower than current price." };
  if (newPrice < lp.unitCost) return { state, ok: false, reason: "Price can't go below unit cost." };
  if ((lp.priceCuts ?? 0) >= 1) return { state, ok: false, reason: "Price has already been adjusted on this product." };

  // Compute the priceFit improvement ratio — this scales remaining weekly demand proportionally.
  const oldFit = priceFit(lp.product.price, lp.stats, lp.product.category);
  const newFit = priceFit(newPrice, lp.stats, lp.product.category);
  const boost = oldFit > 0 ? Math.max(1, newFit / oldFit) : 1;

  const newWeeklyUnits = lp.weeklyUnits.map((u, i) =>
    i < lp.weeksElapsed ? u : Math.round(u * boost),
  );
  // totalUnits must not exceed the production run.
  const newTotalUnits = Math.min(
    lp.plannedUnits ?? lp.totalUnits,
    newWeeklyUnits.reduce((a, b) => a + b, 0),
  );

  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Price cut on "${lp.product.name}", ${format(lp.product.price)} → ${format(newPrice)}.`, "accent"));

  return {
    state: {
      ...state,
      launched: state.launched.map((l) =>
        l.product.id === productId
          ? { ...l, product: { ...l.product, price: newPrice }, weeklyUnits: newWeeklyUnits, totalUnits: newTotalUnits, priceCuts: (l.priceCuts ?? 0) + 1 }
          : l,
      ),
      feed: trimFeed(feed),
    },
    ok: true,
  };
}

/** A quote for a mid-lifecycle marketing push, or null when there's nothing left to promote (no
 *  surplus inventory) or the lifecycle has ended. Pure — drives both the UI preview and the action,
 *  so the number the player sees is the number they pay. */
export function marketingPushQuote(lp: LaunchedProduct): { cost: Money; addedUnits: number } | null {
  if (lp.weeksElapsed >= lp.weeklyUnits.length) return null;
  const cap = lp.plannedUnits ?? lp.totalUnits;
  const boosted = lp.weeklyUnits.map((u, i) => (i < lp.weeksElapsed ? u : Math.round(u * (1 + BALANCE.marketingPush.boost))));
  const newTotal = Math.min(cap, boosted.reduce((a, b) => a + b, 0));
  const oldTotal = Math.min(cap, lp.weeklyUnits.reduce((a, b) => a + b, 0));
  const addedUnits = Math.max(0, newTotal - oldTotal);
  if (addedUnits <= 0) return null;
  const cost = dollars(Math.round(BALANCE.marketingPush.costPct * addedUnits * toDollars(lp.product.price)));
  return { cost, addedUnits };
}

/** Run a marketing push: pay cash to lift a still-selling product's remaining demand while KEEPING
 *  its price (the margin-preserving alternative to a price cut). One push per product. */
export function marketingPush(state: GameState, productId: string): ActionResult {
  const lp = state.launched.find((l) => l.product.id === productId);
  if (!lp) return { state, ok: false, reason: "Product not found." };
  if (lp.weeksElapsed >= lp.weeklyUnits.length) return { state, ok: false, reason: "Product lifecycle has ended." };
  if ((lp.marketingPushes ?? 0) >= BALANCE.marketingPush.maxPerProduct) return { state, ok: false, reason: "This product has already had a marketing push." };
  const quote = marketingPushQuote(lp);
  if (!quote) return { state, ok: false, reason: "No unsold inventory left to promote." };
  if (state.cash < quote.cost) return { state, ok: false, reason: "Not enough cash for the campaign." };

  const cap = lp.plannedUnits ?? lp.totalUnits;
  const newWeeklyUnits = lp.weeklyUnits.map((u, i) => (i < lp.weeksElapsed ? u : Math.round(u * (1 + BALANCE.marketingPush.boost))));
  const newTotalUnits = Math.min(cap, newWeeklyUnits.reduce((a, b) => a + b, 0));

  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Marketing push on "${lp.product.name}", ${quote.addedUnits.toLocaleString()} more units in the pipeline.`, "accent"));

  return {
    state: {
      ...state,
      cash: sub(state.cash, quote.cost),
      launched: state.launched.map((l) =>
        l.product.id === productId
          ? { ...l, weeklyUnits: newWeeklyUnits, totalUnits: newTotalUnits, marketingPushes: (l.marketingPushes ?? 0) + 1 }
          : l,
      ),
      feed: trimFeed(feed),
    },
    ok: true,
  };
}

function clampMood(m: number): number {
  return Math.max(0, Math.min(100, m));
}

export type MoodDriverKey = "underpaid" | "cash" | "comfort" | "flop" | "hustler";

/** C5: the dominant NEGATIVE influence on a staffer's mood right now, so the player knows WHICH fix
 *  applies (Raise / ship a hit / a comfier office / steady the finances). Reads the SAME inputs the
 *  weekly mood tick uses: underpay vs market (mediated by a People Lead), falling cash, a cramped
 *  office, a recent flop, and the restless "hustler" trait. Pure. Returns null when nothing weighs on
 *  them (a content teammate gets no nagging label). */
export function dominantMoodDriver(state: GameState, staff: Staff): { key: MoodDriverKey; label: string } | null {
  const churnCfg = BALANCE.churn;
  const hasPeopleLead = state.staff.some((m) => m.role === "hr");
  const drivers: { key: MoodDriverKey; label: string; weight: number }[] = [];

  // Underpay vs the market rate for their role/skill (the founder is never "underpaid"). A People
  // Lead absorbs part of the sting, exactly as the tick does, so the read tracks the mechanic.
  if (staff.id !== "s0" && toDollars(staff.salary) < toDollars(salaryFor(staff.role, staff.skill))) {
    drivers.push({ key: "underpaid", label: "Underpaid vs market", weight: churnCfg.underpaidMoodPenalty * (hasPeopleLead ? 1 - BALANCE.hr.underpaidRelief : 1) });
  }
  // Falling cash (the company is burning), read from the recent cash history, the persisted analog
  // of the tick's nextCash < cash signal.
  const ch = state.cashHistory;
  if (ch.length >= 2 && ch[ch.length - 1].cash < ch[ch.length - 2].cash) {
    drivers.push({ key: "cash", label: "Worried by falling cash", weight: 12 });
  }
  // A cramped office (the comfort mood bonus sits well below its cap). Kept the LOWEST-priority cause
  // (a flat, modest weight) so the more actionable, urgent ones (underpay, a flop) surface first, and
  // a bare early-game garage does not drown them out.
  if (BALANCE.shop.comfortCap - officeComfortMoodBonus(state) >= 7) {
    drivers.push({ key: "comfort", label: "Cramped office", weight: 8 });
  }
  // A recent flop stings the whole team (mirrors the launch mood swing).
  if (state.launched.some((lp) => lp.verdict === "flop" && state.week - lp.launchedWeek <= 4)) {
    drivers.push({ key: "flop", label: "Stung by a recent flop", weight: 12 });
  }
  // The restless "hustler" is never quite satisfied.
  if (staff.trait === "hustler") drivers.push({ key: "hustler", label: "Restless by nature", weight: 12 });

  if (drivers.length === 0) return null;
  const top = drivers.reduce((a, b) => (b.weight > a.weight ? b : a));
  return { key: top.key, label: top.label };
}

/** Give a staff member a salary raise to match their current skill level. */
export function giveRaise(state: GameState, id: string): GameState {
  const member = state.staff.find((s) => s.id === id);
  if (!member || member.id === "s0") return state;
  const marketSalary = salaryFor(member.role, member.skill);
  if (toDollars(member.salary) >= toDollars(marketSalary)) return state;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `${member.name}'s salary raised to ${format(marketSalary)}/wk.`, "positive"));
  return {
    ...state,
    staff: state.staff.map((s) =>
      s.id === id ? { ...s, salary: marketSalary, mood: clampMood(s.mood + BALANCE.churn.raiseMoodBoost), moodLowWeeks: 0 } : s
    ),
    feed: trimFeed(feed),
  };
}

/** Resolve a pending player-choice event by picking one of the options. */
export function resolveChoice(state: GameState, optionId: string): GameState {
  const pc = state.pendingChoice;
  if (!pc) return state;
  const option = (pc.event.options as readonly ChoiceOption[]).find((o) => o.id === optionId);
  if (!option) return state;
  const feedText = `${pc.event.title}, you chose: "${option.label}".`;
  const applied = applyEventEffect(state, option.effect, state.week, feedText, pc.event.tone as FeedTone);
  return {
    ...applied,
    pendingChoice: null,
    resolvedChoices: [...state.resolvedChoices, pc.event.id],
    seenChoices: state.seenChoices.includes(pc.event.id)
      ? state.seenChoices
      : [...state.seenChoices, pc.event.id],
  };
}

/** Resolve a pending rival poach (Track C): match their offer to keep your employee, or let them go.
 *  Matching pays a signing bonus + lifts them to market pay and sets a re-poach cooldown; declining
 *  (or failing to afford the match) removes them to the rival and dents the rest of the team's mood. */
export function resolvePoach(state: GameState, accept: boolean): GameState {
  const pp = state.pendingPoach;
  if (!pp) return state;
  const member = state.staff.find((s) => s.id === pp.staffId);
  const feed = [...state.feed];
  // Employee already gone (e.g. quit the same tick) — just clear the prompt.
  if (!member) return { ...state, pendingPoach: null, feed: trimFeed(feed) };
  const p = BALANCE.poaching;
  const loseThem = (text: string): GameState => {
    feed.push(feedItem(state.week, text, "negative"));
    return {
      ...state,
      pendingPoach: null,
      staff: state.staff
        .filter((s) => s.id !== member.id)
        .map((s) => ({ ...s, mood: clampMood(s.mood - p.declineTeamMoodHit) })),
      feed: trimFeed(feed),
    };
  };

  if (!accept) return loseThem(`${member.name} left to join ${pp.rivalName}.`);
  // Can't match an offer you can't afford → they walk.
  if (state.cash < pp.retainCost) {
    return loseThem(`You couldn't match ${pp.rivalName}'s offer, and ${member.name} left to join them.`);
  }
  const marketSalary = salaryFor(member.role, member.skill);
  const newSalary = toDollars(member.salary) >= toDollars(marketSalary) ? member.salary : marketSalary;
  feed.push(feedItem(state.week, `You matched ${pp.rivalName}'s offer and kept ${member.name}. They feel valued.`, "positive"));
  return {
    ...state,
    cash: sub(state.cash, pp.retainCost),
    pendingPoach: null,
    staff: state.staff.map((s) =>
      s.id === member.id
        ? { ...s, salary: newSalary, mood: clampMood(s.mood + p.retainMoodBoost), moodLowWeeks: 0, poachCooldownUntil: state.week + p.cooldownWeeks }
        : s,
    ),
    feed: trimFeed(feed),
  };
}

/** Recent weekly revenue in CENTS — the creditworthiness signal for financing (engine/financing.ts). */
function weeklyRevenueCents(state: GameState): number {
  return Math.round(toDollars(nextWeekRevenue(state)) * 100);
}

/** How much the player can still borrow right now (Money). Exposed for the financing UI. */
export function loanCreditAvailable(state: GameState): Money {
  return cents(creditLimit(weeklyRevenueCents(state), state.loans ?? []));
}

/** The weekly interest rate the player would be offered for a new loan right now (0..1). */
export function loanRateNow(state: GameState): number {
  return loanRate(state.reputation, weeklyRevenueCents(state), state.loans ?? []);
}

/** Take on a debt-financing loan (Track C): receive the principal (less a small origination fee) as
 *  cash now, in exchange for fixed weekly debt service amortized over the term. Rejected if bankrupt,
 *  below the minimum, or beyond the current credit limit. */
export function takeLoan(state: GameState, principalCents: number): GameState {
  if (state.bankrupt) return state;
  const loans = state.loans ?? [];
  const f = BALANCE.financing;
  const principal = Math.round(principalCents);
  const limit = creditLimit(weeklyRevenueCents(state), loans);
  if (principal < f.minLoan || principal > limit) return state;
  const loan = makeLoan(`loan-${state.week}-${loans.length}`, principal, state.reputation, weeklyRevenueCents(state), loans, state.week);
  const proceeds = Math.round(principal * (1 - f.originationFee));
  const aprPct = Math.round(loan.ratePerWeek * 52 * 100);
  const feed = trimFeed([
    ...state.feed,
    feedItem(state.week, `Borrowed ${format(cents(principal))} at ~${aprPct}% APR, repaying ${format(cents(loan.weeklyPayment))}/wk for ${loan.termWeeks} weeks.`, "accent"),
  ]);
  return { ...state, cash: add(state.cash, cents(proceeds)) as Money, loans: [...loans, loan], feed };
}

/** Pay off a loan early in full (Track C): clears the remaining balance from cash, ending its weekly
 *  service. Rejected if the player can't cover the payoff. */
export function repayLoan(state: GameState, id: string): GameState {
  const loans = state.loans ?? [];
  const loan = loans.find((l) => l.id === id);
  if (!loan) return state;
  const payoff = cents(Math.round(loan.balance));
  if (state.cash < payoff) return state;
  const feed = trimFeed([...state.feed, feedItem(state.week, `Paid off a loan early (${format(payoff)}).`, "positive")]);
  return { ...state, cash: sub(state.cash, payoff), loans: loans.filter((l) => l.id !== id), feed };
}

export function researchNext(state: GameState, kind: ComponentKind): GameState {
  const cost = rdRpCostFor(state, kind);
  if (cost === null || state.researchPoints < cost) return state;
  const next = researchedTier(state, kind) + 1;
  const def = tierDef(kind, next)!;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Researched ${def.name}.`, "accent"));
  return {
    ...state,
    researchPoints: state.researchPoints - cost,
    researched: { ...state.researched, [kind]: next },
    feed: trimFeed(feed),
  };
}

/** RP cost to unlock the next camera lens count (null when already at the max). */
export function lensUnlockCost(s: GameState): number | null {
  const next = (s.lensLimit ?? 2) + 1;
  if (next > BALANCE.design.maxLenses) return null;
  return BALANCE.design.lensUnlockCosts[next] ?? null;
}

const LENS_NAMES: Record<number, string> = { 3: "triple-lens module", 4: "quad-lens array" };

/** Spend RP to unlock designing with one more camera lens. */
export function unlockLens(state: GameState): GameState {
  const cost = lensUnlockCost(state);
  if (cost === null || state.researchPoints < cost) return state;
  const next = (state.lensLimit ?? 2) + 1;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Camera lab: ${LENS_NAMES[next] ?? `${next}-lens design`} unlocked.`, "accent"));
  return {
    ...state,
    researchPoints: state.researchPoints - cost,
    lensLimit: next,
    feed: trimFeed(feed),
  };
}

const DEFAULT_FINISH_LIMIT = BALANCE.design.freeFinishes - 1;
const finishLimitOf = (s: GameState) => s.finishLimit ?? DEFAULT_FINISH_LIMIT;

/** RP cost to unlock the next premium finish in FINISH_ORDER (null when all are unlocked). */
export function finishUnlockCost(s: GameState): number | null {
  const next = finishLimitOf(s) + 1;
  if (next >= FINISH_ORDER.length) return null;
  return BALANCE.design.finishUnlockCosts[FINISH_ORDER[next]] ?? null;
}

/** Spend RP to unlock designing with the next premium finish (titanium → gold). */
export function unlockFinish(state: GameState): GameState {
  const cost = finishUnlockCost(state);
  if (cost === null || state.researchPoints < cost) return state;
  const next = finishLimitOf(state) + 1;
  const name = FINISH_ORDER[next];
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Materials lab: ${name.charAt(0).toUpperCase()}${name.slice(1)} finish unlocked.`, "accent"));
  return {
    ...state,
    researchPoints: state.researchPoints - cost,
    finishLimit: next,
    feed: trimFeed(feed),
  };
}

/** Buy a company research project with RP and apply it. */
export function buyProject(state: GameState, id: ProjectId): GameState {
  if (hasProject(state.completedProjects, id)) return state;
  const proj = projectById(id);
  if (proj.era > state.era || state.researchPoints < proj.rpCost) return state;
  // Research-tree fork (Track D): refuse if a mutually-exclusive sibling doctrine is already chosen.
  if (forkLockedBy(state.completedProjects, id)) return state;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Completed research project: ${proj.name}.`, "positive"));
  return {
    ...state,
    researchPoints: state.researchPoints - proj.rpCost,
    completedProjects: [...state.completedProjects, id],
    feed: trimFeed(feed),
  };
}

// ---------- Office builder (furniture layout) ----------
export function placeFurniture(state: GameState, type: FurnitureId, c: number, r: number, rot: Rot): GameState {
  const cost = dollars(furnitureCost(type));
  if (state.cash < cost) return state; // can't afford — no-op (the UI surfaces "Need $X")
  const iid = `f${state.furnitureCounter}`;
  const layout = addFurniture(state.layout, iid, type, c, r, rot);
  if (layout === state.layout) return state; // rejected (overlap / out of bounds) — no charge
  return { ...state, cash: sub(state.cash, cost), layout, furnitureCounter: state.furnitureCounter + 1 };
}
export function moveFurniture(state: GameState, iid: string, c: number, r: number): GameState {
  const layout = moveFurnitureOp(state.layout, iid, c, r);
  return layout === state.layout ? state : { ...state, layout };
}
export function rotateFurniture(state: GameState, iid: string): GameState {
  const layout = rotateFurnitureOp(state.layout, iid);
  return layout === state.layout ? state : { ...state, layout };
}
/** Sell a placed item back to the shop — removes it and refunds BALANCE.shop.resaleRate of its cost. */
export function removeFurniture(state: GameState, iid: string): GameState {
  const it = state.layout.find((x) => x.iid === iid);
  const layout = removeFurnitureOp(state.layout, iid);
  if (layout === state.layout) return state; // nothing removed
  const refund = it ? dollars(Math.round(furnitureCost(it.type) * BALANCE.shop.resaleRate)) : ZERO;
  return { ...state, cash: add(state.cash, refund) as Money, layout };
}
export function resetFurniture(state: GameState): GameState {
  return { ...state, layout: defaultLayout() };
}
/** Replace the whole layout (used by Undo). */
export function setLayout(state: GameState, layout: PlacedItem[]): GameState {
  return { ...state, layout };
}
/** Restore a Decorate undo snapshot — both the layout AND the cash, so undoing a purchase is a
 *  true reversal (cash back in full; selling is the deliberate 50%-refund path instead). */
export function applyLayoutSnapshot(state: GameState, snap: { layout: PlacedItem[]; cash: Money }): GameState {
  return { ...state, layout: snap.layout, cash: snap.cash };
}
/** Buy another copy of a placed item, dropped into the nearest free cell (charges its cost). */
export function duplicateFurniture(state: GameState, iid: string): GameState {
  const it = state.layout.find((x) => x.iid === iid);
  if (!it) return state;
  const cost = dollars(furnitureCost(it.type));
  if (state.cash < cost) return state; // can't afford
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [2, 0], [0, 2], [-2, 0]]) {
    const c = it.c + dc, r = it.r + dr;
    if (canPlace(state.layout, it.type, c, r, it.rot)) {
      const copy: PlacedItem = { ...it, iid: `f${state.furnitureCounter}`, c, r };
      return { ...state, cash: sub(state.cash, cost), layout: [...state.layout, copy], furnitureCounter: state.furnitureCounter + 1 };
    }
  }
  return state;
}
export function setFloorStyle(state: GameState, i: number): GameState {
  return { ...state, roomStyle: { ...state.roomStyle, floor: i } };
}
export function setWallStyle(state: GameState, i: number): GameState {
  return { ...state, roomStyle: { ...state.roomStyle, wall: i } };
}

/** Rename the company (used on the marketing TV + HQ). Falls back to "Silicon" if blank. */
export function setCompanyName(state: GameState, name: string): GameState {
  const trimmed = name.trim().slice(0, 18);
  return { ...state, companyName: trimmed || "Silicon" };
}

/** Toggle Creative / Sandbox mode. Enabling it tops cash + research up to the (effectively unlimited)
 *  Creative floors immediately, so it feels limitless right away rather than waiting for the next tick. */
export function setSandbox(state: GameState, on: boolean): GameState {
  if (!on) return { ...state, sandboxUnlocked: false };
  const cash = state.cash < BALANCE.creative.cashFloor ? BALANCE.creative.cashFloor : state.cash;
  const researchPoints = state.researchPoints < BALANCE.creative.rpFloor ? BALANCE.creative.rpFloor : state.researchPoints;
  return { ...state, sandboxUnlocked: true, cash, researchPoints };
}

// ---------- Platform / OS division (DLC #1) ----------
/** Devices in the field running your OS. */
export const platformInstalledBase = (s: GameState): number => installedBase(s.launched);
/** Current OS tier (name + number) from the software research level. */
export const osTierInfo = (s: GameState): OsTierInfo => osTier(s.researched.software);
/** Display name for the OS — the player's name, or "<Company> OS" by default. */
export const osDisplayName = (s: GameState): string => (s.osName.trim() || `${s.companyName} OS`);
/** Can a new OS version be released right now (research has advanced past the released version)? */
export const canReleaseOsVersion = (s: GameState): boolean => canReleaseVersion(s.osVersion, s.researched.software);

/** Unlock (or re-lock) the Platform division directly (used by Creative/sandbox + tests). */
export function unlockPlatform(state: GameState, on: boolean): GameState {
  return { ...state, platformUnlocked: on };
}

/** The one-time cash cost to found the Platform division — a major reinvestment milestone. */
export const platformFoundingCost = (): Money => BALANCE.platform.foundingCost;
/** Can the player found the division right now (not yet founded, and can afford it)? */
export const canFoundPlatform = (s: GameState): boolean =>
  !s.platformUnlocked && s.cash >= BALANCE.platform.foundingCost;

/** Found the Platform division: pay the founding cost and bring your OS up as a first-class business.
 *  No-op if already founded or unaffordable. The earned, in-game path to the OS (vs. a free toggle). */
export function foundPlatform(state: GameState): GameState {
  if (state.platformUnlocked) return state;
  const cost = BALANCE.platform.foundingCost;
  if (state.cash < cost) return state;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Founded the Platform division, ${osDisplayName(state)} is now a business in its own right.`, "positive"));
  return { ...state, cash: sub(state.cash, cost) as Money, platformUnlocked: true, feed: trimFeed(feed) };
}

/** Rename the OS line (empty clears back to the "<Company> OS" default). */
export function setOsName(state: GameState, name: string): GameState {
  return { ...state, osName: name.trim().slice(0, 22) };
}

/** Choose (or clear) the OS philosophy — a lasting identity that tilts every device you launch and
 *  your services. No-op unless the division is unlocked. Passing the current id again clears it (toggle). */
export function setOsPhilosophy(state: GameState, id: string | null): GameState {
  if (!state.platformUnlocked) return state;
  const next = id && id !== state.osPhilosophy ? id : null;
  return { ...state, osPhilosophy: next };
}

/** Release a new OS version — a software "launch day": catches the released version up to your
 *  research tier and grants a one-time, bounded reputation + fan lift across the installed base.
 *  No-op unless the Platform division is unlocked and research is actually ahead. */
export function releaseOsVersion(state: GameState): GameState {
  if (!state.platformUnlocked || !canReleaseOsVersion(state)) return state;
  const newVersion = osTierInfo(state).tier;
  const reward = osReleaseReward(platformInstalledBase(state));
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `${osDisplayName(state)} ${newVersion}.0 released, the installed base updated. +${reward.fans.toLocaleString()} fans.`, "positive"));
  return {
    ...state,
    osVersion: newVersion,
    reputation: Math.min(100, state.reputation + reward.reputation),
    fans: state.fans + reward.fans,
    feed: trimFeed(feed),
  };
}

/** Total weekly licensing fees from all rivals currently licensing your OS (fee scales with each
 *  rival's reputation × your OS tier). */
export function weeklyLicenseFees(s: GameState): Money {
  if (s.osLicensees.length === 0) return ZERO;
  const tier = osTierInfo(s).tier;
  let acc = ZERO;
  for (const id of s.osLicensees) {
    const rival = s.competitors.find((c) => c.id === id);
    if (rival) acc = add(acc, rivalLicenseFee(rival.reputation, tier));
  }
  return acc;
}

/** License your OS to a rival: a new recurring revenue line, but it strengthens that competitor
 *  in your shared categories (the platform trade-off). No-op unless the division is unlocked. */
export function licenseOsToRival(state: GameState, rivalId: string): GameState {
  if (!state.platformUnlocked) return state;
  if (state.osLicensees.includes(rivalId)) return state;
  if (!state.competitors.some((c) => c.id === rivalId)) return state;
  const rival = state.competitors.find((c) => c.id === rivalId);
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `${rival?.name ?? "A rival"} now licenses ${osDisplayName(state)}, new revenue, but a sharper competitor.`, "accent"));
  return {
    ...state,
    osLicensees: [...state.osLicensees, rivalId],
    // A new partner starts content.
    osLicenseeHealth: { ...state.osLicenseeHealth, [rivalId]: BALANCE.platform.licenseeChurn.startHealth },
    feed: trimFeed(feed),
  };
}

/** A licensee's current satisfaction (0..100), defaulting to startHealth if untracked. */
export const licenseeHealthOf = (s: GameState, id: string): number =>
  s.osLicenseeHealth[id] ?? BALANCE.platform.licenseeChurn.startHealth;

/** A licensee's mood bucket (happy/content/strained/at-risk) for the UI. */
export const licenseeMoodOf = (s: GameState, id: string) => licenseeMood(licenseeHealthOf(s, id));

/** End a rival's OS license — drops the fee, removes their competitiveness uplift. */
export function revokeOsLicense(state: GameState, rivalId: string): GameState {
  if (!state.osLicensees.includes(rivalId)) return state;
  const osLicenseeHealth = { ...state.osLicenseeHealth };
  delete osLicenseeHealth[rivalId];
  return { ...state, osLicensees: state.osLicensees.filter((id) => id !== rivalId), osLicenseeHealth };
}

/** OS feature modules with their install/locked/affordable status, for the Platform screen. */
export const osFeatureList = (s: GameState): OsFeatureRow[] =>
  osFeatureRows(s.osFeatures, s.osVersion, s.researchPoints);

/** Ecosystem-stat points the OS currently adds to every device you launch (0 unless unlocked). */
export const osEcoBonus = (s: GameState): number =>
  s.platformUnlocked ? osEcosystemBonus(s.osFeatures) : 0;

/** Can a specific OS feature module be installed right now? */
export const canInstallFeature = (s: GameState, id: string): boolean =>
  s.platformUnlocked && canInstallOsFeature(s.osFeatures, s.osVersion, s.researchPoints, id);

/** Build (research) an OS feature module: spend its RP cost and ship it in the OS. No-op unless the
 *  division is unlocked, its OS version is reached, it's affordable, and it isn't already installed. */
export function installOsFeature(state: GameState, id: string): GameState {
  if (!canInstallFeature(state, id)) return state;
  const feat = osFeatureById(id);
  if (!feat) return state;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `${osDisplayName(state)} gained ${feat.name}, a new platform capability.`, "accent"));
  return {
    ...state,
    researchPoints: state.researchPoints - feat.rpCost,
    osFeatures: [...state.osFeatures, id],
    feed: trimFeed(feed),
  };
}

/** Reassign a staff member to a different function. */
export function assignStaff(state: GameState, id: string, assignment: Assignment): GameState {
  return { ...state, staff: state.staff.map((s) => (s.id === id ? { ...s, assignment } : s)) };
}

// ---------- Delegation & ops (Epic E): automations that only do what the player already can ----------

/** The premium research division each delegation requires, and the specialist role it lets you hire. */
export const DELEGATION_REQ = {
  autoAssign: { project: "peopleOps" as ProjectId, role: "hr" as StaffRole },
  autoResearch: { project: "researchDivision" as ProjectId, role: "researcher" as StaffRole },
} as const;

/** Whether the company can auto-assign: it opened People Operations AND employs a People Lead (or a
 *  pre-gating save that already had it on, grandfathered). The People Lead's salary is the weekly cost. */
export function canAutoAssign(state: GameState): boolean {
  if (state.automation.autoAssignFree) return true;
  const { project, role } = DELEGATION_REQ.autoAssign;
  return hasProject(state.completedProjects, project) && state.staff.some((s) => s.role === role);
}

/** Whether the company can auto-research: it stood up a Research Division AND employs a Lead Researcher
 *  (or a grandfathered save). The Lead Researcher's salary is the standing weekly cost. */
export function canAutoResearch(state: GameState): boolean {
  if (state.automation.autoResearchFree) return true;
  const { project, role } = DELEGATION_REQ.autoResearch;
  return hasProject(state.completedProjects, project) && state.staff.some((s) => s.role === role);
}

/** Toggle a delegation automation. Pure. */
export function setAutomation(state: GameState, patch: Partial<GameState["automation"]>): GameState {
  return { ...state, automation: { ...state.automation, ...patch } };
}

/** Delegation: send every idle staffer to their role's discipline (what the player does by hand).
 *  Pure; returns the SAME state object when nobody is idle (referential stability). */
export function autoAssignIdle(state: GameState): GameState {
  if (!state.staff.some((s) => s.assignment === "idle")) return state;
  return {
    ...state,
    staff: state.staff.map((s) => (s.assignment === "idle" ? { ...s, assignment: ROLE_ASSIGNMENT[s.role] } : s)),
  };
}

/** Delegation: claim the cheapest affordable, in-era, not-yet-completed research project — one per
 *  week, so RP still accrues toward bigger goals and the player can still intervene. Pure; reuses
 *  buyProject so it can never do anything the player couldn't. Same state when nothing is affordable. */
export function autoClaimResearch(state: GameState): GameState {
  const next = RESEARCH_PROJECTS
    // Skip fork-locked doctrine siblings: buyProject would no-op on them, stalling the automation on a
    // permanently-unbuyable cheapest pick. Doctrine choices stay a manual decision (a real fork).
    .filter((p) => p.era <= state.era && !hasProject(state.completedProjects, p.id) && p.rpCost <= state.researchPoints && !p.fork)
    .sort((a, b) => a.rpCost - b.rpCost)[0];
  return next ? buyProject(state, next.id) : state;
}

/** Apply all ENABLED + CAPABLE weekly automations (called at the top of the tick). Pure + deterministic
 *  (no rng). Defaults are off, so a save without delegation runs byte-identically. */
export function applyWeeklyAutomation(state: GameState): GameState {
  let s = state;
  if (state.automation.autoAssign && canAutoAssign(state)) s = autoAssignIdle(s);
  if (state.automation.autoResearch && canAutoResearch(state)) s = autoClaimResearch(s);
  return s;
}

/** Pay to instantly raise a staff member's skill by 1. */
export function trainStaff(state: GameState, id: string): GameState {
  const member = state.staff.find((s) => s.id === id);
  if (!member || member.skill >= BALANCE.staff.maxSkill) return state;
  const cost = trainCost(member.skill);
  if (state.cash < cost) return state;
  return {
    ...state,
    cash: sub(state.cash, cost),
    staff: state.staff.map((s) =>
      s.id === id
        ? {
            ...s,
            skill: s.skill + 1,
            salary: salaryFor(s.role, s.skill + 1),
            // Mirror the weekly level-up sync (see advanceOneWeek): all discipline OUTPUT reads
            // s.skills, not the headline skill, so without this a paid training raised salary +
            // burn but produced zero mechanical gain. Lift the role's primary discipline to match.
            skills: {
              ...s.skills,
              [ROLE_DISCIPLINE[s.role]]: Math.min(100, Math.max(s.skills[ROLE_DISCIPLINE[s.role]], (s.skill + 1) * 10)),
            },
          }
        : s,
    ),
  };
}

/** Cash cost to send a staff member on paid time off (Rest) — one week of their salary, with a
 *  floor so it's never free (the unpaid founder would otherwise get unlimited morale resets). */
export function restCost(member: Staff): Money {
  const floor = dollars(BALANCE.churn.restMinCost);
  return member.salary > floor ? member.salary : floor;
}

/** Rest: pay for time off — a big immediate morale boost that also clears the burnout danger
 *  counter. Unlike a raise it's a one-off cost with no permanent salary change — the emergency
 *  "they're burning out, give them a break" lever. No-op if already maxed-mood or can't afford. */
export function restStaff(state: GameState, id: string): GameState {
  const member = state.staff.find((s) => s.id === id);
  if (!member || member.mood >= 100) return state;
  const cost = restCost(member);
  if (state.cash < cost) return state;
  return {
    ...state,
    cash: sub(state.cash, cost),
    staff: state.staff.map((s) =>
      s.id === id
        ? { ...s, mood: Math.min(100, s.mood + BALANCE.churn.restMoodBoost), moodLowWeeks: 0 }
        : s,
    ),
  };
}

export type MoraleKind = "bonus" | "offsite";

/** The cash cost of a company-wide morale spend (Track C): a multiple of weekly payroll, floored so a
 *  garage with an unpaid founder still pays something real. */
export function moraleCost(state: GameState, kind: MoraleKind): Money {
  const m = BALANCE.morale;
  const weeks = kind === "offsite" ? m.offsiteCostWeeks : m.bonusCostWeeks;
  const scaled = scale(weeklyPayroll(state.staff), weeks);
  const floor = dollars(m.minCost);
  return scaled > floor ? scaled : floor;
}

/** Whether a company-wide morale spend is available right now (off cooldown, solvent, has a team). */
export function canBoostMorale(state: GameState, kind: MoraleKind): boolean {
  if (state.bankrupt || state.staff.length === 0) return false;
  if (state.week < (state.moraleCooldownUntil ?? 0)) return false;
  return state.cash >= moraleCost(state, kind);
}

/** Invest in the whole team's morale (Track C): a bonus or an offsite lifts EVERY teammate's mood and
 *  clears their burnout danger counter, for a cash cost scaled to payroll, then starts a cooldown. The
 *  proactive counterpart to the reactive per-person Rest — spend to keep the team happy (and harder to
 *  poach) instead of pocketing the cash. No-op when on cooldown or unaffordable. */
export function boostMorale(state: GameState, kind: MoraleKind): GameState {
  if (!canBoostMorale(state, kind)) return state;
  const m = BALANCE.morale;
  const lift = kind === "offsite" ? m.offsiteMoodLift : m.bonusMoodLift;
  const cost = moraleCost(state, kind);
  const label = kind === "offsite" ? "company offsite" : "team bonus";
  const feed = trimFeed([...state.feed, feedItem(state.week, `Ran a ${label} (${format(cost)}). The whole team feels it.`, "positive")]);
  return {
    ...state,
    cash: sub(state.cash, cost),
    moraleCooldownUntil: state.week + m.cooldownWeeks,
    staff: state.staff.map((s) => ({ ...s, mood: clampMood(s.mood + lift), moodLowWeeks: 0 })),
    feed,
  };
}

export function hireCostFor(role: StaffRole, skill: number, discounted = false): Money {
  // One-time hiring fee = 3 weeks of salary (Talent Network cuts it 40%).
  const base = scale(salaryFor(role, skill), 3);
  return discounted ? scale(base, 0.6) : base;
}

const ROLE_ASSIGNMENT: Record<StaffRole, Assignment> = {
  engineer: "rnd",
  designer: "design",
  marketer: "marketing",
  // A Lead Researcher naturally sits in R&D (and trickles RP); a People Lead defaults to marketing
  // (people/comms), but both earn their keep by UNLOCKING delegation, not their seat output.
  researcher: "rnd",
  hr: "marketing",
};

/** One placed desk = one seat. Hiring is desk-gated: the team can never outgrow the desks
 *  the player actually bought in Decorate (the new hire's robot spawns AT a free desk). */
// Seats an employee can occupy = placed furniture desks + player-bought desktops. Buying a
// desktop both adds a workstation to the garage AND opens a seat to hire someone into.
export const deskCapacity = (s: GameState): number => deskItems(s.layout).length + (s.desktops ?? 0);

export function hireStaff(state: GameState, role: StaffRole, skill: number, name: string): GameState {
  const cap = facility(state).staffCapacity;
  if (state.staff.length >= cap) return state;
  if (state.staff.length >= deskCapacity(state)) return state; // every seat taken — buy a desk first
  const fee = hireCostFor(role, skill, hasProject(state.completedProjects, "talentNetwork"));
  if (state.cash < fee) return state;
  const rng = rngFrom(state);
  const identity = makeIdentity(rng, role);
  const finalSkill = identity.trait === "veteran" ? Math.min(BALANCE.staff.maxSkill, skill + 1) : skill;
  const member: Staff = {
    id: `s${state.staffCounter}`,
    role,
    name,
    skill: finalSkill,
    skills: makeSkills(rng, role, finalSkill),
    salary: salaryFor(role, finalSkill),
    assignment: ROLE_ASSIGNMENT[role],
    xp: 0,
    ...identity,
  };
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Hired ${name}, ${ROLE_TITLE[role]}.`, "accent"));
  return {
    ...state,
    rngState: rng.state(),
    cash: sub(state.cash, fee),
    staff: [...state.staff, member],
    staffCounter: state.staffCounter + 1,
    feed: trimFeed(feed),
  };
}

/** The senior skill a recruited delegation specialist (People Lead / Lead Researcher) signs at. */
export const SPECIALIST_SKILL = 6;

/** One-time fee to recruit a delegation specialist (Talent Network discounts it, like any hire). */
export function specialistHireFee(state: GameState, which: "autoAssign" | "autoResearch"): Money {
  return hireCostFor(DELEGATION_REQ[which].role, SPECIALIST_SKILL, hasProject(state.completedProjects, "talentNetwork"));
}

/** Recruit a delegation specialist. Gated on having opened the matching premium research division (it
 *  "establishes the desk" the specialist fills). Reuses hireStaff, so desk/capacity/cash rules and the
 *  spawned avatar all apply, and their weekly salary becomes the automation's standing cost. Pure. */
export function hireSpecialist(state: GameState, which: "autoAssign" | "autoResearch"): GameState {
  const { project, role } = DELEGATION_REQ[which];
  if (!hasProject(state.completedProjects, project)) return state; // division not opened yet
  const name = NAMES[(state.staffCounter * 7) % NAMES.length];
  return hireStaff(state, role, SPECIALIST_SKILL, name);
}

// ---------- Recruitment: search → candidates → sign ----------

/** Open a recruitment search on a channel (Job Board / Headhunter). Costs the tier's fee and
 *  resolves after the tier's lead time. */
export function startRecruitment(state: GameState, tier: RecruitTier): GameState {
  if (state.recruitment) return state; // a search is already running
  const t = BALANCE.recruitment.tiers[tier];
  if (state.cash < t.cost) return state;
  const feed = trimFeed([...state.feed, feedItem(state.week, `Opened a ${t.label} search.`, "accent")]);
  return {
    ...state,
    cash: sub(state.cash, t.cost),
    recruitment: { tier, weeksLeft: t.weeks, startedWeek: state.week },
    feed,
  };
}

/** Generate the applicant pool when a search completes. The tier sets the skill spread + star
 *  odds. Varied roles, 0..100 profiles, traits. Advances + returns the rng (deterministic). */
function generateCandidates(state: GameState, tier: RecruitTier, rng: Rng): { candidates: Candidate[]; counter: number } {
  const t = BALANCE.recruitment.tiers[tier];
  const roles: StaffRole[] = ["engineer", "designer", "marketer"];
  const out: Candidate[] = [];
  let counter = state.candidateCounter;
  for (let i = 0; i < BALANCE.recruitment.candidates; i++) {
    const role = roles[rng.int(roles.length)];
    let level = Math.round(rng.range(t.minLevel, t.maxLevel));
    if (rng.next() < t.starChance) level = Math.min(9, level + 2 + rng.int(2));
    const skills = makeSkills(rng, role, level);
    const headline = levelFromSkills(skills, role);
    const identity = makeIdentity(rng, role);
    out.push({
      id: `c${counter++}`,
      role,
      name: NAMES[(counter * 7 + level) % NAMES.length],
      skill: headline,
      skills,
      salary: salaryFor(role, headline),
      hireFee: hireCostFor(role, headline, hasProject(state.completedProjects, "talentNetwork")),
      ...identity,
    });
  }
  return { candidates: out, counter };
}

/** Sign a candidate from the pool onto the team (respects capacity + cash). Removes them + clears
 *  the rest of that pool (the others "take other offers"). */
export function hireCandidate(state: GameState, candidateId: string): GameState {
  const cand = state.candidates.find((c) => c.id === candidateId);
  if (!cand) return state;
  if (state.staff.length >= facility(state).staffCapacity) return state;
  if (state.staff.length >= deskCapacity(state)) return state; // every seat taken — buy a desk first
  if (state.cash < cand.hireFee) return state;
  const member: Staff = {
    id: `s${state.staffCounter}`,
    role: cand.role,
    name: cand.name,
    skill: cand.skill,
    skills: cand.skills,
    salary: cand.salary,
    assignment: ROLE_ASSIGNMENT[cand.role],
    xp: 0,
    specialty: cand.specialty,
    trait: cand.trait,
    mood: cand.mood,
    appearance: cand.appearance,
  };
  const feed = trimFeed([...state.feed, feedItem(state.week, `Signed ${cand.name}, ${ROLE_TITLE[cand.role]}.`, "positive")]);
  return {
    ...state,
    cash: sub(state.cash, cand.hireFee),
    staff: [...state.staff, member],
    staffCounter: state.staffCounter + 1,
    candidates: [], // the rest of the shortlist moves on
    candidatesExpire: 0,
    feed,
  };
}

/** Dismiss the current candidate shortlist without hiring. */
export function clearCandidates(state: GameState): GameState {
  if (state.candidates.length === 0) return state;
  return { ...state, candidates: [], candidatesExpire: 0 };
}

export function fireStaff(state: GameState, id: string): GameState {
  if (id === "s0") return state; // can't fire the founder
  return { ...state, staff: state.staff.filter((s) => s.id !== id) };
}

export function upgradeFacility(state: GameState): GameState {
  const next = BALANCE.facilities[state.facilityTier]; // index = current tier
  if (!next || state.cash < next.upgradeCost) return state;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Moved into a new ${next.name}.`, "positive"));
  return {
    ...state,
    cash: sub(state.cash, next.upgradeCost),
    facilityTier: state.facilityTier + 1,
    feed: trimFeed(feed),
  };
}

export function canAdvance(state: GameState): boolean {
  return (
    state.era < maxEra() &&
    canAdvanceEra(state.era, state.reputation, state.cumulativeRevenue)
  );
}

/** The company can go public once it's reached the final era with strong reputation. */
export function canIPO(state: GameState): boolean {
  return !state.wentPublic && state.era >= maxEra() && state.reputation >= BALANCE.ipo.minReputation;
}

/** A headline valuation for the IPO celebration: lifetime revenue × a multiple, plus a CUBIC
 *  reputation term so a fledgling brand is worth almost nothing and a dominant one compounds. */
export function ipoValuation(state: GameState): Money {
  const fromRevenue = scale(state.cumulativeRevenue, BALANCE.ipo.valuationPerRevenueDollar);
  const repFrac = Math.max(0, Math.min(100, state.reputation)) / 100;
  const fromRep = scale(BALANCE.ipo.repValuationMax, repFrac * repFrac * repFrac);
  return add(fromRevenue, fromRep);
}

export function goPublic(state: GameState): GameState {
  if (!canIPO(state)) return state;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, "The company reached the pinnacle of the industry.", "positive"));
  return { ...state, wentPublic: true, feed: trimFeed(feed) };
}

// ---------- Equity: company valuation, IPO/listing, ownership, rival share trading ----------

/** The company's live market valuation (grows with lifetime revenue + reputation; floored). The
 *  performance-reactive momentum overlay (Track B) swings it within ±cap around that fundamental. */
export function companyValuation(state: GameState): Money {
  const fundamental = add(BALANCE.ipo.baseValuation, ipoValuation(state)) as Money;
  const cap = BALANCE.valuationMomentum.cap;
  const m = Math.max(-cap, Math.min(cap, state.valuationMomentum ?? 0));
  return scale(fundamental, 1 + m);
}

/** Founder's stake value = valuation × ownership. */
export function founderStakeValue(state: GameState): Money {
  return scale(companyValuation(state), state.ownership);
}

/** Net worth = cash + rival portfolio + the founder's stake in their own company. */
export function netWorth(state: GameState): Money {
  return add(add(state.cash, holdingsValue(state.holdings, state.competitors)), founderStakeValue(state));
}

// ---------- Industry leaderboard: the player's company vs the six public rivals ----------

export interface IndustryEntry {
  id: string;
  name: string;
  valuation: Money;
  isPlayer: boolean;
}

/** The industry ranked by live company valuation (the player + every rival), biggest first.
 *  This is the late-game chase: climb from dead-last in the garage to #1 in the industry. */
export function industryLeaderboard(state: GameState): IndustryEntry[] {
  const board: IndustryEntry[] = state.competitors.map((c) => ({
    id: c.id,
    name: c.name,
    valuation: rivalMarketCap(c),
    isPlayer: false,
  }));
  board.push({ id: "player", name: state.companyName, valuation: companyValuation(state), isPlayer: true });
  board.sort((a, b) => toDollars(b.valuation) - toDollars(a.valuation));
  return board;
}

/** The player's 1-based rank in the industry (1 = the single biggest company). */
export function industryRank(state: GameState): number {
  const board = industryLeaderboard(state);
  const idx = board.findIndex((e) => e.isPlayer);
  return idx < 0 ? board.length : idx + 1;
}

/** Era-scaled verdict score bands. effectiveScore (= launchScore × competitionFactor) at or above
 *  `hit` is a hit, at/below `flop` is a flop, ≥ `solid` (but under hit) is a solid performer, else a
 *  steady seller. The bars rise with the era so late-game hits must be earned (Phase-2 scaling). The
 *  Design Lab preview and the launch use this SAME helper, so the projected verdict always matches. */
export function verdictBands(era: number): { hit: number; flop: number; solid: number } {
  const r = BALANCE.reputation;
  const i = Math.max(0, Math.min(era - 1, r.hitThresholdByEra.length - 1));
  return { hit: r.hitThresholdByEra[i], flop: r.flopThresholdByEra[i], solid: r.solidThresholdByEra[i] };
}

/** Can the company IPO to raise capital? (Established by revenue, not yet listed.) */
export function canList(state: GameState): boolean {
  return !state.listed && !state.bankrupt && state.cumulativeRevenue >= BALANCE.ipo.minRevenueToList;
}

/** IPO: sell `stake` (0..max) of the company on the exchange for a cash infusion; keep the rest. */
export function listCompany(state: GameState, stake: number): GameState {
  if (!canList(state)) return state;
  const pct = Math.max(0.05, Math.min(BALANCE.ipo.maxStakePerSale, stake));
  const raised = scale(companyValuation(state), pct);
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `${state.companyName} IPO'd, raised ${format(raised)} for ${Math.round(pct * 100)}%.`, "positive"));
  return { ...state, listed: true, ownership: 1 - pct, cash: add(state.cash, raised), feed: trimFeed(feed) };
}

/** Sell an additional `pct` of the company post-IPO for cash (dilution; keeps ≥5%). */
export function sellOwnStake(state: GameState, pct: number): GameState {
  if (!state.listed) return state;
  const sell = Math.max(0, Math.min(pct, state.ownership - 0.05));
  if (sell <= 0) return state;
  const raised = scale(companyValuation(state), sell);
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Sold ${Math.round(sell * 100)}% of ${state.companyName} for ${format(raised)}.`, "accent"));
  return { ...state, ownership: state.ownership - sell, cash: add(state.cash, raised), feed: trimFeed(feed) };
}

/** Buy `qty` shares of a rival company. */
export function buyShares(state: GameState, id: string, qty: number): GameState {
  if (qty <= 0) return state;
  const comp = state.competitors.find((c) => c.id === id);
  if (!comp) return state;
  const cost = buyCost(comp.sharePrice, qty);
  if (state.cash < cost) return state;
  return { ...state, cash: sub(state.cash, cost), holdings: { ...state.holdings, [id]: (state.holdings[id] ?? 0) + qty } };
}

/** Sell up to `qty` shares of a rival company. */
export function sellShares(state: GameState, id: string, qty: number): GameState {
  const comp = state.competitors.find((c) => c.id === id);
  const held = state.holdings[id] ?? 0;
  const q = Math.min(qty, held);
  if (!comp || q <= 0) return state;
  const holdings = { ...state.holdings, [id]: held - q };
  if (holdings[id] === 0) delete holdings[id];
  return { ...state, cash: add(state.cash, sellProceeds(comp.sharePrice, q)), holdings };
}

/** B3 — the all-cash cost to acquire a rival outright: its market cap × the control premium, LESS
 *  the market value of any shares the player already holds (you only pay for the rest). Null if the
 *  rival isn't on the board. Floored at a token amount so it's never free. */
export function acquisitionCost(state: GameState, id: string): Money | null {
  const c = state.competitors.find((x) => x.id === id);
  if (!c) return null;
  const gross = scale(rivalMarketCap(c), BALANCE.mergers.acquisitionPremium);
  const ownedValue = cents(Math.max(0, state.holdings[id] ?? 0) * c.sharePrice);
  const net = sub(gross, ownedValue);
  return toDollars(net) > 0 ? (net as Money) : cents(1);
}

/** Whether the player may acquire rival `id`: established (revenue), solvent enough to pay, and the
 *  field stays above its floor afterwards. */
export function canAcquire(state: GameState, id: string): boolean {
  if (state.bankrupt) return false;
  const c = state.competitors.find((x) => x.id === id);
  if (!c) return false;
  if (state.competitors.length <= BALANCE.mergers.minActiveRivals) return false;
  if (toDollars(state.cumulativeRevenue) < toDollars(BALANCE.ipo.minRevenueToList)) return false;
  const cost = acquisitionCost(state, id);
  return cost != null && state.cash >= cost;
}

/** B3 — acquire a rival outright: pay the buyout, remove it from competition, and absorb its brand
 *  (a one-time reputation lift) + its customer base (fans). Settles the player's existing shares into
 *  the deal (deleted, since their value was already credited against the price). A no-op if not allowed. */
export function acquireRival(state: GameState, id: string): GameState {
  if (!canAcquire(state, id)) return state;
  const c = state.competitors.find((x) => x.id === id)!;
  const cost = acquisitionCost(state, id)!;
  const m = BALANCE.mergers;
  const rivalRep = rivalDef(id)?.reputation ?? c.reputation;

  const competitors = state.competitors.filter((x) => x.id !== id);
  const holdings = { ...state.holdings };
  delete holdings[id];
  const osLicensees = state.osLicensees.filter((x) => x !== id);
  const osLicenseeHealth = { ...state.osLicenseeHealth };
  delete osLicenseeHealth[id];
  const fansGain = Math.min(m.fansCap, Math.round(Math.max(0, rivalRep) * m.fansPerRepPoint));
  const reputation = Math.min(BALANCE.reputation.max, state.reputation + m.repBonus);

  const feed = [...state.feed];
  feed.push(feedItem(
    state.week,
    `Acquired ${c.name} for ${format(cost)}, absorbed their brand (+${m.repBonus} rep) and ${fansGain.toLocaleString()} customers.`,
    "positive",
  ));

  return {
    ...state,
    cash: sub(state.cash, cost),
    competitors,
    holdings,
    osLicensees,
    osLicenseeHealth,
    fans: state.fans + fansGain,
    reputation,
    acquiredRivals: [...state.acquiredRivals, id],
    feed: trimFeed(feed),
  };
}

/**
 * Evaluate achievements against the current state and add any newly-satisfied ids to the unlocked
 * set (union — monotonic, never un-unlocks). PURE. Returns the same state object when nothing new
 * unlocked (referential stability), plus the list of ids that flipped this evaluation so the UI
 * layer can fire celebratory toasts for live-play unlocks only. Never mutates input.
 */
export function evaluateAndUnlock(
  state: GameState,
  mastery?: MasteryInput,
): { state: GameState; unlocked: string[] } {
  const prev = state.unlockedAchievements ?? [];
  const satisfied = evaluateAchievements(deriveFacts(state, mastery));
  const had = new Set(prev);
  const unlocked = satisfied.filter((id) => !had.has(id));
  if (unlocked.length === 0) return { state, unlocked: [] };
  return { state: { ...state, unlockedAchievements: [...prev, ...unlocked] }, unlocked };
}

/**
 * Fold "Next Move" objective completion into a state transition. Returns the state with any newly
 * satisfied objective ids latched into completedObjectives (monotonic), plus the ids that flipped
 * this evaluation so the UI can celebrate them. Mirrors evaluateAndUnlock. Never mutates input.
 */
export function evaluateObjectives(state: GameState): { state: GameState; completed: string[] } {
  const prev = state.completedObjectives ?? [];
  const completed = newlyCompletedObjectives(prev, state);
  if (completed.length === 0) return { state, completed: [] };
  return { state: { ...state, completedObjectives: [...prev, ...completed] }, completed };
}

export function advanceEraAction(state: GameState): GameState {
  if (!canAdvance(state)) return state;
  const era = state.era + 1;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Entered the ${eraName(era)}. New tech unlocked.`, "positive"));
  // Epic D — announce the era's rule shift so the change in texture is legible (pillar #5).
  const rule = eraRuleSummary(era);
  if (rule) feed.push(feedItem(state.week, `${eraName(era)} shift, ${rule}.`, "accent"));
  return { ...state, era, feed: trimFeed(feed) };
}

/** Catch up on offline time: advance up to a capped number of weeks at reduced rate. */
export function catchUpOffline(state: GameState): { state: GameState; weeks: number; gain: Money } {
  const now = Date.now();
  const elapsedMs = now - state.lastActive;
  const realSecondsPerWeek = BALANCE.secondsPerTick;
  const weeks = Math.min(
    BALANCE.offline.maxCatchUpWeeks,
    Math.floor(elapsedMs / 1000 / realSecondsPerWeek),
  );
  if (weeks <= 0) return { state: { ...state, lastActive: now }, weeks: 0, gain: ZERO };
  const cashBefore = state.cash;
  let s = state;
  // Offline runs at reduced effectiveness. Simulate FEWER whole weeks at full rate rather than
  // `weeks` weeks at a fractional rate: that keeps each launched product's finite sales curve in
  // lockstep with the revenue it banks (the old fractional path advanced the curve a full week
  // while collecting only half the units, permanently skipping the other half), while burn / RP /
  // dividends / fan-decay totals stay ~unchanged — they're all per-tick rate-scaled — and
  // weeksElapsed stays an integer index.
  const effectiveWeeks = Math.max(1, Math.round(weeks * BALANCE.offline.rate));
  for (let i = 0; i < effectiveWeeks; i++) s = advanceOneWeek(s, 1, true);
  // Events are skipped while offline; if the schedule slipped into the past during catch-up, push
  // it forward so the player isn't hit with an event the instant they return.
  const nextEventWeek = s.nextEventWeek <= s.week ? s.week + BALANCE.events.everyWeeks : s.nextEventWeek;
  return { state: { ...s, nextEventWeek, lastActive: now }, weeks, gain: sub(s.cash, cashBefore) };
}

export { dollars };
