// GameState + pure reducers. Composes the engine; owns NO React. Fully testable.
// The React hook (useGame) wraps these and drives the tick.
import { BALANCE } from "../engine/balance.ts";
import { CATEGORIES, tierDef } from "../engine/catalogs.ts";
import {
  advanceCompetitors,
  initCompetitors,
  rivalMarketCap,
  rivalStrengthsFor,
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
} from "../engine/economy.ts";
import {
  hasProject,
  launchRpReward,
  projectById,
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
  visionaryHype,
} from "../engine/staff.ts";
import { pickChoiceEvent, pickEvent, type ChoiceEvent, type ChoiceOption, type MarketEvent } from "../engine/events.ts";
import { channelById, type ChannelId } from "../engine/marketing.ts";
import {
  addItem as addFurniture,
  canPlace,
  defaultLayout,
  deskItems,
  moveItem as moveFurnitureOp,
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
import { canAdvanceEra, eraName, isCategoryUnlocked, maxEra } from "../engine/eras.ts";
import { deriveFacts, evaluateAchievements } from "../engine/achievements.ts";
import {
  advanceTrends,
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
import { buildCost, componentSynergy, computeStats, missingSlots, overallScore } from "../engine/product.ts";
import { distributeOverCurve, forecast } from "../engine/salesCurve.ts";
import { buyCost, holdingsValue, sellProceeds, weeklyDividends, type Holdings } from "../engine/stocks.ts";
import { makeRng, type Rng } from "../engine/rng.ts";
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
  holdings: Holdings; // shares owned in rival companies, by id
  /** Best (lowest) industry-leaderboard rank ever reached (1 = biggest company in the industry).
   *  Starts at 7 (a fresh garage is dead last behind the six rivals); each time the player climbs
   *  to a new best, the tick celebrates overtaking the rival(s) they passed. Monotonic downward. */
  bestIndustryRank: number;
  // --- Achievements ---
  /** ids of celebratory milestones the player has earned (monotonic — only ever grows). */
  unlockedAchievements: string[];
  /** A market event requiring a player decision — resolved via resolveChoice. */
  pendingChoice: { event: ChoiceEvent; week: number } | null;
  /** IDs of choice events already resolved — prevents repeats. */
  resolvedChoices: string[];
}

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
  { fans:     1_000, text: "1,000 fans — your brand is gaining recognition.", repBonus: 1 },
  { fans:     5_000, text: "5,000 fans — a real community is forming.", repBonus: 1 },
  { fans:    10_000, text: "10,000 fans! You're becoming a household name.", repBonus: 2 },
  { fans:    50_000, text: "50,000 fans — a major following. Brands take notice.", repBonus: 2 },
  { fans:   100_000, text: "100,000 fans! You're a leader in the market.", repBonus: 3 },
  { fans:   500_000, text: "500,000 fans — half a million people follow you.", repBonus: 3 },
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
  return makeRng(state.rngState || state.seed);
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
    furnitureCounter: 20,
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
    holdings: {},
    bestIndustryRank: 7, // a fresh garage is dead last behind the six public rivals
    unlockedAchievements: [],
    pendingChoice: null,
    resolvedChoices: [],
  };
}

// ---------- Derived selectors ----------
export const rndSkill = (s: GameState) => assignedSkill(s.staff, "rnd");
export const designerSkill = (s: GameState) => assignedSkill(s.staff, "design");
export const marketerSkill = (s: GameState) =>
  assignedSkill(s.staff, "marketing") * BALANCE.staff.marketerHypePerSkill;
export const facilityRent = (s: GameState): Money =>
  BALANCE.facilities[s.facilityTier - 1].weeklyRent;
export const facility = (s: GameState) => BALANCE.facilities[s.facilityTier - 1];
export const burn = (s: GameState): Money => weeklyBurn(s.staff, facilityRent(s));
export const designTierCeiling = (s: GameState) =>
  designCeiling(designerSkill(s)) + perfectionistCeilingBonus(s.staff) + designCeilingBonus(s.upgrades);
export const weeklyRpGen = (s: GameState) => weeklyRp(s.staff, s.era) * rpMultiplier(s.upgrades);
export const hypeBonus = (s: GameState) =>
  (hasProject(s.completedProjects, "brandStudio") ? 0.35 : 0) +
  (hasProject(s.completedProjects, "marketingAutomation") ? 0.20 : 0) +
  (hasProject(s.completedProjects, "megaLaunch") ? 0.30 : 0) +
  visionaryHype(s.staff) + marketingHype(s.upgrades);

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
  bonus.design = (bonus.design ?? 0) + designStatBonus(s.upgrades);
  bonus.quality = (bonus.quality ?? 0) + qualityStatBonus(s.upgrades);
  // Premium finishes (titanium/gold) read as more desirable → a small Design-appeal bonus.
  bonus.design = (bonus.design ?? 0) + (BALANCE.design.finishDesignBonus[product.finish] ?? 0);
  if (hasProject(s.completedProjects, "brandManual")) bonus.design = (bonus.design ?? 0) + 4;
  const out = { ...base };
  for (const k of Object.keys(bonus) as (keyof Stats)[]) {
    out[k] = Math.min(BALANCE.statMax, Math.round(out[k] + (bonus[k] ?? 0)));
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
export const projectBuildFast = (s: GameState) => hasProject(s.completedProjects, "assemblyLine");
export const buildWeeksFor = (s: GameState) =>
  Math.max(
    BALANCE.build.minWeeks,
    Math.round(buildWeeks(rndSkill(s), projectBuildFast(s)) - buildWeekReduction(s.upgrades))
      - (hasProject(s.completedProjects, "quickPrototype") ? 1 : 0),
  );

/** Upfront tooling / first-production-run cost charged when a build starts (Assembly cuts it). */
export function toolingCost(s: GameState, product: Product): Money {
  const base = scale(buildCost(product), BALANCE.build.toolingUnits * buildCostMult(s.upgrades));
  return base > BALANCE.build.minTooling ? base : BALANCE.build.minTooling;
}

/** Per-unit manufacturing cost after company projects + upgrades. */
export function effectiveUnitCost(s: GameState, product: Product): Money {
  let unitCost = buildCost(product);
  if (hasProject(s.completedProjects, "leanSupply")) unitCost = scale(unitCost, 0.85);
  if (hasProject(s.completedProjects, "verticalIntegration")) unitCost = scale(unitCost, 0.80);
  return scale(unitCost, buildCostMult(s.upgrades));
}

export interface ProductionPlan {
  plannedUnits: number;
  unitCost: Money;
  productionCost: Money; // unitCost × plannedUnits (paid upfront at build)
  tooling: Money;
  channelCost: Money;
  totalUpfront: Money;
  launchScore: number;
  demandFit: number; // 0..100 — how well the product matches current demand
  priceFit: number; // 0..1.35 — price fairness vs. perceived value (1 = on the money; →0 = gouging)
  hype: number; // total launch hype multiplier (reputation + marketing)
  overall: number; // product's overall quality score
  matchingRivals: number; // rivals roughly as good as you, splitting the market
  betterRivals: number; // rivals clearly better than you
  selfCompeting: number; // your OWN products still selling in this category (cannibalization)
  competitionFactor: number; // 0..1 share you keep after competition
  synergy: number; // 0.8..1.06 — component-combination balance (weak-link penalty / flagship bonus)
  preOrders: number; // guaranteed buyers from your fanbase
  marketDemand: number; // additional organic demand (after competition)
  totalDemand: number; // preOrders + marketDemand
  projectedSales: number; // min(plannedUnits, totalDemand)
  sellsOut: boolean;
  projectedRevenue: Money;
  projectedProfit: Money; // revenue − full production − tooling − channel (unsold = sunk cost)
  maxAffordableUnits: number;
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

  // Score WITHOUT the strength-based competition term — competition is modelled below as a
  // count of rivals that match/beat you, which is clearer and is what the player sees.
  const breakdown = scoreLaunch({
    stats,
    category: product.category,
    price: product.price,
    trends: s.trends,
    reputation: s.reputation,
    marketerSkill: marketerSkill(s),
    competitorStrength: 0,
    // Bound the combined hype bonus (studio + visionary marketers + marketing upgrade +
    // channel) before it reaches scoreLaunch, which also clamps total hype. Without this,
    // stacking many visionary marketers makes launchScore/volume explode. Safety guard.
    hypeBonus: Math.max(0, Math.min(HYPE_BONUS_MAX, hypeBonus(s) + channel.hype)),
    // Component-combination synergy: a glaring weak link drags the launch down; a coherent build
    // is rewarded — so designing the right MIX of components matters, not just maxing each slot.
    synergy: componentSynergy(product).factor,
  });

  const overall = overallScore(stats, product.category);
  const rivals = rivalStrengthsFor(s.competitors, product.category);
  const comp = BALANCE.market.competition;
  const margin = comp.beatMargin;
  let matchingRivals = 0;
  let betterRivals = 0;
  for (const r of rivals) {
    if (r > overall + margin) betterRivals++;
    else if (r >= overall - margin) matchingRivals++;
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
      (matchingRivals * comp.matchPenalty + betterRivals * comp.beatPenalty) * pressure +
      // Self-competition is era-independent: cannibalization is about YOUR line-up, not rivals.
      selfCompeting * comp.selfPenalty);

  const demandFit = breakdown.demand;
  const rawPreOrders = Math.round(s.fans * BALANCE.fans.preOrderConversion * (demandFit / 100));
  const organic = forecast(breakdown.launchScore, marketSize, breakdown.priceFit).totalUnits;
  const marketDemand = Math.round(organic * competitionFactor);
  // B4 — cap fan pre-orders to a share of TOTAL demand so a huge fanbase can't single-handedly
  // satisfy (and guarantee a sellout of) a token run. Pre-orders may cover at most preOrderCap of
  // (preOrders + organic market); the rest must come from the open market. Keeps fans meaningful
  // without letting them trivialise the production bet.
  const cap = BALANCE.fans.preOrderCap;
  // Solve preOrders ≤ cap × (preOrders + marketDemand) → preOrders ≤ cap/(1-cap) × marketDemand.
  const preOrderCeil = cap < 1 ? Math.round((cap / (1 - cap)) * marketDemand) : rawPreOrders;
  const preOrders = Math.min(rawPreOrders, preOrderCeil);
  const totalDemand = preOrders + marketDemand;

  const planned = Math.max(0, Math.round(plannedUnits));
  const projectedSales = Math.min(planned, totalDemand);
  const sellsOut = totalDemand > planned && planned > 0;

  const productionCost = scale(unitCost, planned);
  const channelCost = channel.cost;
  const totalUpfront = add(add(tooling, productionCost), channelCost) as Money;
  const projectedRevenue = scale(product.price, projectedSales);
  const projectedProfit = sub(sub(projectedRevenue, productionCost), add(tooling, channelCost)) as Money;
  const spendable = sub(s.cash, add(tooling, channelCost));
  const maxAffordableUnits = unitCost > 0 ? Math.max(0, Math.floor(toDollars(spendable) / toDollars(unitCost))) : BALANCE.build.maxRun;

  return {
    plannedUnits: planned,
    unitCost,
    productionCost,
    tooling,
    channelCost,
    totalUpfront,
    launchScore: breakdown.launchScore,
    demandFit,
    priceFit: breakdown.priceFit,
    hype: breakdown.hype,
    overall,
    matchingRivals,
    betterRivals,
    selfCompeting,
    competitionFactor,
    synergy: breakdown.synergy,
    preOrders,
    marketDemand,
    totalDemand,
    projectedSales,
    sellsOut,
    projectedRevenue,
    projectedProfit,
    maxAffordableUnits,
  };
}

/** Safety reserve the recommended run must leave untouched so the player stays solvent THROUGH
 *  the build (rent/payroll burn for buildWeeks, no revenue yet) + a small flat margin. B1: without
 *  this, recommending a run that spends nearly all cash on tooling+units bankrupts a fresh save
 *  before its first product ever launches. */
export function buildSafetyReserve(s: GameState): Money {
  const weeks = buildWeeksFor(s);
  return add(scale(burn(s), weeks), BALANCE.build.safetyReserveMargin) as Money;
}

/** Units you can afford while still leaving the build-through safety reserve intact. B1. */
export function affordableRun(s: GameState, product: Product, channelId: ChannelId = "none"): number {
  const probe = planProduction(s, product, BALANCE.build.minRun, channelId);
  const reserve = buildSafetyReserve(s);
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

/** Weekly ecosystem service income from all launched products with an ecosystem stat above threshold. */
export function weeklyEcosystemRevenue(s: GameState): Money {
  const rate = BALANCE.ecosystem.weeklyServiceRate;
  const minStat = BALANCE.ecosystem.minEcosystemStat;
  let acc = 0;
  for (const lp of s.launched) {
    const eco = lp.stats.ecosystem;
    if (eco > minStat) acc += lp.unitsSold * eco * rate;
  }
  return cents(Math.round(acc));
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
  const { competitors, launches } = advanceCompetitors(state.competitors, week, state.era, rng, recentPlayerHitCats);

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
        `"${lp.product.name}" lifecycle complete — ${newUnitsSold.toLocaleString()} sold (${sellThrough}% sell-through), ${format(newRevenue)} total.`,
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
  const ecosystemRate = BALANCE.ecosystem.weeklyServiceRate;
  const ecoMinStat = BALANCE.ecosystem.minEcosystemStat;
  for (const lp of launched) {
    const eco = lp.stats.ecosystem;
    if (eco > ecoMinStat) {
      cash = add(cash, cents(Math.round(lp.unitsSold * eco * ecosystemRate * rate)));
    }
  }

  // Burn
  cash = sub(cash, scale(burn(state), rate));

  // Dividend income from rival shares the player holds (uses this week's fresh prices).
  cash = add(cash, scale(weeklyDividends(state.holdings, competitors), rate));

  // Creative / sandbox mode keeps the company solvent for free experimentation.
  if (state.sandboxUnlocked && cash < dollars(1_000_000)) cash = dollars(1_000_000);

  // Feed events
  const feed = [...state.feed];
  for (const item of productsFeed) feed.push(item);
  // Rival launches: flag when a rival enters a category where the player has an active product.
  const activePlayerCats = new Set<CategoryId>(
    state.launched
      .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length)
      .map((lp) => lp.product.category),
  );
  for (const l of launches) pushRivalFeed(feed, l, activePlayerCats);

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
    return { ...lp, weeklyUnits, totalUnits: lp.unitsSold + remaining };
  });

  // Research points generated this week
  // Must match the weeklyRpGen selector (incl. the Workstations upgrade), else the UI lies.
  // RP must stay a non-negative integer: partial (offline, rate=0.5) ticks accrue
  // fractional RP, so floor on accrual to keep the counter clean.
  const researchPoints = floorRP(
    state.researchPoints + weeklyRp(state.staff, state.era) * rpMultiplier(state.upgrades) * rate,
  );

  // Manufacturing: advance build jobs; completed ones move to the "ready" shelf
  const building: BuildJob[] = [];
  const ready = [...state.ready];
  for (const job of state.building) {
    const weeksElapsed = job.weeksElapsed + rate;
    if (weeksElapsed >= job.totalWeeks) {
      ready.push(job.product);
      feed.push(feedItem(week, `“${job.product.name}” finished manufacturing — ready to launch.`, "accent"));
    } else {
      building.push({ ...job, weeksElapsed });
    }
  }

  // Staff XP / leveling + mood drift + churn
  const cashDropping = cash < state.cash;
  const teamPlayers = state.staff.filter((s) => s.trait === "teamPlayer").length;
  const churnCfg = BALANCE.churn;
  const quitIds: string[] = [];
  const staff = state.staff.map((s) => {
    const { staff: levelResult, leveledUp } = gainWeeklyXp(s);
    if (leveledUp) feed.push(feedItem(week, `${s.name} leveled up to skill ${levelResult.skill}.`, "positive"));
    // Salary is NOT auto-updated on level-up — player must give a raise manually.
    // Underpaid staff drift unhappy over time and may eventually quit.
    const next = leveledUp ? { ...levelResult, salary: s.salary } : levelResult;
    // Keep primary discipline score in sync with the headline skill level on a level-up.
    const skills = leveledUp
      ? { ...next.skills, [ROLE_DISCIPLINE[next.role]]: Math.min(100, Math.max(next.skills[ROLE_DISCIPLINE[next.role]], next.skill * 10)) }
      : next.skills;
    let target = 60 + moodBonus(state.upgrades);
    if (s.trait === "hustler") target -= 12;
    if (cashDropping) target -= 12;
    else target += 6;
    const lift = teamPlayers * 1.5;
    // Underpaid penalty: salary lagging behind skill level pulls mood target down.
    const marketSalary = salaryFor(next.role, next.skill);
    const isUnderpaid = next.id !== "s0" && toDollars(next.salary) < toDollars(marketSalary);
    if (isUnderpaid) target -= churnCfg.underpaidMoodPenalty;
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
    if (!offline && next.id !== "s0" && toDollars(next.salary) > 0 && newLowWeeks >= churnCfg.weeksUntilQuitRisk && rng.next() < churnCfg.quitChancePerWeek) {
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
    feed.push(feedItem(week, `${q.name} quit — sustained burnout pushed them to leave.`, "negative"));
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
      `Q${qNum} complete — ${format(cash)} cash · Rep ${Math.round(state.reputation)} · ${fansStr} fans.`,
      "accent",
    ));
  }

  const base: GameState = {
    ...state,
    week,
    cash,
    cumulativeRevenue,
    fans: newFans,
    researchPoints,
    building,
    ready,
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
    feed,
    rngState: rng.state(),
    bankrupt,
    // lastActive is stamped by the persistence layer on save, not per tick (keeps the reducer pure).
  };

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
          base.feed.push(feedItem(week, `${base.companyName} overtook ${r.name} — now #${newRank} in the industry.`, "positive"));
        }
        if (newRank === 1) {
          base.feed.push(feedItem(week, `${base.companyName} is now the #1 company in the industry. The throne is yours.`, "positive"));
        }
      }
      base.bestIndustryRank = newRank;
    }
  }

  // Market events only during live play — offline catch-up skips all events so the state stays
  // deterministic and the player isn't surprised by consequences they couldn't interact with.
  if (!offline && !bankrupt && week >= state.nextEventWeek) {
    // Choice events also require the player to be present to resolve them.
    if (!state.pendingChoice) {
      const choice = pickChoiceEvent(rng, state.era, state.resolvedChoices);
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
      // Sting, never kill: cap the hit at a share of cash on hand so a random event can't
      // push a by-the-book player below $0 (instant bankruptcy) mid-build.
      const capDollars = Math.max(0, toDollars(cash)) * BALANCE.events.crunchMaxCashShare;
      cash = sub(cash, dollars(Math.min(eff.cash, capDollars)));
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

  feed.push(feedItem(week, feedText, feedTone));
  return { ...s, cash, reputation, researchPoints, trends, competitors, staff, fans, feed: trimFeed(feed) };
}

function applyMarketEvent(s: GameState, ev: MarketEvent, week: number, rng: ReturnType<typeof rngFrom>): GameState {
  const applied = applyEventEffect(s, ev.effect, week, ev.title, ev.tone as FeedTone);
  const nextEventWeek = week + BALANCE.events.everyWeeks + rng.int(BALANCE.events.jitter);
  return { ...applied, nextEventWeek, lastEvent: { text: ev.title, tone: ev.tone as FeedTone, week }, rngState: rng.state() };
}

function pushRivalFeed(feed: FeedItem[], l: CompetitorLaunch, activePlayerCats?: ReadonlySet<CategoryId>) {
  const catName = CATEGORIES[l.category]?.displayName ?? l.category;
  const threat = activePlayerCats?.has(l.category);
  feed.push(
    feedItem(
      l.week,
      threat
        ? `${l.competitor} launched a new ${catName} — your active product faces new competition.`
        : `${l.competitor} entered the ${catName} market.`,
      threat ? "negative" : "neutral",
    ),
  );
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

  const totalWeeks = buildWeeksFor(state);
  const job: BuildJob = {
    product: { ...product, id: `prod-${state.productCounter}`, plannedUnits: units, channelId },
    totalWeeks,
    weeksElapsed: 0,
    plannedUnits: units,
    channelId,
  };
  const feed = [...state.feed];
  feed.push(
    feedItem(
      state.week,
      `Started a ${units.toLocaleString()}-unit run of “${product.name}” — ${format(plan.totalUpfront)} (${totalWeeks} wk).`,
      "accent",
    ),
  );
  return {
    state: {
      ...state,
      cash: sub(state.cash, plan.totalUpfront),
      building: [...state.building, job],
      productCounter: state.productCounter + 1,
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

  // B9 — apply seeded demand variance to the ACTUAL realized demand at launch. planProduction
  // gives the deterministic forecast the wizard showed; the real market lands within ±demandVariance
  // of it. This makes over/under-producing a true bet: a too-small run can leave demand unmet, a
  // too-large run can strand stock. Driven by the persisted RNG (deterministic per seed, NOT
  // Math.random) and we save the advanced rngState below so the outcome is reproducible.
  const rng = rngFrom(state);
  const rawVariance = demandVarianceMultiplier(rng);
  // demandSensing narrows variance by 35% (forecasts become more reliable)
  const variance = hasProject(state.completedProjects, "demandSensing")
    ? 1 + (rawVariance - 1) * 0.65
    : rawVariance;
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
  const hasCrisisComms = hasProject(state.completedProjects, "crisisComms");
  if (isHit) reputation = Math.min(rep.max, reputation + rep.gainPerHit * (qa ? 1.5 : 1));
  else if (isFlop) reputation = Math.max(rep.min, reputation - rep.lossPerFlop * (qa ? 0.6 : 1) * (hasCrisisComms ? 0.5 : 1));
  reputation = Math.min(rep.max, reputation + channel.reputation);
  if (hasProject(state.completedProjects, "pressKit")) reputation = Math.min(rep.max, reputation + 1);

  // Fanbase response — hits win fans (more for bigger sellers), flops lose them, sellouts add buzz.
  const fb = BALANCE.fans;
  let fans = state.fans;
  if (isHit) fans += fb.gainOnHitFlat + (totalUnits / 1000) * fb.gainPerHitUnitsK;
  else if (isFlop) fans = Math.max(0, fans - fb.lossPerFlop);
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
  const isSolid = !isHit && !isFlop && effectiveScore >= bands.solid;
  const moodSwing = isHit ? 12 : isFlop ? -12 : 3;
  const staff = state.staff.map((s) => ({ ...s, mood: clampMood(s.mood + moodSwing) }));

  // Record the verdict the player saw on the launched product, so the history screen can report it.
  lp.verdict = isHit ? "hit" : isFlop ? "flop" : isSolid ? "solid" : "steady";
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
  const verdict = isHit ? 'a hit' : isFlop ? 'a flop — out of step with what buyers wanted' : isSolid ? 'a solid performer' : 'a steady seller';
  feed.push(
    feedItem(
      state.week,
      `Launched “${product.name}” — ${verdict} (~${totalUnits.toLocaleString()} of ${plannedUnits.toLocaleString()} units forecast).${deltaStr}`,
      isHit ? 'positive' : isFlop ? 'negative' : isSolid ? 'positive' : 'accent',
    ),
  );
  if (sellsOut) {
    if (isFlop) {
      feed.push(feedItem(state.week, `”${product.name}” will sell out its small run — but the wider market wasn't won over. Tap it on Market for the full story.`, "accent"));
    } else {
      feed.push(feedItem(state.week, `”${product.name}” is selling out — demand outstrips your run.`, "positive"));
    }
  } else if (plannedUnits - totalUnits > plannedUnits * 0.35) {
    feed.push(feedItem(state.week, `Overproduced “${product.name}” — unsold stock is a write-off.`, "negative"));
  }
  for (const item of fanMilestones.feed) feed.push(item);

  return {
    state: {
      ...state,
      ready: state.ready.filter((p) => p.id !== productId),
      launched: [lp, ...state.launched],
      reputation,
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
  feed.push(feedItem(state.week, `Price cut on "${lp.product.name}" — ${format(lp.product.price)} → ${format(newPrice)}.`, "accent"));

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
  feed.push(feedItem(state.week, `Marketing push on "${lp.product.name}" — ${quote.addedUnits.toLocaleString()} more units in the pipeline.`, "accent"));

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
  const feedText = `${pc.event.title} — you chose: "${option.label}".`;
  const applied = applyEventEffect(state, option.effect, state.week, feedText, pc.event.tone as FeedTone);
  return {
    ...applied,
    pendingChoice: null,
    resolvedChoices: [...state.resolvedChoices, pc.event.id],
  };
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
  const iid = `f${state.furnitureCounter}`;
  const layout = addFurniture(state.layout, iid, type, c, r, rot);
  if (layout === state.layout) return state; // rejected (overlap / out of bounds)
  return { ...state, layout, furnitureCounter: state.furnitureCounter + 1 };
}
export function moveFurniture(state: GameState, iid: string, c: number, r: number): GameState {
  const layout = moveFurnitureOp(state.layout, iid, c, r);
  return layout === state.layout ? state : { ...state, layout };
}
export function rotateFurniture(state: GameState, iid: string): GameState {
  const layout = rotateFurnitureOp(state.layout, iid);
  return layout === state.layout ? state : { ...state, layout };
}
export function removeFurniture(state: GameState, iid: string): GameState {
  return { ...state, layout: removeFurnitureOp(state.layout, iid) };
}
export function resetFurniture(state: GameState): GameState {
  return { ...state, layout: defaultLayout() };
}
/** Replace the whole layout (used by Undo). */
export function setLayout(state: GameState, layout: PlacedItem[]): GameState {
  return { ...state, layout };
}
/** Drop a copy of an item into the nearest free cell. */
export function duplicateFurniture(state: GameState, iid: string): GameState {
  const it = state.layout.find((x) => x.iid === iid);
  if (!it) return state;
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [2, 0], [0, 2], [-2, 0]]) {
    const c = it.c + dc, r = it.r + dr;
    if (canPlace(state.layout, it.type, c, r, it.rot)) {
      const copy: PlacedItem = { ...it, iid: `f${state.furnitureCounter}`, c, r };
      return { ...state, layout: [...state.layout, copy], furnitureCounter: state.furnitureCounter + 1 };
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

/** Reassign a staff member to a different function. */
export function assignStaff(state: GameState, id: string, assignment: Assignment): GameState {
  return { ...state, staff: state.staff.map((s) => (s.id === id ? { ...s, assignment } : s)) };
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
      s.id === id ? { ...s, skill: s.skill + 1, salary: salaryFor(s.role, s.skill + 1) } : s,
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

export function hireCostFor(role: StaffRole, skill: number, discounted = false): Money {
  // One-time hiring fee = 3 weeks of salary (Talent Network cuts it 40%).
  const base = scale(salaryFor(role, skill), 3);
  return discounted ? scale(base, 0.6) : base;
}

const ROLE_ASSIGNMENT: Record<StaffRole, Assignment> = {
  engineer: "rnd",
  designer: "design",
  marketer: "marketing",
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
  feed.push(feedItem(state.week, `Hired ${name} — ${role}.`, "accent"));
  return {
    ...state,
    rngState: rng.state(),
    cash: sub(state.cash, fee),
    staff: [...state.staff, member],
    staffCounter: state.staffCounter + 1,
    feed: trimFeed(feed),
  };
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
  const feed = trimFeed([...state.feed, feedItem(state.week, `Signed ${cand.name} — ${cand.role}.`, "positive")]);
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

/** The company's live market valuation (grows with lifetime revenue + reputation; floored). */
export function companyValuation(state: GameState): Money {
  return add(BALANCE.ipo.baseValuation, ipoValuation(state)) as Money;
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
  feed.push(feedItem(state.week, `${state.companyName} IPO'd — raised ${format(raised)} for ${Math.round(pct * 100)}%.`, "positive"));
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

/**
 * Evaluate achievements against the current state and add any newly-satisfied ids to the unlocked
 * set (union — monotonic, never un-unlocks). PURE. Returns the same state object when nothing new
 * unlocked (referential stability), plus the list of ids that flipped this evaluation so the UI
 * layer can fire celebratory toasts for live-play unlocks only. Never mutates input.
 */
export function evaluateAndUnlock(state: GameState): { state: GameState; unlocked: string[] } {
  const prev = state.unlockedAchievements ?? [];
  const satisfied = evaluateAchievements(deriveFacts(state));
  const had = new Set(prev);
  const unlocked = satisfied.filter((id) => !had.has(id));
  if (unlocked.length === 0) return { state, unlocked: [] };
  return { state: { ...state, unlockedAchievements: [...prev, ...unlocked] }, unlocked };
}

export function advanceEraAction(state: GameState): GameState {
  if (!canAdvance(state)) return state;
  const era = state.era + 1;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Entered the ${eraName(era)}. New tech unlocked.`, "positive"));
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
