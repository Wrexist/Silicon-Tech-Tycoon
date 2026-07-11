// GameState + pure reducers. Composes the engine; owns NO React. Fully testable.
// The React hook (useGame) wraps these and drives the tick.
import { BALANCE } from "../engine/balance.ts";
import { CATEGORIES, tierDef } from "../engine/catalogs.ts";
import {
  advanceCompetitors,
  initCompetitors,
  rivalMarketCap,
  rivalStrengthsFor,
  rivalDef,
  spawnChallenger,
  RIVALS,
  type CompetitorLaunch,
  type RivalArcPhase,
} from "../engine/competitors.ts";
import { updateNemesis, nemesisLaunchEdge, nemesisTaunt, nemesisMilestone, heatTier, type Nemesis, type ClashSignal } from "../engine/nemesis.ts";
import { eurekaDue, generateEureka, resolveEurekaChase, insightProgress, type EurekaMoment } from "../engine/eureka.ts";
import { staffMomentDue, pickGrowthTarget, generateStaffMoment, mentorTeamXpMult, type StaffMoment } from "../engine/staffMoment.ts";
import { staffEventDue, pickLifeEventTarget, generateStaffEvent, type StaffLifeEvent, type StaffEventEffect } from "../engine/staffEvent.ts";
import { postLaunchDue, pickPostLaunchTarget, generatePostLaunchEvent, type PostLaunchEvent, type PostLaunchTarget, type PostLaunchEffect } from "../engine/postLaunchEvent.ts";
import { evolveSentiment, superfansFrom, sentimentDecayFactor, moodTier, MOOD_LABEL, communityMoment, communityAskDue, generateCommunityAsk, ASK_INFO, type CommunityFacts, type MoodTier, type CommunityAsk } from "../engine/community.ts";
import { nextExpectation, judgeQuarter, buybackOwnershipGain, buybackMomentumBump, type EarningsReport } from "../engine/shareholders.ts";
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
  staffBio,
  staffName,
  visionaryHype,
} from "../engine/staff.ts";
import { pickChoiceEvent, pickEvent, type ChoiceEvent, type ChoiceOption, type MarketEvent } from "../engine/events.ts";
import { chainById, pickChain, type EventChain } from "../engine/eventChains.ts";
import { pickPoachTarget } from "../engine/poaching.ts";
import { mentorshipXpMult } from "../engine/org.ts";
import { accrueLoans, creditLimit, loanRate, makeLoan, weeklyDebtService, type Loan } from "../engine/financing.ts";
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
  gte,
  scale,
  sub,
  toDollars,
  ZERO,
  type Money,
} from "../engine/money.ts";
import { archetypeBonus, buildCost, componentSynergy, computeStats, missingSlots, overallScore, tuningCostMultiplier } from "../engine/product.ts";
import { requiredKindsFor } from "../engine/assemblyLine.ts";
import { supplierLeadWeeks, supplierLoyaltyDiscount, supplierCrunchMult, supplierEthicsRepDelta, contractTerm, contractDiscount, supplierFor, DEFAULT_SUPPLIER_ID, type ContractTerm } from "../engine/suppliers.ts";
import { factoryToolingMult, factoryUnitMult, factorySpeedMult, factoryCapacityPerWeek, resolveCapacity, totalFactoryUpkeep, factoryFor, isFactoryUnlocked, type CapacityOutcome, type CapacityStrategy } from "../engine/factories.ts";
import type { FactoryId, SupplierId } from "../engine/types.ts";
import {
  BELT_COST, MACHINE_DEFS, MAX_EXPANSION, autoTidyFloor, demolitionRefund, floorWidth, lineCapacityMult, lineComplete, lineEfficiency, lineSpeedMult, lineUnitMult,
  machineCells, machineUpgradeCostAt, upgradeMachineAt, moveMachine as floorMoveMachine, placeBelt as floorPlaceBelt,
  placeMachine as floorPlaceMachine, removeAt as floorRemoveAt, starterFloor,
  type BeltDir, type FactoryFloor as FloorPlan, type MachineKind,
} from "../engine/factoryFloor.ts";
import {
  PROP_DEFS, placeProp as propsPlace, moveProp as propsMove, propCellSet, removePropAt as propsRemoveAt, propRefund,
  type PlacedProp, type PropKind,
} from "../engine/factoryProps.ts";
import { layoutApplyCost, MAX_LAYOUTS, type FactoryLayout } from "../engine/factoryLayout.ts";
import { judgeAwards, type AwardsCeremony } from "../engine/awards.ts";
import { SIDE_ORDER_BUILD_DELAY, SIDE_ORDER_CANCEL_PCT, generateSideOrder, sideOrderDue, sideOrderMissingKinds, sideOrderPayout, type ActiveSideOrder, type SideOrderOffer } from "../engine/sideOrders.ts";
import { CONTRACT_BOARD_SIZE, contractDone, generateContract, rewardSummary, type Contract, type ContractFacts } from "../engine/contracts.ts";
import { segmentDemand, tuningSegmentBias, type SegmentDemand } from "../engine/segments.ts";
import { REGIONS, regionById, regionReach } from "../engine/regions.ts";
import { regionalEventDue, generateRegionalEvent, REGIONAL_EVENT_COPY, type RegionalEvent } from "../engine/regionalEvents.ts";
import { generateRivalProduct, type RivalRelease } from "../engine/rivalAI.ts";
import { forecastConfidence, forecastBand } from "../engine/forecast.ts";
import { noveltyFor } from "../engine/novelty.ts";
import { styleAppeal } from "../engine/aesthetics.ts";
import { brandEquity, franchiseStem, equityPreorderBonus, equityHypeBonus, type BrandEquity } from "../engine/franchise.ts";
import { distributeOverCurve, forecast, verdictCurveShape } from "../engine/salesCurve.ts";
import { buyCost, holdingsValue, sellProceeds, weeklyDividends, type Holdings } from "../engine/stocks.ts";
import { makeRng, type Rng } from "../engine/rng.ts";
import { canEarnStars, deriveScenarioFacts, evaluateScenario, metricValue, scenarioById, type ScenarioResult, type ScenarioMetric } from "../engine/scenarios.ts";
import { dailyChallenge, weeklyChallenge, type Challenge, type ChallengeKind } from "../engine/challenges.ts";
import { appsPublishedPerWeek, canInstallOsFeature, canReleaseVersion, clampSecurity, installedBase, licenseeMood, licenseeStrengthUplift, netExposure, osEcosystemBonus, osFeatureById, osFeatureRows, osReleaseReward, osServicesMultiplier, osTier, patchCooldownLeft, philosophyServicesMult, philosophyStatBonus, rivalLicenseFee, storeCommission, threatRisePerWeek, updateLicenseeRelations, type OsFeatureRow, type OsTierInfo } from "../engine/platform.ts";
import { generateLicenseOffer, licenseOfferDue, negotiateLicenseOffer as resolveNegotiation, type LicenseOffer, type LicenseSuitor, type NegotiationOutcome } from "../engine/licenseOffers.ts";
import { perkBonuses } from "../engine/perks.ts";
import type {
  Assignment,
  BuildJob,
  Candidate,
  CategoryId,
  ComponentKind,
  ConsumerTrends,
  CompetitorState,
  LaunchInsight,
  LaunchedProduct,
  Product,
  Recruitment,
  RecruitTier,
  RegionId,
  Staff,
  StaffRole,
  Stats,
} from "../engine/types.ts";
import { FINISH_ORDER, STAT_KEYS } from "../engine/types.ts";
import { STAT_INFO } from "../engine/glossary.ts";
import { climateNarration } from "../engine/climate.ts";
import { criticReviews, foldOutletThreads, type OutletThreads } from "../engine/reviews.ts";

export const SAVE_VERSION = 1;

export type FeedTone = "neutral" | "positive" | "negative" | "accent";
export interface FeedItem {
  id: string;
  week: number;
  text: string;
  tone: FeedTone;
}

/** The data a Rival Strike interrupt needs — snapshotted at the moment a contested rival launch
 *  dented the player's active product (see advanceOneWeek). The rival's rendered device can be
 *  recovered from state.rivalReleases via (rivalId, week) for the card. */
export interface RivalStrike {
  week: number;
  rivalId: string;
  rivalName: string;
  rivalProductName: string;
  rivalOverall: number;
  category: CategoryId;
  /** The player's contested product (the newest active one in the category at strike time). */
  productId: string;
  productName: string;
  playerOverall: number;
}

/** A research waiting in the queue (paid up front, develops once it reaches the front). Same shape as
 *  ActiveResearch without the timing, which is stamped when it becomes active. */
export type QueuedResearch = Omit<ActiveResearch, "startWeek">;

/** A research the lab is developing over time (the timed-research slot). Paid up front at start; the
 *  unlock is applied when `week - startWeek >= totalWeeks`. */
export interface ActiveResearch {
  /** A component-line tier, or a company project. */
  kind: "tier" | "project";
  /** The ComponentKind (tier) or ProjectId (project) being researched. */
  ref: string;
  /** For a tier: the level being unlocked (applied on completion). */
  tierLevel?: number;
  /** Display name + one-line of what it does. */
  name: string;
  blurb: string;
  /** RP paid up front (refunded on cancel; shown on the ring). */
  rpCost: number;
  /** Week the research started, and how many weeks it takes — drive the progress ring + "X wk left". */
  startWeek: number;
  totalWeeks: number;
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
  /** Living community MOOD (−1..+1). Evolves from how you treat your fans; modulates retention. Only
   *  moves once you've shipped, so a fresh/never-launched game (and the pinned sim) stays at 0. */
  fanSentiment?: number;
  /** The loyal core sentiment creates — they pre-order hardest. 0 until the community warms up. */
  superfans?: number;
  /** Company-wide brand awareness (0..BALANCE.brand.cap). Fed by cash investment, decays weekly, and
   *  contributes a bounded lift to every launch's hype. 0 until you invest → sim-safe. */
  brandAwareness?: number;
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
  /** The research the lab is currently developing (a timed tier/project). One at a time; the RP is
   *  paid at start and the unlock lands after `totalWeeks`. Optional/null → idle lab + golden-invariant
   *  safe (the pinned solo sim never starts one). */
  activeResearch?: ActiveResearch | null;
  /** Researches lined up behind the active one (paid up front; each auto-starts when it reaches the
   *  front). A component line / project can be active OR queued at most once. Optional/[] → empty. */
  researchQueue?: QueuedResearch[];
  /** Geographic markets unlocked for distribution (engine/regions.ts). Always contains "home". */
  unlockedRegions: RegionId[];
  /** Per-region LOYALTY (a signed standing that lifts/dents that region's reach), moved by regional
   *  events. Home is never keyed. Optional/empty → every region is neutral → golden-invariant safe. */
  regionLoyalty?: Partial<Record<RegionId, number>>;
  /** Owned manufacturing lines the player has acquired (engine/factories.ts). Each carries weekly
   *  upkeep and can be selected for builds. Empty for contract-only companies / older saves. */
  ownedFactories: FactoryId[];
  /** Builds run through each supplier — the relationship/loyalty count that earns a standing unit-
   *  cost discount (engine/suppliers.ts). Optional; absent/0 = no relationship yet. */
  supplierLoyalty?: Partial<Record<SupplierId, number>>;
  /** Active fixed-price contracts per supplier: a locked discount + crunch immunity for `weeksLeft`
   *  weeks (engine/suppliers.ts). Optional; absent = spot pricing. */
  supplierContracts?: Partial<Record<SupplierId, { discount: number; weeksLeft: number }>>;
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
  /** Player-built Factory Mode layout (machines + directed conveyor tiles). */
  factoryFloor: FloorPlan;
  /** Factory building decor — indices into the wall-paint / floor-finish palettes (customisable). */
  factoryDecor: { wall: number; floor: number };
  /** Decorative props placed on the factory floor (cosmetic; inert to the sim). */
  factoryProps: PlacedProp[];
  /** How many floor expansions the player has bought (0..MAX_EXPANSION) — widens the build grid. */
  factoryExpansion: number;
  /** Named factory-layout snapshots the player has saved, to switch between floor designs. */
  factoryLayouts: FactoryLayout[];
  /** Monotonic id source for saved layouts — never derived from array length (delete+re-save would
   *  otherwise reuse an id and collide). */
  factoryLayoutCounter: number;
  /** Monotonic id source for floor machines AND props — same rule: demolish + re-buy in one week
   *  must never mint a duplicate id (moveMachine and React keys both key on it). */
  factoryPieceCounter: number;
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
  /** Rolling "expectations" baseline — a decayed average of recent competition-adjusted launch scores.
   *  A hit must BEAT this (not just clear the static era bar), so a proven studio can't farm hits by
   *  re-shipping the same maxed spec: the bar rises with your own track record. 0/undefined on a new
   *  company → the static era bars apply, so early launches (and the pinned sim's opener) are unchanged. */
  launchExpectation?: number;
  /** Running per-outlet critic stance (item 2.6): warm/cold streaks keyed by outlet name, folded from
   *  each launch's (deterministic) reviews. Drives the "this outlet keeps panning you" feed threads.
   *  Optional/backfilled → `{}` on old saves; feed-text only, so it never touches balance. */
  reviewThreads?: OutletThreads;
  /** Recent company-valuation samples for the sparkline (newest last). Optional on old saves. */
  valuationHistory?: number[];
  /** An in-progress cascading event chain (Track B): which chain, the next beat to fire, and when.
   *  null/undefined when no chain is running. Optional on old saves. */
  eventChain?: { id: string; step: number; nextWeek: number } | null;
  holdings: Holdings; // shares owned in rival companies, by id
  /** Best (lowest) industry-leaderboard rank ever reached (1 = biggest company in the industry).
   *  Starts at RIVALS.length + 1 (a fresh garage is dead last behind every public rival); each time
   *  the player climbs to a new best, the tick celebrates overtaking the rival(s) they passed.
   *  Monotonic downward. */
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
  /** A rival launched INTO a category where the player is actively selling — the moment the entry
   *  haircut landed. Raised as a respond-or-hold interrupt (RivalStrike card); resolved via
   *  resolveStrike, always player-opt-in so the pinned sim (which never answers) is untouched.
   *  Optional/null → golden-invariant safe. */
  pendingStrike?: RivalStrike | null;
  /** Week of the last strike interrupt — enforces the cooldown so strikes stay events, not nags. */
  lastStrikeWeek?: number;
  /** The arch-rival: one rival elevated to YOUR nemesis, with a living heat meter + head-to-head
   *  record that escalates on every clash. Forms only when the player clashes (overtake / struck /
   *  awards duel), so the pinned auto-player never forms one → optional/null keeps it byte-identical. */
  nemesis?: Nemesis | null;
  /** A just-declared rivalry waiting for its reveal moment (set the week a nemesis forms, cleared by
   *  the player via dismissRivalry). Optional/null → golden-invariant safe. */
  pendingRivalry?: { rivalId: string; rivalName: string; doctrine: string } | null;
  /** An R&D "eureka" breakthrough on the table — bank a guaranteed RP windfall or chase a prototype
   *  gamble (resolveEureka). Fires only for an active, funded lab; the pinned solo sim never has one. */
  pendingEureka?: EurekaMoment | null;
  /** Week of the last eureka breakthrough — enforces the cooldown + drives the Insight meter. */
  lastEurekaWeek?: number;
  /** A community "ask" on the table — the fans want an AMA / beta / merch / meetup; answer it for cash
   *  to grow + delight the base, or pass (resolveCommunityAsk). Fires only once you've launched; the
   *  pinned solo sim never has one. Optional/null → golden-invariant safe. */
  pendingCommunityAsk?: CommunityAsk | null;
  /** Week of the last community ask — enforces the cooldown between asks. */
  lastCommunityAskWeek?: number;
  /** A staff GROWTH moment on the table — a senior, tenured staffer earns a permanent character
   *  upgrade the player picks (resolveStaffMoment). Fires only for an established team; the pinned
   *  solo sim is founder-only and never raises one. Optional/null → golden-invariant safe. */
  pendingStaffMoment?: StaffMoment | null;
  /** Week of the last staff growth moment — enforces the cooldown between them. */
  lastStaffMomentWeek?: number;
  /** A staff LIFE event on the table (item 2.2) — a named teammate's burnout / outside offer /
   *  milestone the player answers (resolveStaffEvent). Fires only for an established team; the pinned
   *  solo sim never raises one. Optional/null → golden-invariant safe. */
  pendingStaffEvent?: StaffLifeEvent | null;
  /** Week of the last staff life event — enforces the cooldown between them. */
  lastStaffEventWeek?: number;
  /** A post-launch reactive event on the table (item 3.6) — a product already selling hits a
   *  mid-lifecycle moment (hot seller / stalling / supply pinch) the player answers
   *  (resolvePostLaunch). Fires only past the garage era on a live product; the pinned solo sim
   *  raises none. Optional/null → golden-invariant safe. */
  pendingPostLaunch?: PostLaunchEvent | null;
  /** Week of the last post-launch event — enforces the cooldown between them. */
  lastPostLaunchWeek?: number;
  /** A regional event on the table — an expansion market's boom / tariff / rival surge to respond to
   *  (resolveRegionalEvent). Fires only once you've expanded past Home; the pinned solo sim never
   *  does. Optional/null → golden-invariant safe. */
  pendingRegionalEvent?: RegionalEvent | null;
  /** Week of the last regional event — enforces the cooldown between them. */
  lastRegionalEventWeek?: number;
  /** Week the last OPPORTUNISTIC full-screen interrupt fired (strike / eureka / community / earnings /
   *  rivalry / regional / staff moment). One shared stamp enforces a minimum quiet gap between any two
   *  so modals never cluster (BALANCE.interrupts.minGapWeeks). Optional → old saves + the pinned solo
   *  sim (which raises none) default to -999, so the gate is a pure no-op there → byte-identical. */
  lastInterruptWeek?: number;
  // --- Post-IPO shareholder loop (all optional/null → golden-invariant safe; only live once listed) ---
  /** A quarterly earnings result waiting to be shown — beat/miss vs the street + the share-price move. */
  pendingEarnings?: EarningsReport | null;
  /** The revenue the street expects THIS quarter. */
  earningsExpectation?: Money;
  /** cumulativeRevenue at the start of the current quarter (to measure the quarter's revenue). */
  quarterStartRevenue?: Money;
  /** Week of the last earnings call (= the listing week initially); paces the quarterly cadence. */
  lastEarningsWeek?: number;
  /** 1-based count of earnings calls delivered since listing. */
  earningsQuarter?: number;
  /** The Silicon Awards ceremony waiting to be shown (week 52, 104, …). Set by the tick as a pure
   *  derivation (no RNG, no economy change); rep/fan rewards land only via the player-opt-in
   *  collectAwards. Optional/null → golden-invariant safe. */
  pendingAwards?: AwardsCeremony | null;
  /** Every past ceremony, newest first — the trophy record. Optional → old saves load empty. */
  awardsHistory?: AwardsCeremony[];
  /** A client commission ON OFFER (expires in ~2 weeks). Accepting moves it to activeSideOrder.
   *  Deterministic offer stream (derived hash, no sim RNG); optional/null → golden-invariant safe. */
  pendingSideOrder?: SideOrderOffer | null;
  /** The commission currently RUNNING on the factory line: your own builds take +1 week while it
   *  does, and the payout lands on completion. Only ever set by the player accepting. */
  activeSideOrder?: ActiveSideOrder | null;
  /** Lifetime completed commissions — flavor + a future achievement hook. */
  sideOrdersCompleted?: number;
  /** Item 3.5 — completed commissions PER client, keyed by client name. Drives the returning-client
   *  loyalty premium on the completion bonus. Optional/backfilled → `{}`; only ever grows when the
   *  player completes an (opt-in) order, so the pinned sim never touches it → byte-identical. */
  sideOrderClients?: Record<string, number>;
  /** Rolling contract board (engine/contracts.ts) — 2–3 live directed goals that regenerate on claim
   *  or expiry, giving the post-tutorial/endgame a chase. Empty until the first ship; the reward is
   *  player-CLAIMED, so the pinned sim (which ships nothing) is byte-identical. Optional → old saves
   *  default to an empty board on migrate. `contractCounter` is the monotonic salt for deterministic
   *  generation (like candidateCounter). */
  contracts?: Contract[];
  contractsCompleted?: number;
  contractCounter?: number;
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
  /** Inbound OS licensing offer currently on the table (a company wants to ship your OS), or null.
   *  Deterministic stream; signing pays a big upfront bonus + adds them as a licensee. */
  pendingLicenseOffer?: LicenseOffer | null;
  /** Licensees who signed an EXCLUSIVE deal: rivalId → the category they locked. Exclusive partners
   *  pay a richer royalty and no other suitor can license that category while it's held. */
  osExclusive?: Record<string, string>;
  /** Living App Store — cumulative apps published to your platform. Dormant until the App Marketplace
   *  module ships, then grows with installed base + OS version; you take a weekly commission on it.
   *  Optional/backfilled → 0 in old saves and in the base game (gated behind platformUnlocked). */
  osApps?: number;
  /** Security tug-of-war — current THREAT pressure (0..100). Creeps up each live week; cleared by
   *  shipping a security patch or a full OS release. Undefined/0 until the division is live. */
  osThreat?: number;
  /** Security tug-of-war — current SECURITY hardening rating (0..100). Built by shipping patches/
   *  releases; decays slowly. Net exposure (threat − security) drags reputation when it runs high. */
  osSecurity?: number;
  /** Week the last security patch shipped, for the patch cooldown (the immersive "update" button). */
  lastPatchWeek?: number;
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
  /** Installed base (customers) absorbed from acquired rivals — a permanent services annuity feeding
   *  weekly ecosystem revenue (see absorbedServicesRevenue). 0 until the first acquisition; old saves
   *  default to 0 on migrate. */
  absorbedBase: number;
  /** Epic E delegation toggles. Each automates an action the player can already do, gated behind a
   *  premium research division + a recruited specialist (whose salary is the standing weekly cost).
   *  The `*Free` flags grandfather saves that already had an automation ON before the gating shipped,
   *  so they keep working without the new prerequisites. Persisted per save. */
  automation: { autoAssign: boolean; autoResearch: boolean; autoAssignFree?: boolean; autoResearchFree?: boolean };
}

/** Cap on the rolling Rival Releases list (newest first). Bounds save size + the UI gallery.
 *  Sized to comfortably span a full 52-week award year (rivals launch ~40×/year across the roster)
 *  so the annual Silicon Awards judge every rival release from the year, not just the newest 24.
 *  The Market gallery slices this to 6 for display, so the larger retention costs nothing on screen. */
export const RIVAL_RELEASES_CAP = 52;

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
// Employee names now come from staffName() (full first+last, item 2.1); the old 16-name first-only
// pool was removed to stop routine duplicate hires.
// Applicant name pool for recruitment (no real people / brands).

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
    fanSentiment: 0,
    superfans: 0,
    brandAwareness: 0,
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
    activeResearch: null,
    researchQueue: [],
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
    factoryFloor: starterFloor(),
    factoryDecor: { wall: 0, floor: 0 },
    factoryProps: [],
    factoryExpansion: 0,
    factoryLayouts: [],
    factoryLayoutCounter: 0,
    factoryPieceCounter: 0,
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
    launchExpectation: 0,
    reviewThreads: {},
    valuationHistory: [],
    eventChain: null,
    holdings: {},
    bestIndustryRank: RIVALS.length + 1, // a fresh garage is dead last behind the public rivals
    unlockedAchievements: [],
    completedObjectives: [],
    pendingChoice: null,
    pendingPoach: null,
    pendingStrike: null,
    lastStrikeWeek: -999,
    nemesis: null,
    pendingRivalry: null,
    pendingEureka: null,
    lastEurekaWeek: -999,
    pendingCommunityAsk: null,
    lastCommunityAskWeek: -999,
    pendingStaffMoment: null,
    lastStaffMomentWeek: -999,
    pendingStaffEvent: null,
    lastStaffEventWeek: -999,
    pendingPostLaunch: null,
    lastPostLaunchWeek: -999,
    regionLoyalty: {},
    pendingRegionalEvent: null,
    lastRegionalEventWeek: -999,
    lastInterruptWeek: -999,
    pendingEarnings: null,
    earningsExpectation: ZERO,
    quarterStartRevenue: ZERO,
    lastEarningsWeek: -999,
    earningsQuarter: 0,
    pendingAwards: null,
    awardsHistory: [],
    pendingSideOrder: null,
    activeSideOrder: null,
    sideOrderClients: {},
    sideOrdersCompleted: 0,
    contracts: [],
    contractsCompleted: 0,
    contractCounter: 0,
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
    pendingLicenseOffer: null,
    osExclusive: {},
    osApps: 0,
    osThreat: 0,
    osSecurity: 0,
    rivalReleases: [],
    rivalLineCounters: {},
    acquiredRivals: [],
    absorbedBase: 0,
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
export function newScenarioGame(scenarioId: string, seed = (Math.random() * 2 ** 31) >>> 0, legacy = 0, name?: string): GameState {
  const base = newGame(seed, legacy);
  // Carry the founder's chosen company name (from onboarding) into the scenario run; blank → default.
  const named = name?.trim() ? { ...base, companyName: name.trim() } : base;
  const scn = scenarioById(scenarioId);
  if (!scn) return named;
  const { era, cash, reputation, fans } = scn.setup;
  const startCash = cash ?? base.cash;
  return {
    ...named,
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
/** Total weekly cash OUTFLOW = operating burn + loan debt service. Display/solvency only (runway,
 *  "cash running low"); the tick deducts burn and loan payments separately, so it must NOT use this. */
export const weeklyOutflow = (s: GameState): Money =>
  add(burn(s), cents(weeklyDebtService(s.loans ?? []))) as Money;
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
const rpGlobalMult = (s: GameState) => rpMultiplier(s.upgrades) * officeFocusMult(s) * (1 + perkBonuses(s.legacy).rpMult);

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
  (hasProject(s.completedProjects, "neuralMarketing") ? 0.25 : 0) +
  (hasProject(s.completedProjects, "gtmHype") ? 0.30 : 0) + // Go-to-Market doctrine: Hype House
  visionaryHype(s.staff) + marketingHype(s.upgrades) + perkBonuses(s.legacy).hype + brandAwarenessHype(s);

/** The bounded launch-hype contribution from the company's brand-awareness meter. 0 when the meter is
 *  0 (absent) → folds into hypeBonus with no effect until the player invests, so the pinned sim stays
 *  byte-identical. Reaches both the real launch and the live preview through hypeBonus. */
export const brandAwarenessHype = (s: GameState): number =>
  (Math.max(0, Math.min(BALANCE.brand.cap, s.brandAwareness ?? 0)) / BALANCE.brand.cap) * BALANCE.brand.hypeMax;

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
  if (hasProject(s.completedProjects, "aiCopilot")) bonus.ecosystem = (bonus.ecosystem ?? 0) + 4;
  // Engineering Doctrine fork (Track D): the chosen house stamps a permanent stat identity on every
  // product. Mutually exclusive, so at most one of these ever applies.
  if (hasProject(s.completedProjects, "perfHouse")) bonus.performance = (bonus.performance ?? 0) + 5;
  if (hasProject(s.completedProjects, "effHouse")) bonus.battery = (bonus.battery ?? 0) + 5;
  if (hasProject(s.completedProjects, "qualityHouse")) bonus.quality = (bonus.quality ?? 0) + 5;
  if (hasProject(s.completedProjects, "gtmDesign")) bonus.design = (bonus.design ?? 0) + 6; // GTM doctrine: Design House
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
function desktopCost(owned: number): Money | null {
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
const projectBuildFast = (s: GameState) => hasProject(s.completedProjects, "assemblyLine");
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
  // The player-built floor layers on top as a pure BONUS (lineSpeedMult is clamped ≤1; an unwired
  // or bare floor is exactly neutral). Topology is product-aware — a phone wants a screen bonder,
  // a laptop a mill — and the bonus BANKS its fractional week (floor, not round): early builds are
  // only ~3 weeks, and round(3 × 0.95) = 3 would make the first wired line feel like a scam.
  const reqKinds = product ? requiredKindsFor(product.category) : undefined;
  const lineMult = lineSpeedMult(s.factoryFloor, reqKinds);
  const contract = Math.round((buildWeeks(rndSkill(s), projectBuildFast(s)) - buildWeekReduction(s.upgrades)) * (product ? factorySpeedMult(product) : 1));
  const assembly = (lineMult < 1 ? Math.max(1, Math.floor(contract * lineMult)) : contract)
    - (hasProject(s.completedProjects, "quickPrototype") ? 1 : 0)
    - (hasProject(s.completedProjects, "lightsOut") ? 1 : 0)
    - (hasProject(s.completedProjects, "opsSpeed") ? 1 : 0); // Operations doctrine: Speed House
  // Living Late Game: late eras add manufacturing lead time (eraModifier.leadWeeks; 0 in eras 1–2),
  // so the endgame ships fewer, weightier products instead of a near-continuous relaunch conveyor.
  const eraLead = eraModifier(s.era).leadWeeks;
  // A client commission occupies the floor: your own runs queue behind it (+1 wk). Opt-in only —
  // the pinned sim never accepts an order, so the baseline build time is untouched.
  const orderDelay = s.activeSideOrder ? SIDE_ORDER_BUILD_DELAY : 0;
  return Math.max(BALANCE.build.minWeeks, assembly) + lead + eraLead + orderDelay;
};

/** Resolve a run against its factory's capacity + the product's capacity strategy (overtime / stretch
 *  / defects). Shared by planProduction (cost + weeks) and the build wizard (the prospective quality
 *  hit it bakes onto the product). `assemblyWeeks` is the pre-stretch build time. */
/** The factory's weekly throughput after the player-built line's capacity bonus (item 3.1). Applied
 *  to the base factory ceiling; ×1 for an unwired floor (Infinity stays Infinity → no-op), so the
 *  baseline and pinned sim are byte-identical. */
export function effectiveCapacityPerWeek(s: GameState, product: Product): number {
  return factoryCapacityPerWeek(product) * lineCapacityMult(s.factoryFloor);
}

export function capacityPlan(s: GameState, product: Product, plannedUnits: number): CapacityOutcome {
  return resolveCapacity({
    plannedUnits: Math.max(0, Math.round(plannedUnits)),
    capacityPerWeek: effectiveCapacityPerWeek(s, product),
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
  if (hasProject(s.completedProjects, "predictiveSupply")) unitCost = scale(unitCost, 0.90);
  if (hasProject(s.completedProjects, "opsCost")) unitCost = scale(unitCost, 0.82); // Operations doctrine: Cost House
  unitCost = scale(unitCost, 1 - perkBonuses(s.legacy).buildCostMult);
  unitCost = scale(unitCost, factoryUnitMult(product)); // factory assembly cost (standard = ×1)
  // Player-built line automation (item 3.1): a complete floor trims per-unit cost, clamped ≤1 so an
  // unwired/bare floor is exactly ×1 (baseline + pinned sim byte-identical). Pure upside.
  unitCost = scale(unitCost, lineUnitMult(s.factoryFloor));
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
  if (hasProject(s.completedProjects, "opsReach")) marketSize *= 1.25; // Operations doctrine: Reach House
  // Era-scaled volume — small early market (slow garage phase), grows each era.
  const eraScales = BALANCE.market.eraVolumeScale;
  marketSize *= eraScales[Math.max(0, Math.min(s.era - 1, eraScales.length - 1))];
  // Global expansion (engine/regions.ts): scale the addressable market by the regions this product
  // ships to. Home-only is exactly ×1.0, so this never changes a domestic launch or an old save.
  marketSize *= regionReach(s.unlockedRegions, product.regions, stats, s.week, s.regionLoyalty);

  // Epic A — segmented demand. The market is split into buyer segments (engine/segments.ts), each
  // weighting the five stats AND price differently; the product wins a share of each, summed. This
  // replaces the single global demandScore/priceFit with a positioning decision ("who is this for?").
  // A balanced product scores ≈ the old single-trend demand (the segment sizes average back to it),
  // so the macro-economy is preserved; lopsided products diverge — that divergence IS the new depth.
  // G1 — the device's form (styleAppeal) lifts the Style segment, so the parametric render is a lever.
  // Item 1.3 — the launch campaign TARGETS buyer segments: the chosen channel redistributes demand
  // toward the buyers it reaches (Search → Pro/Enterprise, Influencer → Style, …). Renormalised in
  // segmentDemand, so it's positioning, not extra volume. "none" → no bias (unchanged).
  const segments = segmentDemand(stats, product.price, s.trends, product.category, styleAppeal(product), s.week, channel.segmentBias, tuningSegmentBias(product.tuning));

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
    // Bound the PASSIVE hype bonus (studio + visionary marketers + marketing upgrade + brand equity)
    // before it reaches scoreLaunch, which also clamps it. Without this, stacking many visionary
    // marketers makes launchScore/volume explode. Safety guard. The chosen launch CAMPAIGN is passed
    // SEPARATELY (campaignHype) so it lands on TOP of this clamp — a bigger campaign always lifts the
    // launch instead of being absorbed once the company's passive hype maxes out (the "every tier
    // shows the same units" bug in a mature company).
    hypeBonus: Math.max(0, Math.min(HYPE_BONUS_MAX, hypeBonus(s) * mktMult + equityHypeBonus(brand.equity))),
    campaignHype: Math.max(0, channel.hype) * mktMult,
    // Component-combination synergy: a glaring weak link drags the launch down; a coherent build
    // is rewarded — so designing the right MIX of components matters, not just maxing each slot.
    synergy: componentSynergy(product).factor,
    // Drive demand + price reaction from the segment model (the two aggregates are on the same
    // 0..100 / 0..maxFit scales as the originals they replace).
    demandOverride: segments.demandIndex,
    priceFitOverride: segments.effectivePriceFit,
  });

  const overall = overallScore(stats, product.category);
  // Licensees of your OS compete harder in shared categories (the Phase-C trade-off for their fee).
  const rivals = rivalStrengthsFor(s.competitors, product.category, { licenseeIds: s.osLicensees, uplift: licenseeStrengthUplift() });
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
  // A proven line's loyal followers pre-order more strongly (brand equity → preorder lift). Superfans
  // (the community's loyal core) pre-order harder still — added as extra fan-equivalents on top of the
  // base, so a game with no superfans (and the pinned sim) is byte-identical.
  const superfans = s.superfans ?? 0;
  const fanBase = s.fans + superfans * (BALANCE.fans.community.superfanPreorderMult - 1);
  const rawPreOrders = Math.round(fanBase * BALANCE.fans.preOrderConversion * (demandFit / 100) * (1 + equityPreorderBonus(brand.equity)));
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
  const capacityPerWeek = effectiveCapacityPerWeek(s, product);
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
function affordableRun(s: GameState, product: Product, channelId: ChannelId = "none"): number {
  const probe = planProduction(s, product, BALANCE.build.minRun, channelId);
  const reserve = buildSafetyReserve(s, product);
  // Cash left for tooling+units after holding back the reserve, then after paying fixed costs
  // (tooling + channel) the rest funds units.
  const spendable = sub(sub(s.cash, reserve), add(probe.tooling, probe.channelCost));
  if (toDollars(probe.unitCost) <= 0) return BALANCE.build.maxRun;
  let units = Math.floor(toDollars(spendable) / toDollars(probe.unitCost));
  // The linear estimate above ignores overtime, which a capacity-limited line adds on top. Shrink
  // until the REAL plan (incl. overtime) fits within the reserve. Converges in a few steps and is a
  // no-op for unlimited-capacity (standard) factories, where overtime is always 0.
  const avail = toDollars(sub(s.cash, reserve));
  for (let i = 0; i < 6 && units > 0; i++) {
    const real = planProduction(s, product, units, channelId);
    if (toDollars(real.totalUpfront) <= avail) break;
    const over = toDollars(real.totalUpfront) - avail;
    units -= Math.max(1, Math.ceil(over / toDollars(probe.unitCost)));
  }
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

/** Weekly App Store commission — a bounded cut of your published catalogue (0 unless the Platform
 *  division is unlocked). Grows as developers publish to the store (see the tick's App Store block). */
export function weeklyStoreCommission(s: GameState): Money {
  return s.platformUnlocked ? storeCommission(s.osApps ?? 0) : ZERO;
}

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
  // Plus the annuity from any absorbed installed base (0 until the first buyout) and the App Store
  // commission (0 until the store is live) — the full recurring platform economy in one figure.
  return add(cents(Math.round(acc * osServicesMult(s))), add(absorbedServicesRevenue(s), weeklyStoreCommission(s)));
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

/** Read-only facts the contract board evaluates against, derived from the full state. Pure adapter
 *  (money in DOLLARS). Exported so the UI can compute per-contract progress from the same source. */
export function contractFacts(s: GameState): ContractFacts {
  return {
    revenue: toDollars(s.cumulativeRevenue),
    fans: s.fans,
    ships: s.launched.length,
    hits: s.launched.filter((lp) => lp.verdict === "hit").length,
    rank: industryRank(s),
    week: s.week,
  };
}

/** Claim a completed contract's reward (cash/rep/fans); its board slot refills on the next tick.
 *  Opt-in — the pinned auto-player never claims, so the baseline economy is untouched. */
export function claimContract(state: GameState, id: string): ActionResult {
  const c = (state.contracts ?? []).find((x) => x.id === id);
  if (!c) return { state, ok: false, reason: "No such contract." };
  if (!contractDone(c, contractFacts(state))) return { state, ok: false, reason: "This contract isn't complete yet." };
  const feed = [...state.feed, feedItem(state.week, `Contract complete — “${c.title}”. ${rewardSummary(c.reward)}.`, "positive")];
  return {
    state: {
      ...state,
      cash: add(state.cash, c.reward.cash),
      reputation: Math.min(BALANCE.reputation.max, state.reputation + c.reward.rep),
      fans: state.fans + c.reward.fans,
      contracts: (state.contracts ?? []).filter((x) => x.id !== id),
      contractsCompleted: (state.contractsCompleted ?? 0) + 1,
      feed: trimFeed(feed),
    },
    ok: true,
  };
}

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
  let trendBeat: FeedItem | undefined;
  if (week >= state.trendRetargetWeek) {
    newTarget = randomTrendTarget(rng);
    trendRetargetWeek =
      week +
      BALANCE.market.trendDrift.retargetEveryWeeks +
      rng.int(BALANCE.market.trendDrift.retargetJitter);
    // Narrate the biggest riser so a retarget is felt, not silent: which stat the market is now
    // leaning into, vs. the outgoing target. Pure/derived → identical across a replay.
    const prevTarget = state.trends.targetWeights;
    let topStat = STAT_KEYS[0];
    let topDelta = -Infinity;
    for (const k of STAT_KEYS) {
      const d = newTarget[k] - prevTarget[k];
      if (d > topDelta) { topDelta = d; topStat = k; }
    }
    if (topDelta > 0.045) {
      trendBeat = feedItem(week, `The market is warming to ${STAT_INFO[topStat].prose} — buyers are starting to want more of it.`, "accent");
    }
  }
  trends = advanceTrends(trends, newTarget);

  // Climate narration (Track B): a segment cresting or a region tipping in/out of a downturn. Pure,
  // derived from week + unlocked regions — no RNG, so run1 === run2 holds.
  const climateBeat = climateNarration(week, state.unlockedRegions);

  // Competitors — pass the player's recent hit categories so the lead rival can react.
  const hitWindow = BALANCE.competitors.reactHitWindowWeeks;
  const recentPlayerHitCats = state.launched
    .filter((lp) => lp.launchedWeek >= week - hitWindow && (lp.verdict === "hit" || lp.verdict === "solid"))
    .map((lp) => lp.product.category);
  // The arch-rival hunts your turf: its heat-scaled launch edge (undefined unless a nemesis exists, so
  // the pinned sim never passes it → byte-identical). Reads last week's nemesis; topCat = your line.
  const nem = state.nemesis ?? null;
  const nemEdgeRaw = nem ? nemesisLaunchEdge(nem, nem.rivalId) : null;
  const nemEdge = nem && nemEdgeRaw ? { rivalId: nem.rivalId, topCat: playerTopCategory(state), ...nemEdgeRaw } : undefined;
  const { competitors: competitorsBase, launches, arcBeats } = advanceCompetitors(state.competitors, week, state.era, rng, recentPlayerHitCats, nemEdge, state.seed);
  // `let` so B3 can append a fresh challenger that rises to refill a field thinned by acquisitions.
  let competitors = competitorsBase;

  // Sales + revenue
  let cash = state.cash;
  let cumulativeRevenue = state.cumulativeRevenue;
  const productsFeed: FeedItem[] = [];
  const launched = state.launched.map((lp) => {
    if (lp.weeksElapsed >= lp.weeklyUnits.length) return lp;
    const units = lp.weeklyUnits[lp.weeksElapsed];
    // Sales — and the revenue booked for them — are hard-capped to the production run. A price cut
    // or marketing push inflates the REMAINING weeklyUnits but caps only totalUnits, so the boosted
    // array can sum ABOVE totalUnits; clamp the sellable count here (unitsSold was already capped the
    // same way, so this is algebraically identical for the count) so the tick can never book
    // price × phantom-units into cash / cumulativeRevenue for units that were never built.
    const soldUnits = Math.min(Math.round(units * rate), Math.max(0, lp.totalUnits - lp.unitsSold));
    // Production was paid upfront at build, so each sale brings FULL price into cash.
    const gross = scale(lp.product.price, soldUnits);
    cash = add(cash, gross);
    cumulativeRevenue = add(cumulativeRevenue, gross);
    const newElapsed = lp.weeksElapsed + 1;
    const newUnitsSold = lp.unitsSold + soldUnits;
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
  // Absorbed installed base (from acquisitions) pays a flat services annuity each week (0 if none).
  cash = add(cash, scale(absorbedServicesRevenue(state), rate));

  // App Store commission — a weekly cut of the published catalogue (0 until the store is live). Reads
  // last week's catalogue (a one-week lag, like collecting on an established store) — sim-safe.
  cash = add(cash, scale(weeklyStoreCommission(state), rate));

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
  if (trendBeat) feed.push(trendBeat);
  if (climateBeat) feed.push(feedItem(week, climateBeat.text, climateBeat.tone));
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
    return { ...lp, weeklyUnits, totalUnits: lp.unitsSold + remaining };
  });

  // Arch-rival clash signals harvested this tick (strike / overtake / awards duel) → fed to the nemesis
  // engine below. Stays empty in a do-nothing pinned run (no strike, no overtake, no award duel), so
  // the nemesis never forms and the sim is byte-identical.
  const clashSignals: ClashSignal[] = [];

  // Rival Strike (fun track): the haircut above already landed — unchanged, unconditional — but a
  // contested entry ALSO raises a respond-or-hold interrupt so the attack is a moment the player
  // answers, not a feed line they read. One at a time, cooldown-gated; the interrupt itself changes
  // no economy numbers (responses are opt-in reducers the pinned sim never calls).
  // Global interrupt budget: at least minGapWeeks of quiet between any two OPPORTUNISTIC full-screen
  // cards. Read from the tick-start stamp (a const, so every setter this tick sees the same value);
  // whichever card fires sets lastInterruptWeek = week, deferring the rest to a later quiet week. The
  // pinned solo sim raises no interrupts, so this stays -999 → interruptQuiet is always true → no-op.
  const interruptQuiet = week - (state.lastInterruptWeek ?? -999) >= BALANCE.interrupts.minGapWeeks;
  let lastInterruptWeek = state.lastInterruptWeek ?? -999;
  let pendingStrike = state.pendingStrike ?? null;
  if (
    !pendingStrike &&
    interruptQuiet &&
    state.era >= 2 && // the Garage era is a protected learning sandbox — no strike interrupts
    contestedCats.size > 0 &&
    week - (state.lastStrikeWeek ?? -999) >= BALANCE.market.competition.strike.cooldownWeeks
  ) {
    const release = rivalReleases.find((r) => r.week === week && contestedCats.has(r.category));
    const target = release
      ? launchedFinal
          .filter((lp) => lp.product.category === release.category && lp.weeksElapsed < lp.weeklyUnits.length)
          .reduce<(typeof launchedFinal)[number] | null>((a, b) => (!a || b.launchedWeek > a.launchedWeek ? b : a), null)
      : null;
    if (release && target) {
      pendingStrike = {
        week,
        rivalId: release.rivalId,
        rivalName: release.rivalName,
        rivalProductName: release.product.name,
        rivalOverall: release.overall,
        category: release.category,
        productId: target.product.id,
        productName: target.product.name,
        playerOverall: overallScore(target.stats, target.product.category),
      };
      lastInterruptWeek = week; // consume the interrupt budget so nothing else piles on this week
      // The aggressor picks a fight → a nemesis-forming clash (they landed the blow).
      clashSignals.push({ kind: "struck", rivalId: release.rivalId });
    }
  }

  // The Silicon Awards — every 52 weeks, judge the year's launches (player + rival). Pure fold
  // over existing data: no RNG, no cash/rep change here (collectAwards is the opt-in payoff),
  // so the pinned sim is untouched. Skipped when a ceremony is already waiting (offline catch-up
  // can cross two year marks; the newest one wins the stage, history keeps them all).
  let pendingAwards = state.pendingAwards ?? null;
  let awardsHistory = state.awardsHistory ?? [];
  if (week > 0 && week % 52 === 0) {
    const ceremony = judgeAwards(week, launchedFinal, rivalReleases, state.companyName || "Silicon");
    if (ceremony) {
      pendingAwards = ceremony;
      awardsHistory = [ceremony, ...awardsHistory].slice(0, 20);
      lastInterruptWeek = week; // the year's big moment — keep the following weeks quiet
      // Awards duel: the marquee Device-of-the-Year result is a head-to-head clash — but ONLY when the
      // player actually competed this year (shipped a device). A do-nothing run where rivals win among
      // themselves is no rivalry, so it never forges a nemesis (keeps the pinned sim clash-free).
      const playerCompeted = launchedFinal.some((lp) => lp.launchedWeek >= week - 51 && lp.launchedWeek <= week);
      const device = ceremony.winners.find((w) => w.categoryId === "device");
      if (playerCompeted && device && !device.byPlayer) {
        const rivalId = competitors.find((c) => c.name === device.companyName)?.id;
        if (rivalId) clashSignals.push({ kind: "awardLoss", rivalId });
      } else if (device && device.byPlayer && state.nemesis) {
        clashSignals.push({ kind: "awardWin", rivalId: state.nemesis.rivalId });
      }
    }
  }

  // Side Orders — the deterministic commission stream (derived hash, never the sim RNG stream).
  // Offers lapse quietly; a RUNNING order (player-accepted only, so the pinned sim never has one)
  // pays out the week it completes.
  let pendingSideOrder = state.pendingSideOrder ?? null;
  let activeSideOrder = state.activeSideOrder ?? null;
  let sideOrdersCompleted = state.sideOrdersCompleted ?? 0;
  let sideOrderClients = state.sideOrderClients ?? {};
  if (pendingSideOrder && week > pendingSideOrder.expiresWeek) pendingSideOrder = null;
  if (activeSideOrder && week >= activeSideOrder.startedWeek + activeSideOrder.weeksNeeded) {
    const payout = sideOrderPayout(activeSideOrder);
    // Item 3.5 — a tidy, capable line (3.1/3.2) and a returning client both earn a completion bonus
    // ON TOP of the base payout. Pure upside on an already opt-in order, so the sim is unaffected.
    const so = BALANCE.sideOrders;
    const priorWithClient = sideOrderClients[activeSideOrder.clientName] ?? 0;
    const qualityPct = so.qualityBonusPct * lineEfficiency(state.factoryFloor);
    const loyaltyPct = Math.min(so.loyaltyBonusMaxPct, priorWithClient * so.loyaltyBonusPct);
    const bonus = Math.round(payout * (qualityPct + loyaltyPct)) as Money;
    cash = add(add(cash, payout), bonus);
    sideOrdersCompleted += 1;
    sideOrderClients = { ...sideOrderClients, [activeSideOrder.clientName]: priorWithClient + 1 };
    const bonusStr = bonus > 0
      ? ` ${format(payout)} + ${format(bonus)} ${loyaltyPct > 0 ? "line-quality & loyalty" : "line-quality"} bonus banked.`
      : ` ${format(payout)} banked.`;
    feed.push(feedItem(week, `${activeSideOrder.clientName} took delivery of ${activeSideOrder.units.toLocaleString()} units —${bonusStr}`, "positive"));
    activeSideOrder = null;
  }
  if (!pendingSideOrder && !activeSideOrder && !offline && sideOrderDue(state.seed, week)) {
    pendingSideOrder = generateSideOrder(state.seed, week, state.era);
    feed.push(feedItem(week, `${pendingSideOrder.clientName} wants ${pendingSideOrder.blurb} built on your line — ${pendingSideOrder.units.toLocaleString()} units. The offer expires week ${pendingSideOrder.expiresWeek}.`, "accent"));
  }

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
  const teamPlayers = state.staff.filter((s) => s.trait === "teamPlayer" || s.bonusTrait === "teamPlayer").length;
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
    const { staff: levelResult, leveledUp } = gainWeeklyXp(s, mentorshipXpMult(s, state.staff) * mentorTeamXpMult(state.staff, s));
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
    const atRisk = !offline && next.id !== "s0" && toDollars(next.salary) > 0 && newLowWeeks >= churnCfg.weeksUntilQuitRisk;
    if (atRisk) {
      // A People Lead SCALES DOWN the weekly quit chance (skill-scaled retention) rather than making
      // burnout consequence-free — so neglect still has teeth. rng is drawn here in BOTH cases; the
      // no-People-Lead path uses the full base chance and consumes rng exactly as before, so the
      // determinism pin (a solo founder, no hr) is byte-identical.
      const quitChance = hasPeopleLead
        ? churnCfg.quitChancePerWeek * Math.max(hrCfg.minQuitChanceMult, 1 - peopleLeadSkill * hrCfg.quitChanceReliefPerSkill)
        : churnCfg.quitChancePerWeek;
      if (rng.next() < quitChance) quitIds.push(next.id);
    }
    return { ...next, skills, mood, moodLowWeeks: newLowWeeks };
  });
  // Remove quitters and log them (can't splice inside map).
  let finalStaff = staff;
  for (const qid of quitIds) {
    const q = finalStaff.find((m) => m.id === qid);
    if (!q) continue;
    finalStaff = finalStaff.filter((m) => m.id !== qid);
    feed.push(feedItem(week, `${q.name} quit, sustained burnout pushed them to leave.`, "negative"));
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

  // Living App Store — developers publish to your platform each week. Dormant (a trickle) until the
  // App Marketplace module ships; then the catalogue grows with your installed base + OS version. The
  // catalogue only grows; you take a weekly store commission on it (added to cash near the ecosystem
  // revenue). Gated behind platformUnlocked → 0 in the base game (determinism preserved).
  let osApps = state.osApps ?? 0;
  if (state.platformUnlocked) {
    const hasMarketplace = state.osFeatures.includes("appMarket");
    osApps += appsPublishedPerWeek(installedBase(launched), state.osVersion, hasMarketplace) * rate;
  }

  // Security tug-of-war — THREAT creeps up (a bigger installed base is a bigger target) while your
  // hardening erodes as new exploits surface. Live play only (never offline), so a returning player
  // never comes back to a threat spike they had no chance to patch (mirrors the licensee-churn gate).
  // Net exposure drags reputation in the reputation block below; a patch/release clears it (reducers).
  let osThreat = state.osThreat ?? 0;
  let osSecurity = state.osSecurity ?? 0;
  if (!offline && state.platformUnlocked) {
    const hasPrivacy = state.osFeatures.includes("privacy");
    osThreat = clampSecurity(osThreat + threatRisePerWeek(installedBase(launched), hasPrivacy) * rate);
    osSecurity = clampSecurity(osSecurity - BALANCE.platform.security.securityDecayPerWeek * rate);
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

  // Exclusive holds: drop any whose licensee has walked (churn/prune above).
  let osExclusive = state.osExclusive ?? {};
  {
    const gone = Object.keys(osExclusive).filter((id) => !osLicensees.includes(id));
    if (gone.length > 0) { osExclusive = { ...osExclusive }; for (const id of gone) delete osExclusive[id]; }
  }

  // Inbound licensing CONTRACTS — a company approaches wanting to ship your OS. Here we only PRUNE a
  // stale offer (expired, or its suitor signed elsewhere); a FRESH offer is raised down in the shared
  // interrupt-budget section (it's a full-screen popup now, so it must respect the modal budget).
  // Sim-safe: platformUnlocked is false in the pinned auto-player run, so this stays null → byte-identical.
  let pendingLicenseOffer = state.pendingLicenseOffer ?? null;
  if (pendingLicenseOffer && (week > pendingLicenseOffer.expiresWeek || osLicensees.includes(pendingLicenseOffer.rivalId))) pendingLicenseOffer = null;

  // Living fan community — sentiment evolves from how you've treated your audience (recent verdicts +
  // launch freshness) and modulates retention (a beloved community churns slower). Gated on having
  // shipped, so a never-launched game + the pinned auto-player keep sentiment 0 → the decay below is
  // byte-identical.
  let fanSentiment = state.fanSentiment ?? 0;
  if (state.launched.length >= 1) {
    const cw = BALANCE.fans.community.windowWeeks;
    let hits = 0, solids = 0, flops = 0, lastLaunchWeek = -Infinity;
    for (const lp of state.launched) {
      if (lp.launchedWeek > lastLaunchWeek) lastLaunchWeek = lp.launchedWeek;
      if (lp.launchedWeek < week - cw) continue;
      if (lp.verdict === "hit") hits++;
      else if (lp.verdict === "solid") solids++;
      else if (lp.verdict === "flop") flops++;
    }
    const facts: CommunityFacts = { hits, solids, flops, weeksSinceLaunch: week - lastLaunchWeek, fans: state.fans };
    fanSentiment = evolveSentiment(fanSentiment, facts);
  }

  const baseDecay = hasProject(state.completedProjects, "loyaltyProgram")
    ? 1 - (1 - BALANCE.fans.decayPerWeek) * 0.5
    : BALANCE.fans.decayPerWeek;
  const loyaltyDecay = sentimentDecayFactor(baseDecay, fanSentiment); // = baseDecay exactly at sentiment 0
  const newFans = Math.round(
    state.fans * Math.pow(loyaltyDecay, rate)
    + (hasProject(state.completedProjects, "contentMarketing") ? 100 * rate : 0)
  );
  // Superfans track the (post-decay) fanbase — 0 whenever sentiment ≤ 0, so a neutral game has none.
  const superfans = superfansFrom(fanSentiment, newFans);
  // Brand awareness fades without reinvestment (rate-scaled to match the fan decay). 0 → 0, a no-op.
  const brandAwareness = Math.max(0, (state.brandAwareness ?? 0) * Math.pow(BALANCE.brand.decayPerWeek, rate));

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
    // Security exposure drag — an over-exposed, unpatched OS bleeds goodwill until you ship a patch or
    // a new version (the reducers clear the threat). Live play only, so it can never surprise a
    // returning player. Sim-safe: platformUnlocked is false in the pinned auto-player run.
    if (!offline && !bankrupt && state.platformUnlocked) {
      const sc = BALANCE.platform.security;
      if (netExposure(osThreat, osSecurity) > sc.exposureRepThreshold) {
        reputation = Math.max(0, reputation - sc.exposureRepDragPerWeek * rate);
        if (!feed.some((f) => f.week === week && f.text.includes("exposed")))
          feed.push(feedItem(week, `${osDisplayName(state)} is exposed, unpatched vulnerabilities are eroding trust. Ship a security patch.`, "negative"));
      }
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
    fanSentiment,
    superfans,
    brandAwareness,
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
    pendingStrike,
    lastInterruptWeek,
    pendingAwards,
    awardsHistory,
    pendingSideOrder,
    activeSideOrder,
    sideOrdersCompleted,
    sideOrderClients,
    cashHistory,
    osBaseHistory,
    osApps,
    osThreat,
    osSecurity,
    osLicensees,
    osLicenseeHealth,
    osExclusive,
    pendingLicenseOffer,
    feed,
    rivalReleases,
    rivalLineCounters,
    loans,
    rngState: rng.state(),
    bankrupt,
    // lastActive is stamped by the persistence layer on save, not per tick (keeps the reducer pure).
  };

  // Timed research (the active slot + queue): when the development window elapses, apply the unlock —
  // the SAME effect as the instant path, just delayed — then pull the next queued research up to
  // develop. The RP was paid at start. Gated on an active research, which the pinned solo sim never
  // starts → activeResearch stays null (+ empty queue) → byte-identical.
  if (base.activeResearch && week - base.activeResearch.startWeek >= base.activeResearch.totalWeeks) {
    const a = base.activeResearch;
    if (a.kind === "tier" && a.tierLevel != null) {
      base.researched = { ...base.researched, [a.ref as ComponentKind]: a.tierLevel };
    } else if (a.kind === "project" && !base.completedProjects.includes(a.ref as ProjectId)) {
      base.completedProjects = [...base.completedProjects, a.ref as ProjectId];
    }
    base.feed.push(feedItem(week, `Research complete: ${a.name} is ready.`, "positive"));
    // Advance the queue: the next lined-up research starts developing this same week.
    const queue = base.researchQueue ?? [];
    if (queue.length > 0) {
      const [nextUp, ...rest] = queue;
      base.activeResearch = { ...nextUp, startWeek: week };
      base.researchQueue = rest;
      base.feed.push(feedItem(week, `The lab moved on to ${nextUp.name}.`, "accent"));
    } else {
      base.activeResearch = null;
    }
  }

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

  // Eureka breakthroughs (engine/eureka.ts) — an active, funded lab occasionally has a flash of insight
  // (a bank-or-chase bet). Derived-hash cadence (never the sim rng) + a player-CLAIMED payoff, gated on
  // real researchers + era + cooldown, and it yields to any other pending interrupt. The solo pinned
  // sim assigns no researchers, so it never fires or resolves one → byte-identical.
  {
    const eu = BALANCE.research.eureka;
    if (
      !offline && !bankrupt && interruptQuiet &&
      !base.pendingEureka && !base.pendingStrike && !base.pendingPoach && !base.pendingChoice && !base.pendingLicenseOffer &&
      base.era >= eu.minEra &&
      base.staff.filter((s) => s.assignment === "rnd").length >= eu.minRnDStaff &&
      week - (state.lastEurekaWeek ?? -999) >= eu.cooldownWeeks &&
      eurekaDue(state.seed, week)
    ) {
      const moment = generateEureka(state.seed, week, base.era);
      base.pendingEureka = moment;
      base.lastEurekaWeek = week;
      base.lastInterruptWeek = week;
      base.feed.push(feedItem(week, `Your lab had a breakthrough in the ${moment.componentKind} line. Bank it, or chase the prototype?`, "accent"));
    }
  }

  // Community ASK: once you have a fanbase (launched ≥ 1), the community periodically asks for
  // something — answer it (resolveCommunityAsk) to grow + delight the base, or pass. Derived-hash
  // cadence + cooldown + a fresh-launch cooloff; yields to any other pending interrupt. The pinned
  // solo sim never launches, so it never raises one → byte-identical.
  {
    const ca = BALANCE.fans.community.asks;
    const lastLaunchWeek = state.launched.reduce((m, lp) => Math.max(m, lp.launchedWeek), -Infinity);
    if (
      !offline && !bankrupt && interruptQuiet &&
      state.launched.length >= 1 &&
      !base.pendingCommunityAsk && !base.pendingEureka && !base.pendingStrike && !base.pendingPoach &&
      !base.pendingChoice && !base.pendingRivalry && !base.pendingAwards && !base.pendingLicenseOffer &&
      week - (state.lastCommunityAskWeek ?? -999) >= ca.cooldownWeeks &&
      week - lastLaunchWeek >= ca.minWeeksSinceLaunch &&
      communityAskDue(state.seed, week)
    ) {
      const ask = generateCommunityAsk(state.seed, week, base.fans);
      base.pendingCommunityAsk = ask;
      base.lastCommunityAskWeek = week;
      base.lastInterruptWeek = week;
      base.feed.push(feedItem(week, `The community is asking: ${ASK_INFO[ask.kind].title.toLowerCase()}. Answer the call, or let it pass?`, "accent"));
    }
  }

  // Staff GROWTH moment: a senior, tenured staffer occasionally earns a permanent character upgrade
  // the player picks (resolveStaffMoment). Derived-hash cadence + cooldown; yields to any other pending
  // interrupt and respects the global budget. Gated on era + a real team with an eligible non-founder,
  // so the pinned solo sim (founder only) never raises one → byte-identical.
  {
    const g = BALANCE.staff.growth;
    if (
      !offline && !bankrupt && interruptQuiet &&
      base.era >= g.minEra && base.staff.length >= 2 &&
      !base.pendingStaffMoment && !base.pendingCommunityAsk && !base.pendingEureka && !base.pendingStrike &&
      !base.pendingPoach && !base.pendingChoice && !base.pendingRivalry && !base.pendingAwards && !base.pendingEarnings && !base.pendingLicenseOffer &&
      week - (state.lastStaffMomentWeek ?? -999) >= g.cooldownWeeks &&
      staffMomentDue(state.seed, week)
    ) {
      const target = pickGrowthTarget(base.staff, week);
      if (target) {
        const moment = generateStaffMoment(target, state.seed, week);
        if (moment.options.length > 0) {
          base.pendingStaffMoment = moment;
          base.lastStaffMomentWeek = week;
          base.lastInterruptWeek = week;
          base.feed.push(feedItem(week, `${target.name} has grown into a real force on the team — there's a way to develop them further.`, "accent"));
        }
      }
    }
  }

  // Staff LIFE event (item 2.2): a named teammate hits a personal turning point (burnout, an outside
  // offer, a milestone) and the player answers (resolveStaffEvent). Same guardrails as the growth
  // moment — derived-hash cadence + cooldown, yields to every other interrupt, gated on an established
  // team past the garage era, so the founder-only pinned sim never raises one → byte-identical.
  {
    const le = BALANCE.staff.lifeEvents;
    if (
      !offline && !bankrupt && interruptQuiet &&
      base.era >= le.minEra && base.staff.length >= 2 &&
      !base.pendingStaffEvent && !base.pendingStaffMoment && !base.pendingCommunityAsk && !base.pendingEureka &&
      !base.pendingStrike && !base.pendingPoach && !base.pendingChoice && !base.pendingRivalry && !base.pendingAwards &&
      !base.pendingEarnings && !base.pendingLicenseOffer && !base.pendingRegionalEvent &&
      week - (state.lastStaffEventWeek ?? -999) >= le.cooldownWeeks &&
      staffEventDue(state.seed, week)
    ) {
      const target = pickLifeEventTarget(base.staff, week);
      if (target) {
        base.pendingStaffEvent = generateStaffEvent(target, state.seed, week);
        base.lastStaffEventWeek = week;
        base.lastInterruptWeek = week;
      }
    }
  }

  // Regional loyalty + EVENTS — only once you've expanded past Home (so the solo sim, home-only, is
  // untouched → byte-identical). Loyalty eases back toward neutral each week; then, budget-paced, a
  // foreign market may raise a respond-or-ignore event (a boom / tariff / rival surge).
  {
    const rc = BALANCE.market.regions;
    const foreign = base.unlockedRegions.filter((id) => id !== "home");
    if (foreign.length > 0) {
      // Decay standing toward neutral (only touch non-neutral entries; keep the map tidy).
      const cur = base.regionLoyalty ?? {};
      let decayed: Partial<Record<RegionId, number>> | undefined;
      for (const [id, v] of Object.entries(cur) as [RegionId, number][]) {
        if (!v) continue;
        const next = v * Math.pow(rc.loyalty.decayPerWeek, rate);
        (decayed ??= { ...cur })[id] = Math.abs(next) < 0.5 ? 0 : next;
      }
      if (decayed) base.regionLoyalty = decayed;

      // Raise a regional event (opt-in interrupt), respecting the global budget + one-at-a-time rule.
      const ev = rc.events;
      if (
        !offline && !bankrupt && interruptQuiet &&
        base.era >= ev.minEra &&
        !base.pendingRegionalEvent && !base.pendingStaffMoment && !base.pendingCommunityAsk && !base.pendingEureka &&
        !base.pendingStrike && !base.pendingPoach && !base.pendingChoice && !base.pendingRivalry && !base.pendingAwards && !base.pendingEarnings && !base.pendingLicenseOffer &&
        week - (state.lastRegionalEventWeek ?? -999) >= ev.cooldownWeeks &&
        regionalEventDue(state.seed, week)
      ) {
        const event = generateRegionalEvent(state.seed, week, foreign, base.era);
        base.pendingRegionalEvent = event;
        base.lastRegionalEventWeek = week;
        base.lastInterruptWeek = week;
        const rname = regionById(event.regionId)?.name ?? "A market";
        base.feed.push(feedItem(week, `${rname}: ${REGIONAL_EVENT_COPY[event.kind].feed} How do you respond?`, "accent"));
      }
    }
  }

  // Quarterly EARNINGS (post-IPO): every fiscal quarter the street judges the quarter's revenue vs its
  // expectation → a share-price move (valuation-momentum delta, applied here before Track B decays it,
  // just like a launch pop) + a staged earnings call. Gated on `listed`, yields to any other pending
  // interrupt; the pinned solo sim never IPOs → never runs → byte-identical.
  if (
    !offline && !bankrupt && base.listed && interruptQuiet &&
    !base.pendingEarnings && !base.pendingCommunityAsk && !base.pendingEureka && !base.pendingStrike &&
    !base.pendingPoach && !base.pendingChoice && !base.pendingRivalry && !base.pendingAwards && !base.pendingLicenseOffer &&
    week - (state.lastEarningsWeek ?? week) >= BALANCE.ipo.shareholders.quarterWeeks
  ) {
    const sh = BALANCE.ipo.shareholders;
    const quarterRev = sub(base.cumulativeRevenue, state.quarterStartRevenue ?? base.cumulativeRevenue);
    const q = (state.earningsQuarter ?? 0) + 1;
    const report = judgeQuarter(q, week, quarterRev, (state.earningsExpectation ?? sh.minExpectation) as Money);
    const vmCap = BALANCE.valuationMomentum.cap;
    base.valuationMomentum = Math.max(-vmCap, Math.min(vmCap, (base.valuationMomentum ?? 0) + report.priceMovePct));
    base.pendingEarnings = report;
    base.earningsQuarter = q;
    base.lastEarningsWeek = week;
    base.lastInterruptWeek = week;
    base.quarterStartRevenue = base.cumulativeRevenue;
    base.earningsExpectation = nextExpectation(quarterRev);
    base.feed.push(feedItem(week,
      report.beat
        ? `Q${q} earnings beat the street — ${base.companyName}'s shares jumped ${Math.round(report.priceMovePct * 100)}%.`
        : `Q${q} earnings missed the street — ${base.companyName}'s shares slid ${Math.round(Math.abs(report.priceMovePct) * 100)}%.`,
      report.beat ? "positive" : "negative"));
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
        // Coalesce a multi-rank jump into ONE line instead of a near-identical line per rival passed.
        if (overtaken.length === 1) {
          base.feed.push(feedItem(week, `${base.companyName} overtook ${overtaken[0].name}, now #${newRank} in the industry.`, "positive"));
        } else if (overtaken.length > 1) {
          const lead = overtaken[0].name;
          base.feed.push(feedItem(week, `${base.companyName} climbed past ${lead} and ${overtaken.length - 1} other${overtaken.length - 1 > 1 ? "s" : ""} to #${newRank} in the industry.`, "positive"));
        }
        if (newRank === 1) {
          base.feed.push(feedItem(week, `${base.companyName} is now the #1 company in the industry. The throne is yours.`, "positive"));
        }
        // Overtaking a rival is a clash. The biggest one you pass (board is valuation-sorted, so the
        // first entry) is the marquee scalp — a "dethroning" when it takes you to #1.
        overtaken.forEach((r, i) => clashSignals.push({ kind: i === 0 && newRank === 1 ? "dethroned" : "overtake", rivalId: r.id }));
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

  // The ARCH-RIVAL / NEMESIS (engine/nemesis.ts) — fold this tick's clash signals into a persistent
  // 1:1 rivalry: form one on the first clash, escalate its heat + head-to-head record, and let a hot
  // rivalry taunt you. Live play only (so a returning player never comes back mid-feud), and skipped
  // entirely when there were no clashes — so the pinned auto-player never forms a nemesis → byte-
  // identical. The launch edge (applied above in advanceCompetitors) reads LAST week's nemesis.
  if (!offline && !bankrupt) {
    const prevNem = base.nemesis ?? null; // pre-update, for milestone detection (item 2.3)
    const res = updateNemesis({
      current: prevNem,
      signals: clashSignals,
      week,
      existsById: (id) => base.competitors.some((c) => c.id === id),
      pickWeight: (id) => base.competitors.find((c) => c.id === id)?.reputation ?? 0,
    });
    base.nemesis = res.nemesis;
    if (res.declared) {
      const rival = base.competitors.find((c) => c.id === res.declared!.rivalId);
      const doctrine = rivalDef(res.declared.rivalId)?.doctrine ?? "generalist";
      base.feed.push(feedItem(week, `${rival?.name ?? "A rival"} has become your arch-rival. It's personal now.`, "negative"));
      // The reveal CARD respects the interrupt budget AND never doubles up with another pending modal
      // (a nemesis usually forms from the very strike already on screen). If suppressed the nemesis
      // still forms and the feed still announces it — only the extra full-screen card is skipped.
      if (
        interruptQuiet &&
        !base.pendingRivalry && !base.pendingStrike && !base.pendingEureka && !base.pendingCommunityAsk &&
        !base.pendingEarnings && !base.pendingPoach && !base.pendingChoice && !base.pendingAwards && !base.pendingLicenseOffer
      ) {
        base.pendingRivalry = { rivalId: res.declared.rivalId, rivalName: rival?.name ?? "A rival", doctrine };
        base.lastInterruptWeek = week;
      }
    } else if (res.nemesis && clashSignals.some((s) => s.rivalId === res.nemesis!.rivalId)) {
      // A clash with the standing nemesis this week → a taunt (rate-limited by clash frequency). The
      // taunt is now turf- and heat-aware (item 2.3): it names the category you're fighting over and
      // turns venomous at all-out war.
      const rival = base.competitors.find((c) => c.id === res.nemesis!.rivalId);
      const doctrine = rivalDef(res.nemesis.rivalId)?.doctrine ?? "generalist";
      const turf = CATEGORIES[playerTopCategory(base)]?.displayName?.toLowerCase();
      base.feed.push(feedItem(week, `${rival?.name ?? "Your rival"}: “${nemesisTaunt(doctrine, base.seed, week, { tier: heatTier(res.nemesis.heat), turf })}”`, "accent"));
    }
    // Milestone beat (item 2.3) — a tier escalation or a head-to-head record crossing turns the feud
    // into a story with turning points. Independent of the taunt, so a quiet-week escalation still speaks.
    if (res.nemesis) {
      const ms = nemesisMilestone(prevNem, res.nemesis);
      if (ms) {
        const rival = base.competitors.find((c) => c.id === res.nemesis!.rivalId);
        base.feed.push(feedItem(week, ms.text.replace(/\{rival\}/g, rival?.name ?? "Your rival"), ms.tone as FeedTone));
      }
    }
  }

  // Inbound licensing CONTRACT offer — a company approaches wanting to ship your OS on their devices.
  // It surfaces as a full-screen popup (the OS division's marquee moment), so it rides the SHARED
  // interrupt budget: only on a quiet week with nothing else pending, and it stamps lastInterruptWeek
  // when it fires so no other modal piles on. Deterministic cadence (derived hash, salt 91 — never the
  // sim rng) and gated behind platformUnlocked, so the pinned solo run (locked → no offers) stays
  // byte-identical. Suitors exclude current licensees and any exclusivity-locked category; prouder
  // brands demand exclusivity and drive a harder bargain (see licenseOffers.ts).
  if (
    !offline && !bankrupt && interruptQuiet && state.platformUnlocked && !base.pendingLicenseOffer &&
    !base.pendingEureka && !base.pendingCommunityAsk && !base.pendingStrike && !base.pendingPoach &&
    !base.pendingChoice && !base.pendingRivalry && !base.pendingAwards && !base.pendingEarnings &&
    !base.pendingStaffMoment && !base.pendingRegionalEvent
  ) {
    const osTierNum = osTier(base.researched.software).tier;
    if (licenseOfferDue(state.seed, week, osTierNum)) {
      const lockedCats = new Set(Object.values(base.osExclusive ?? {}));
      const suitors: LicenseSuitor[] = base.competitors
        .filter((c) => !base.osLicensees.includes(c.id))
        .map((c) => ({ id: c.id, name: c.name, reputation: c.reputation, category: rivalDef(c.id)?.preferredCategories[0] ?? "phone" }))
        .filter((s) => !lockedCats.has(s.category));
      const offer = generateLicenseOffer(state.seed, week, osTierNum, suitors);
      if (offer) {
        base.pendingLicenseOffer = offer;
        base.lastInterruptWeek = week;
        base.feed.push(feedItem(week, `${offer.rivalName} wants to ship ${osDisplayName(state)} on their ${CATEGORIES[offer.category].displayName.toLowerCase()}s${offer.exclusive ? " — exclusively" : ""}. ${format(offer.signingBonus)} to sign.`, "accent"));
      }
    }
  }

  // Post-launch reactive event (item 3.6): a product ALREADY selling hits a mid-lifecycle moment
  // (flying off shelves / stalling / a supply pinch) and the player answers (resolvePostLaunch).
  // Placed LAST among the opportunistic interrupts so its guard need only exclude every OTHER pending;
  // derived-hash cadence (salt 257, never the sim rng) + cooldown, gated past the garage era on a live
  // product with runway left. The solo pinned sim ships nothing that lingers → raises none → identical.
  {
    const pc = BALANCE.postLaunch;
    if (
      !offline && !bankrupt && interruptQuiet &&
      base.era >= pc.minEra && !base.pendingPostLaunch &&
      !base.pendingStaffEvent && !base.pendingStaffMoment && !base.pendingCommunityAsk && !base.pendingEureka &&
      !base.pendingStrike && !base.pendingPoach && !base.pendingChoice && !base.pendingRivalry && !base.pendingAwards &&
      !base.pendingEarnings && !base.pendingLicenseOffer && !base.pendingRegionalEvent &&
      week - (state.lastPostLaunchWeek ?? -999) >= pc.cooldownWeeks &&
      postLaunchDue(state.seed, week)
    ) {
      const targets: PostLaunchTarget[] = base.launched
        .filter((lp) => lp.weeksElapsed < lp.weeklyUnits.length) // still in its selling window
        .map((lp) => ({
          productId: lp.product.id,
          productName: lp.product.name,
          category: lp.product.category,
          sellThrough: (lp.plannedUnits ?? 0) > 0 ? Math.min(1, lp.unitsSold / (lp.plannedUnits ?? 1)) : 0,
          weeksLive: week - lp.launchedWeek,
          weeksLeft: lp.weeklyUnits.length - lp.weeksElapsed,
        }));
      const target = pickPostLaunchTarget(targets);
      if (target) {
        base.pendingPostLaunch = generatePostLaunchEvent(target, week);
        base.lastPostLaunchWeek = week;
        base.lastInterruptWeek = week;
      }
    }
  }

  // Rolling contract board (engine/contracts.ts) — 2–3 live, directed goals that regenerate on claim
  // or expiry, giving the post-tutorial/endgame a chase. Deterministic (derived hash, never the sim
  // rng) and the reward is player-CLAIMED, so the pinned auto-player (which ships nothing → the board
  // never opens) stays byte-identical. Runs before the event returns so every path carries the board.
  if (base.launched.length >= 1) {
    const facts = contractFacts(base);
    // Keep unclaimed-but-completed contracts (they wait to be claimed); drop ones that lapsed unmet.
    const kept: Contract[] = [];
    for (const c of base.contracts ?? []) {
      if (week > c.expiresWeek && !contractDone(c, facts)) {
        if (!offline) base.feed.push(feedItem(week, `The “${c.title}” contract lapsed.`, "neutral"));
      } else kept.push(c);
    }
    let contracts = kept;
    let contractCounter = base.contractCounter ?? 0;
    while (contracts.length < CONTRACT_BOARD_SIZE) {
      contracts = [...contracts, generateContract(base.seed, contractCounter, base.era, facts)];
      contractCounter += 1;
    }
    base.contracts = contracts;
    base.contractCounter = contractCounter;
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
/** Item 1.4 — tiny derived-hash → [0,1), same recipe as eureka / side orders. Picks the rival an
 *  event is about WITHOUT touching the sim RNG stream (salt 271), so naming events never perturbs
 *  determinism. */
function eventHash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Item 1.4 — the real competitor a `{rival}`-slotted event is about. Prefers your NEMESIS (so the
 *  feud pervades the world), else "leader" = the strongest rival, else a stable derived pick. Null
 *  when there are no rivals (the caller falls back to generic text). */
function resolveEventRival(s: GameState, ev: MarketEvent, week: number): CompetitorState | null {
  if (!ev.rivalSlot) return null;
  const alive = s.competitors;
  if (alive.length === 0) return null;
  const nem = s.nemesis ? alive.find((c) => c.id === s.nemesis!.rivalId) : undefined;
  if (nem) return nem; // the nemesis stars in the world's gossip whenever a rival is named
  if (ev.rivalSlot === "leader") {
    return alive.reduce((best, c) => (c.reputation > best.reputation ? c : best), alive[0]);
  }
  return alive[Math.floor(eventHash01(s.seed, week, 271) * alive.length) % alive.length];
}

export function applyEventEffect(
  s: GameState,
  eff: MarketEvent["effect"],
  week: number,
  feedText: string,
  feedTone: FeedTone,
  /** Item 1.4 — when the event named a specific rival, a `rivalScandal` is scoped to THAT rival
   *  (strength haircut + a share-price dip) so the text and the mechanics agree. Omitted → the legacy
   *  field-wide behaviour (used by choice events / event chains). */
  targetRivalId?: string,
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
        // Scoped to the NAMED rival when the event named one (so text + mechanics agree); otherwise
        // the legacy field-wide effect. A named scandal also dents that rival's share price.
        if (targetRivalId && c.id !== targetRivalId) return c;
        const next: typeof c.strengthByCategory = {};
        for (const [cat, v] of Object.entries(c.strengthByCategory)) next[cat as keyof typeof next] = (v as number) * eff.factor;
        const sharePrice = targetRivalId ? Math.max(1, Math.round(c.sharePrice * (0.85 + 0.1 * eff.factor))) : c.sharePrice;
        return { ...c, strengthByCategory: next, sharePrice };
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

  feed.push(feedItem(week, text, feedTone));
  return { ...s, cash, reputation, researchPoints, trends, competitors, staff, fans, feed: trimFeed(feed) };
}

function applyMarketEvent(s: GameState, ev: MarketEvent, week: number, rng: ReturnType<typeof rngFrom>): GameState {
  // Item 1.4 — bind the event to a REAL rival: swap `{rival}` for an actual competitor's name
  // (preferring the nemesis) and, for a scandal, route the mechanical hit to THAT rival.
  const rival = resolveEventRival(s, ev, week);
  const title = ev.title.includes("{rival}")
    ? ev.title.replace(/\{rival\}/g, rival?.name ?? "A rival")
    : ev.title;
  const applied = applyEventEffect(s, ev.effect, week, title, ev.tone as FeedTone, rival?.id);
  const nextEventWeek = week + BALANCE.events.everyWeeks + rng.int(BALANCE.events.jitter);
  return { ...applied, nextEventWeek, lastEvent: { text: title, tone: ev.tone as FeedTone, week }, rngState: rng.state() };
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
  /** How a contract negotiation resolved (set only by negotiateLicenseOffer) — drives the reveal copy. */
  negotiationOutcome?: NegotiationOutcome;
  /** Extra signing-bonus won on an `improved` negotiation (0 otherwise). */
  negotiationBonusDelta?: Money;
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
      feed: trimFeed(feed),
    },
    ok: true,
  };
}

/** Launch a built product into the market. Production + marketing were already paid at build;
 *  the timing of THIS launch decides how the product meets current demand. Sales are capped to
 *  the production run, so over/under-producing matters. */
/** Snapshot the launch-moment drivers from a production plan (pillar #5: readable simulation).
 *  Shared by launchReady (records it on the launched product) and the launch reveal (renders the
 *  "why" line from the same data) so the two can never drift. */
export function insightFromPlan(plan: ProductionPlan): LaunchInsight {
  return {
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
  };
}

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
  // Verdict is needed up front to SHAPE the sales curve (item 1.1 word-of-mouth): a hit ramps fast
  // and sells for weeks with a mid-tail second wind; a flop spikes and collapses. Same lifetime
  // total — only WHEN the units land changes. effectiveScore/outcome are reused by the reputation +
  // fans response below (declared once here).
  const effectiveScore = plan.launchScore * plan.competitionFactor;
  const outcome = verdictFor(state, effectiveScore);
  const weeklyUnits = distributeOverCurve(totalUnits, verdictCurveShape(outcome));

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
    insight: insightFromPlan(plan),
  };

  // Reputation response (QA Lab softens flops, boosts hits).
  const qa = hasProject(state.completedProjects, "qaLab");
  let reputation = state.reputation;
  const rep = BALANCE.reputation;
  // F8 — hit/flop tracks ACTUAL performance (the competition-adjusted effectiveScore computed above),
  // not the competition-FREE launchScore, and is judged against the LIVE expectation bars (the static
  // era bar raised by the company's own recent track record — see launchBars/verdictFor). A product
  // can score well in isolation yet sell little once rivals split the market, so it wouldn't be "a
  // hit". effectiveScore + outcome were declared above (they also shape the sales curve).
  const isHit = outcome === "hit";
  const isFlop = outcome === "flop";
  const isSolid = outcome === "solid";
  const hasCrisisComms = hasProject(state.completedProjects, "crisisComms");
  if (isHit) reputation = Math.min(rep.max, reputation + rep.gainPerHit * (qa ? 1.5 : 1));
  else if (isSolid) reputation = Math.min(rep.max, reputation + rep.gainPerSolid);
  else if (isFlop) reputation = Math.max(rep.min, reputation - rep.lossPerFlop * (qa ? 0.6 : 1) * (hasCrisisComms ? 0.5 : 1));
  reputation = Math.min(rep.max, reputation + channel.reputation);
  if (hasProject(state.completedProjects, "pressKit")) reputation = Math.min(rep.max, reputation + 1);
  if (hasProject(state.completedProjects, "gtmPrestige")) reputation = Math.min(rep.max, reputation + 2); // GTM doctrine: Prestige House
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

  // Item 3.3 — design-brief bonus. Committing a product to a target segment and NAILING its stat fit
  // at launch earns bonus reputation + fans (scaled from 0 at fitThreshold up to full at fitFull);
  // missing it just forgoes the bonus, never a penalty. Opt-in (product.targetSegment) → the pinned
  // sim, which never sets a target, is byte-identical. Applied before fan milestones so the extra
  // fans can cross a milestone naturally.
  let briefBeat: FeedItem | null = null;
  if (product.targetSegment) {
    const bc = BALANCE.briefs;
    const seg = plan.segments.perSegment.find((r) => r.id === product.targetSegment);
    const fit = seg?.fit ?? 0;
    if (seg && fit >= bc.fitThreshold) {
      const strength = Math.min(1, (fit - bc.fitThreshold) / Math.max(1, bc.fitFull - bc.fitThreshold));
      const repAdd = bc.repBonus * strength;
      const fanAdd = Math.round(bc.fanBonus * strength);
      reputation = Math.min(rep.max, reputation + repAdd);
      fans += fanAdd;
      briefBeat = feedItem(state.week, `Design brief nailed — “${product.name}” won over the ${seg.name} segment (fit ${Math.round(fit)}). +${Math.round(repAdd)} rep · +${fanAdd.toLocaleString()} fans.`, "positive");
    } else {
      briefBeat = feedItem(state.week, `Design brief missed — “${product.name}” didn't win over ${seg?.name ?? "the target"} (fit ${Math.round(fit)}, needed ${bc.fitThreshold}).`, "neutral");
    }
  }

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
  if (briefBeat) feed.push(briefBeat); // item 3.3 — design-brief outcome

  // Item 2.6 — fold this launch's (deterministic) critic reviews into the running per-outlet stance,
  // so an outlet that keeps panning (or keeps championing) you becomes a thread in the feed. The
  // reviews use their own hashed RNG (not the sim RNG) and only produce feed text → balance untouched.
  const launchReviews = criticReviews({
    productId: lp.product.id,
    stats: lp.stats,
    verdict: outcome,
    demandFit: lp.insight?.demandFit ?? 60,
    priceFit: lp.insight?.priceFit ?? 1,
    betterRivals: lp.insight?.betterRivals ?? 0,
  });
  const outletThreads = foldOutletThreads(state.reviewThreads, launchReviews, product.name);
  if (outletThreads.beat) feed.push(feedItem(state.week, outletThreads.beat.text, outletThreads.beat.tone));

  return {
    state: {
      ...state,
      ready: state.ready.filter((p) => p.id !== productId),
      launched: [lp, ...state.launched],
      reviewThreads: outletThreads.threads,
      reputation,
      valuationMomentum,
      fans,
      // Roll the expectations baseline forward, so the NEXT launch's bar reflects this one — the
      // "you're only as good as your last" loop that keeps hits from being farmable.
      launchExpectation: nextLaunchExpectation(state.launchExpectation, effectiveScore),
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
/** Factory Mode BOOST — rush the lead production run: pay an overtime premium (a fraction of
 *  the run's production cost) and one week of work completes instantly. Repeatable while weeks
 *  remain; each press pays again. Pure; the caller owns the spend FX. */
/** Does a machine footprint at (c,r) overlap any placed decor prop? Props are solid both ways —
 *  canPlaceProp refuses machine cells, and this is the mirror check the floor reducers apply. */
function machineOverPropAt(state: GameState, kind: MachineKind, c: number, r: number): boolean {
  const props = propCellSet(state.factoryProps);
  if (props.size === 0) return false;
  return machineCells({ kind, c, r }).some((cell) => props.has(cell));
}

/** Factory Mode Build: buy + place a machine on the floor grid (cash-gated, overlap-checked). */
export function buyFloorMachine(state: GameState, kind: MachineKind, c: number, r: number): ActionResult {
  const def = MACHINE_DEFS[kind];
  if (state.cash < def.cost) return { state, ok: false, reason: `Need ${format(def.cost)} for the ${def.name}.` };
  if (machineOverPropAt(state, kind, c, r)) return { state, ok: false, reason: "A decoration is in the way — move it first." };
  // Monotonic counter, never array length: demolish + re-buy in one week must not reuse an id.
  const next = floorPlaceMachine(state.factoryFloor, kind, c, r, `fm-${state.week}-${state.factoryPieceCounter}`, floorWidth(state.factoryExpansion));
  if (!next) return { state, ok: false, reason: "Doesn't fit there." };
  return { state: { ...state, cash: sub(state.cash, def.cost), factoryFloor: next, factoryPieceCounter: state.factoryPieceCounter + 1 }, ok: true };
}

/** Buy + lay a conveyor tile. Re-aiming an existing tile is free; new tiles cost BELT_COST. */
export function buyFloorBelt(state: GameState, c: number, r: number, dir: BeltDir): ActionResult {
  const existing = state.factoryFloor.belts.some((b) => b.c === c && b.r === r);
  if (!existing && state.cash < BELT_COST) return { state, ok: false, reason: `Belts cost ${format(BELT_COST)} a tile.` };
  if (propCellSet(state.factoryProps).has(`${c},${r}`)) return { state, ok: false, reason: "A decoration is in the way — move it first." };
  const next = floorPlaceBelt(state.factoryFloor, c, r, dir, floorWidth(state.factoryExpansion));
  if (!next) return { state, ok: false, reason: "Can't lay a belt there." };
  return { state: { ...state, cash: existing ? state.cash : sub(state.cash, BELT_COST), factoryFloor: next }, ok: true };
}

/** Lay a whole DRAG RUN of conveyor at once — each tile auto-aimed toward the next cell (the last
 *  continues straight; a single tile uses `fallbackDir`). New tiles cost BELT_COST, re-aiming an
 *  existing tile is free, and cells over a machine / prop / off-grid are skipped. Places greedily and
 *  stops when the budget runs out, so a long drag paints as much as the player can afford. */
export function paintBeltRun(state: GameState, cells: { c: number; r: number }[], fallbackDir: BeltDir): ActionResult {
  if (cells.length === 0) return { state, ok: false, reason: "Nothing to lay." };
  const maxW = floorWidth(state.factoryExpansion);
  const propAt = propCellSet(state.factoryProps);
  const dirBetween = (a: { c: number; r: number }, b: { c: number; r: number }): BeltDir =>
    b.c > a.c ? "e" : b.c < a.c ? "w" : b.r > a.r ? "s" : "n";
  let floor = state.factoryFloor;
  let cash = state.cash;
  let placed = 0;
  let brokeAt = false;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const dir: BeltDir = cells[i + 1] ? dirBetween(cell, cells[i + 1]) : i > 0 ? dirBetween(cells[i - 1], cell) : fallbackDir;
    if (propAt.has(`${cell.c},${cell.r}`)) continue; // decor is solid — paint around it
    const existing = floor.belts.some((b) => b.c === cell.c && b.r === cell.r);
    if (!existing && cash < BELT_COST) { brokeAt = true; break; } // out of budget for new tiles
    const next = floorPlaceBelt(floor, cell.c, cell.r, dir, maxW);
    if (!next) continue; // off-grid or on a machine → skip this cell
    if (!existing) cash = sub(cash, BELT_COST);
    floor = next;
    placed++;
  }
  if (placed === 0) {
    // Distinguish "no money" from "no legal cell" — the toast should tell the player which.
    if (brokeAt) return { state, ok: false, reason: `Belts cost ${format(BELT_COST)} a tile.` };
    return { state, ok: false, reason: "Can't lay a belt there." };
  }
  return { state: { ...state, factoryFloor: floor, cash }, ok: true };
}

/** The price of the NEXT floor expansion (escalating), or null if maxed out. */
const EXPANSION_COSTS = [50_000, 150_000, 400_000];
export function nextExpansionCost(expansion: number): Money | null {
  if (expansion >= MAX_EXPANSION) return null;
  return dollars(EXPANSION_COSTS[expansion] ?? EXPANSION_COSTS[EXPANSION_COSTS.length - 1]) as Money;
}

/** Buy the next floor expansion — widens the buildable grid by one bay (cash-gated, capped). */
export function buyFloorExpansion(state: GameState): ActionResult {
  const cost = nextExpansionCost(state.factoryExpansion);
  if (cost == null) return { state, ok: false, reason: "The floor is already at maximum size." };
  if (state.cash < cost) return { state, ok: false, reason: `Need ${format(cost)} to expand the floor.` };
  return { state: { ...state, cash: sub(state.cash, cost), factoryExpansion: state.factoryExpansion + 1 }, ok: true };
}

/** Buy + place a decorative prop on an empty floor cell (cash-gated, overlap-checked). */
export function buyFactoryProp(state: GameState, kind: PropKind, c: number, r: number): ActionResult {
  const def = PROP_DEFS[kind];
  if (state.cash < def.cost) return { state, ok: false, reason: `Need ${format(def.cost)} for the ${def.name}.` };
  const next = propsPlace(state.factoryFloor, state.factoryProps, kind, c, r, `fp-${state.week}-${state.factoryPieceCounter}`, floorWidth(state.factoryExpansion));
  if (!next) return { state, ok: false, reason: "Doesn't fit there." };
  return { state: { ...state, cash: sub(state.cash, def.cost), factoryProps: next, factoryPieceCounter: state.factoryPieceCounter + 1 }, ok: true };
}

/** The net an auto-route would charge: new tiles at full price − removed tiles at half back. */
function autoRouteNet(current: FloorPlan, routed: FloorPlan): number {
  const oldCells = new Set(current.belts.map((b) => `${b.c},${b.r}`));
  const newCells = new Set(routed.belts.map((b) => `${b.c},${b.r}`));
  let cost = 0;
  for (const k of newCells) if (!oldCells.has(k)) cost += BELT_COST;
  for (const k of oldCells) if (!newCells.has(k)) cost -= Math.round(BELT_COST / 2);
  return cost;
}

/** Price the Auto route WITHOUT committing — the confirm dialog's quote. Deterministic: the same
 *  router runs again on confirm, so the quoted price is exactly what gets charged. Null when there
 *  is no route (missing Intake/Packer or no clear path). Pure. */
export function autoConnectQuote(state: GameState): { cost: Money; tiles: number } | null {
  const routed = autoTidyFloor(state.factoryFloor, floorWidth(state.factoryExpansion), propCellSet(state.factoryProps));
  if (!routed) return null;
  return { cost: cents(autoRouteNet(state.factoryFloor, routed)), tiles: routed.belts.length };
}

/** One-tap Auto — TIDY the whole line: reposition every machine into clean recipe-order lanes and
 *  wire a fresh Intake→Packer chain around them, so a scattered floor becomes one long straight line.
 *  Charges only the net belt tiles (new at full price, removed at half refund); rearranging machines
 *  is free. Deterministic: the same tidy+route runs on quote and commit, so the price is exact. */
export function autoConnectLine(state: GameState): ActionResult {
  const routed = autoTidyFloor(state.factoryFloor, floorWidth(state.factoryExpansion), propCellSet(state.factoryProps));
  if (!routed) return { state, ok: false, reason: "Place an Intake and a Packer first (and expand if the floor is full)." };
  const cost = autoRouteNet(state.factoryFloor, routed);
  if (cost > 0 && state.cash < cost) return { state, ok: false, reason: `Need ${format(cents(cost))} to route the belts.` };
  return { state: { ...state, factoryFloor: routed, cash: add(state.cash, cents(-cost)) }, ok: true };
}

/** Tune up the machine at (c,r) one level (cash-gated, capped at MACHINE_MAX_LEVEL). Upgrades shave
 *  build time via lineSpeedMult and raise the machine's demolition value. */
export function upgradeFloorMachine(state: GameState, c: number, r: number): ActionResult {
  const cost = machineUpgradeCostAt(state.factoryFloor, c, r);
  if (cost == null) return { state, ok: false, reason: "Nothing to upgrade here (or it's already maxed)." };
  if (state.cash < cost) return { state, ok: false, reason: `Need ${format(cost)} to upgrade that machine.` };
  const next = upgradeMachineAt(state.factoryFloor, c, r);
  if (!next) return { state, ok: false, reason: "That machine is already at its top tier." };
  return { state: { ...state, cash: sub(state.cash, cost), factoryFloor: next }, ok: true };
}

/** Relocate a machine to a new cell — the hold-and-drag gesture. Free (rearranging isn't buying);
 *  keeps the machine's id, kind and upgrade level. */
export function moveFloorMachine(state: GameState, id: string, c: number, r: number): ActionResult {
  const m = state.factoryFloor.machines.find((x) => x.id === id);
  if (m && machineOverPropAt(state, m.kind, c, r)) return { state, ok: false, reason: "A decoration is in the way — move it first." };
  const next = floorMoveMachine(state.factoryFloor, id, c, r, floorWidth(state.factoryExpansion));
  if (!next) return { state, ok: false, reason: "Doesn't fit there." };
  return { state: { ...state, factoryFloor: next }, ok: true };
}

/** Relocate a decor prop to a new cell — the hold-and-drag gesture. Free. */
export function moveFactoryProp(state: GameState, id: string, c: number, r: number): ActionResult {
  const next = propsMove(state.factoryFloor, state.factoryProps, id, c, r, floorWidth(state.factoryExpansion));
  if (!next) return { state, ok: false, reason: "Doesn't fit there." };
  return { state: { ...state, factoryProps: next }, ok: true };
}

/** Clear whatever occupies the cell — a prop first, else a machine/belt; demolition pays back half. */
export function clearFloorCell(state: GameState, c: number, r: number): GameState {
  const propBack = propRefund(state.factoryProps, c, r);
  if (propBack > 0) {
    return { ...state, factoryProps: propsRemoveAt(state.factoryProps, c, r), cash: add(state.cash, propBack) };
  }
  const refund = demolitionRefund(state.factoryFloor, c, r);
  const next = floorRemoveAt(state.factoryFloor, c, r);
  if (next === state.factoryFloor) return state;
  return { ...state, factoryFloor: next, cash: add(state.cash, refund) };
}

/* ---- Saved factory layouts: snapshot a floor design under a name, switch between them ---- */

/** Sum the cost of buying floor expansions from `from` up to `to` (permanent; never refundable).
 *  Both ends are clamped to the valid [0, MAX_EXPANSION] range so a corrupt/tampered save can't
 *  drive an unbounded loop. */
function expansionDeltaCost(from: number, to: number): Money {
  const lo = Math.max(0, Math.min(MAX_EXPANSION, Math.floor(from)));
  const hi = Math.max(lo, Math.min(MAX_EXPANSION, Math.floor(to)));
  let sum = 0;
  for (let i = lo; i < hi; i++) sum += EXPANSION_COSTS[i] ?? EXPANSION_COSTS[EXPANSION_COSTS.length - 1];
  return dollars(sum) as Money;
}

/** Total net cost (cents; negative = a net refund) to apply a saved layout over the current floor:
 *  the fair machine/belt/prop diff plus any extra permanent expansions the layout needs. Pure. */
export function factoryLayoutCost(state: GameState, layout: FactoryLayout): Money {
  const appliedExp = Math.max(state.factoryExpansion, layout.expansion);
  const diff = layoutApplyCost(state.factoryFloor, state.factoryProps, layout.floor, layout.props);
  return add(diff, expansionDeltaCost(state.factoryExpansion, appliedExp));
}

/** Snapshot the current floor (machines, belts, props, decor, expansion) as a named layout. Free;
 *  capped at MAX_LAYOUTS. The name is trimmed/bounded, falling back to "Layout N". */
export function saveFactoryLayout(state: GameState, name: string): ActionResult {
  const layouts = state.factoryLayouts ?? [];
  if (layouts.length >= MAX_LAYOUTS) return { state, ok: false, reason: `You can keep up to ${MAX_LAYOUTS} layouts. Delete one first.` };
  const clean = name.trim().slice(0, 24) || `Layout ${layouts.length + 1}`;
  const layout: FactoryLayout = {
    id: `layout-${state.factoryLayoutCounter}`, // monotonic — safe across delete + re-save in one week
    name: clean,
    floor: { machines: state.factoryFloor.machines.map((m) => ({ ...m })), belts: state.factoryFloor.belts.map((b) => ({ ...b })) },
    props: state.factoryProps.map((p) => ({ ...p })),
    expansion: state.factoryExpansion,
    decor: { ...state.factoryDecor },
    savedWeek: state.week,
  };
  return { state: { ...state, factoryLayouts: [...layouts, layout], factoryLayoutCounter: state.factoryLayoutCounter + 1 }, ok: true };
}

/** Delete a saved layout by id. */
export function deleteFactoryLayout(state: GameState, id: string): GameState {
  const layouts = state.factoryLayouts ?? [];
  const next = layouts.filter((l) => l.id !== id);
  return next.length === layouts.length ? state : { ...state, factoryLayouts: next };
}

/** Retool the floor to a saved layout, charging (or refunding) the fair diff + any new expansions. */
export function applyFactoryLayout(state: GameState, id: string): ActionResult {
  const layout = (state.factoryLayouts ?? []).find((l) => l.id === id);
  if (!layout) return { state, ok: false, reason: "That layout is no longer available." };
  const cost = factoryLayoutCost(state, layout);
  if (cost > 0 && state.cash < cost) return { state, ok: false, reason: `Need ${format(cost)} to retool the floor to “${layout.name}”.` };
  return {
    state: {
      ...state,
      cash: add(state.cash, cents(-cost)), // cost>0 subtracts, cost<0 refunds
      factoryFloor: { machines: layout.floor.machines.map((m) => ({ ...m })), belts: layout.floor.belts.map((b) => ({ ...b })) },
      factoryProps: layout.props.map((p) => ({ ...p })),
      // Clamp like expansionDeltaCost does — a tampered layout can't push expansion past MAX
      // while only being charged up to the MAX-expansion price.
      factoryExpansion: Math.min(MAX_EXPANSION, Math.max(state.factoryExpansion, Math.max(0, Math.floor(layout.expansion)))),
      factoryDecor: { ...layout.decor },
    },
    ok: true,
  };
}

export function rushBuild(state: GameState, productId: string): ActionResult {
  const job = state.building.find((b) => b.product.id === productId);
  if (!job) return { state, ok: false, reason: "No such build in production." };
  const weeksLeft = job.totalWeeks - job.weeksElapsed;
  if (weeksLeft <= 0) return { state, ok: false, reason: "This run is already finishing." };
  const units = job.plannedUnits ?? BALANCE.build.minRun;
  const cost = Math.round(effectiveUnitCost(state, job.product) * units * BALANCE.build.rushCostPct) as Money;
  if (state.cash < cost) return { state, ok: false, reason: `Need ${format(sub(cost, state.cash))} more to rush the line.` };
  const feed = trimFeed([...state.feed, feedItem(state.week, `Rushed the ${job.product.name} line, one week saved.`, "neutral")]);
  return {
    state: {
      ...state,
      cash: sub(state.cash, cost),
      building: state.building.map((b) => (b === job ? { ...b, weeksElapsed: b.weeksElapsed + 1 } : b)),
      feed,
    },
    ok: true,
  };
}

export function cutProductPrice(state: GameState, productId: string, newPrice: Money): ActionResult {
  const lp = state.launched.find((l) => l.product.id === productId);
  if (!lp) return { state, ok: false, reason: "Product not found." };
  if (lp.weeksElapsed >= lp.weeklyUnits.length) return { state, ok: false, reason: "Product lifecycle has ended." };
  if (newPrice >= lp.product.price) return { state, ok: false, reason: "New price must be lower than current price." };
  if (newPrice < lp.unitCost) return { state, ok: false, reason: "Price can't go below unit cost." };
  if ((lp.priceCuts ?? 0) >= BALANCE.priceCut.maxPerProduct) return { state, ok: false, reason: "This product has been marked down as far as it can go." };

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

/** The effective per-week demand boost for the NEXT marketing push on this product. Diminishes with
 *  each push already run (BALANCE.marketingPush.pushFalloff), so repeat campaigns still help but each
 *  less than the last — keeping it a real decision rather than a spam button. */
function marketingPushBoost(lp: LaunchedProduct): number {
  return BALANCE.marketingPush.boost * Math.pow(BALANCE.marketingPush.pushFalloff, lp.marketingPushes ?? 0);
}

/** A quote for a mid-lifecycle marketing push, or null when there's nothing left to promote (no
 *  surplus inventory), the push cap is reached, or the lifecycle has ended. Pure — drives both the UI
 *  preview and the action, so the number the player sees is the number they pay. */
export function marketingPushQuote(lp: LaunchedProduct): { cost: Money; addedUnits: number } | null {
  if (lp.weeksElapsed >= lp.weeklyUnits.length) return null;
  if ((lp.marketingPushes ?? 0) >= BALANCE.marketingPush.maxPerProduct) return null;
  const cap = lp.plannedUnits ?? lp.totalUnits;
  const eff = marketingPushBoost(lp);
  const boosted = lp.weeklyUnits.map((u, i) => (i < lp.weeksElapsed ? u : Math.round(u * (1 + eff))));
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
  if ((lp.marketingPushes ?? 0) >= BALANCE.marketingPush.maxPerProduct) return { state, ok: false, reason: "This product has had the most marketing pushes it can take." };
  const quote = marketingPushQuote(lp);
  if (!quote) return { state, ok: false, reason: "No unsold inventory left to promote." };
  if (state.cash < quote.cost) return { state, ok: false, reason: `Need ${format(sub(quote.cost, state.cash))} more for the campaign.` };

  const cap = lp.plannedUnits ?? lp.totalUnits;
  const eff = marketingPushBoost(lp);
  const newWeeklyUnits = lp.weeklyUnits.map((u, i) => (i < lp.weeksElapsed ? u : Math.round(u * (1 + eff))));
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

/** Quote a brand-awareness investment: the cost to raise the meter by up to `points` (clamped to the
 *  cap headroom + one-step max), or null if the meter is already full. Cost scales with era. Pure. */
export function investBrandAwarenessQuote(state: GameState, points: number): { cost: Money; points: number } | null {
  const b = BALANCE.brand;
  const current = Math.max(0, Math.min(b.cap, state.brandAwareness ?? 0));
  const pts = Math.max(0, Math.min(Math.floor(points), b.maxStep, Math.floor(b.cap - current)));
  if (pts <= 0) return null;
  const eraMult = 1 + (Math.max(1, state.era) - 1) * b.costPerPointPerEra;
  return { cost: cents(Math.round((b.costPerPoint as number) * eraMult * pts)), points: pts };
}

/** Invest cash in brand awareness — a standing, decaying meter that lifts every future launch's hype. */
export function investBrandAwareness(state: GameState, points: number): ActionResult {
  const quote = investBrandAwarenessQuote(state, points);
  if (!quote) return { state, ok: false, reason: "Brand awareness is already at its peak." };
  if (state.cash < quote.cost) return { state, ok: false, reason: `Need ${format(sub(quote.cost, state.cash))} more for the campaign.` };
  const brandAwareness = Math.min(BALANCE.brand.cap, (state.brandAwareness ?? 0) + quote.points);
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Brand campaign ran — awareness now ${Math.round(brandAwareness)}/${BALANCE.brand.cap}.`, "accent"));
  return { state: { ...state, cash: sub(state.cash, quote.cost), brandAwareness, feed: trimFeed(feed) }, ok: true };
}

/** A quote for restocking (reordering) a launched product, or null when it can't be restocked
 *  (lifecycle ended, reorder cap reached, or the market has no meaningful unmet demand left).
 *  DEMAND-CAPPED: maxUnits is how many more the current market still wants beyond what's already
 *  scheduled to sell (planProduction.totalDemand − totalUnits), so a restock captures unmet demand
 *  and can never print money. Pure — drives both the UI stepper bounds and the action. */
export function restockQuote(s: GameState, lp: LaunchedProduct): { maxUnits: number; unitCost: Money } | null {
  if (lp.weeksElapsed >= lp.weeklyUnits.length) return null;            // lifecycle ended
  if ((lp.restocks ?? 0) >= BALANCE.restock.maxPerProduct) return null; // reorder cap reached
  const channelId = (lp.product.channelId ?? "none") as ChannelId;
  // Estimate the market's true appetite for this product WITHOUT counting it against itself: its own
  // active listing would otherwise trigger self-cannibalization + market-fatigue penalties on the very
  // product we're reordering, wrongly collapsing the demand a restock is meant to meet.
  const sansSelf: GameState = { ...s, launched: s.launched.filter((l) => l.product.id !== lp.product.id) };
  const plan = planProduction(sansSelf, lp.product, lp.plannedUnits ?? lp.totalUnits, channelId);
  const headroom = Math.max(0, Math.round(plan.totalDemand) - lp.totalUnits);
  if (headroom < BALANCE.build.minRun) return null;                    // not enough unmet demand to bother
  return { maxUnits: headroom, unitCost: effectiveUnitCost(s, lp.product) };
}

/** Restock (reorder) a launched product: fund another production run to meet demand you under-supplied
 *  instead of leaving a sell-out's revenue on the table. Appends a fresh sales wave (distributeOverCurve)
 *  from the current week and raises the product's supply + forecast, bounded by restockQuote's demand
 *  cap, so lifetime sales can never exceed what the market actually wants. No new tooling (the line is
 *  already set up) — you pay pure per-unit production. Opt-in: the pinned sim never calls this. */
export function restockProduct(state: GameState, productId: string, units: number): ActionResult {
  const idx = state.launched.findIndex((l) => l.product.id === productId);
  if (idx < 0) return { state, ok: false, reason: "Product not found." };
  const lp = state.launched[idx];
  const quote = restockQuote(state, lp);
  if (!quote) return { state, ok: false, reason: "There's no unmet demand left to restock." };
  const want = Math.min(Math.max(0, Math.floor(units)), quote.maxUnits);
  if (want < BALANCE.build.minRun) return { state, ok: false, reason: `Restock at least ${BALANCE.build.minRun.toLocaleString()} units.` };
  const cost = scale(quote.unitCost, want);
  if (state.cash < cost) return { state, ok: false, reason: `Need ${format(sub(cost, state.cash))} more to restock.` };
  // A fresh wave of sales for the added units, overlaid onto the curve from the current week (renewed
  // availability). distributeOverCurve sums to exactly `want`, so sell-through stays honest.
  const wave = distributeOverCurve(want);
  const weeklyUnits = [...lp.weeklyUnits];
  for (let i = 0; i < wave.length; i++) {
    const at = lp.weeksElapsed + i;
    weeklyUnits[at] = (weeklyUnits[at] ?? 0) + wave[i];
  }
  const launched = [...state.launched];
  launched[idx] = {
    ...lp,
    weeklyUnits,
    totalUnits: lp.totalUnits + want,
    plannedUnits: (lp.plannedUnits ?? lp.totalUnits) + want,
    restocks: (lp.restocks ?? 0) + 1,
  };
  const feed = trimFeed([...state.feed, feedItem(state.week, `Restocked “${lp.product.name}” — ${want.toLocaleString()} more units on the line to meet demand.`, "accent")]);
  return { state: { ...state, cash: sub(state.cash, cost), launched, feed }, ok: true };
}

/** How the player answers a Rival Strike. All three are OPT-IN (the pinned sim never calls this),
 *  so the strike system adds pressure the player can feel without moving the tuned baseline. */
export type StrikeResponse = "price" | "campaign" | "hold";

/** Answer the pending Rival Strike:
 *  - "price": cut the contested product's price by strike.priceCutFrac via the ordinary
 *    cutProductPrice path (same one-cut-per-product rule; demand recovers through priceFit).
 *  - "campaign": run the ordinary marketingPush at a strike discount (the moment is the deal).
 *  - "hold": spend nothing; if your product genuinely outclasses theirs, the market notices
 *    (+holdRepBonus reputation) — refusing to blink is a real strategy, not a dismissal.
 *  Any resolution clears the interrupt and starts the cooldown. */
export function resolveStrike(state: GameState, choice: StrikeResponse): ActionResult {
  const strike = state.pendingStrike;
  if (!strike) return { state, ok: false, reason: "No rival strike to answer." };
  const cfg = BALANCE.market.competition.strike;
  const cleared: GameState = { ...state, pendingStrike: null, lastStrikeWeek: state.week };
  const feedLine = (g: GameState, text: string, tone: FeedTone): GameState => {
    const feed = [...g.feed];
    feed.push(feedItem(state.week, text, tone));
    return { ...g, feed: trimFeed(feed) };
  };

  if (choice === "hold") {
    if (strike.playerOverall >= strike.rivalOverall) {
      return {
        state: feedLine(
          { ...cleared, reputation: Math.min(100, cleared.reputation + cfg.holdRepBonus) },
          `You held the line: ${strike.productName} outclasses ${strike.rivalProductName}, and the market noticed.`,
          "positive",
        ),
        ok: true,
      };
    }
    return {
      state: feedLine(cleared, `You held the line against ${strike.rivalName}. Time will tell.`, "neutral"),
      ok: true,
    };
  }

  if (choice === "price") {
    const lp = state.launched.find((l) => l.product.id === strike.productId);
    if (!lp) return { state, ok: false, reason: "That product is no longer selling." };
    const newPrice = Math.max(lp.unitCost, Math.round(lp.product.price * (1 - cfg.priceCutFrac))) as Money;
    const res = cutProductPrice(cleared, strike.productId, newPrice);
    if (!res.ok) return { state, ok: false, reason: res.reason };
    return { state: feedLine(res.state, `Price answered ${strike.rivalName}'s move on ${strike.productName}.`, "accent"), ok: true };
  }

  // "campaign" — the ordinary push, at the strike discount (refund the difference on top of the
  // normal charge so marketingPush stays the single source of the demand math).
  const lp = state.launched.find((l) => l.product.id === strike.productId);
  if (!lp) return { state, ok: false, reason: "That product is no longer selling." };
  const quote = marketingPushQuote(lp);
  if (!quote) return { state, ok: false, reason: "No unsold inventory left to promote." };
  const refund = cents(Math.round(quote.cost * cfg.campaignDiscount));
  const discounted = sub(quote.cost, refund);
  if (state.cash < discounted) return { state, ok: false, reason: `Need ${format(sub(discounted, state.cash))} more for the counter-campaign.` };
  // Prime the discount BEFORE the ordinary push so its full-price cash gate can't refuse a player
  // who can afford the discounted rate — net charge = quote.cost − refund exactly.
  const primed: GameState = { ...cleared, cash: add(cleared.cash, refund) };
  const res = marketingPush(primed, strike.productId);
  if (!res.ok) return { state, ok: false, reason: res.reason };
  return {
    state: feedLine(
      res.state,
      `Counter-campaign fired back at ${strike.rivalName} — booked at ${Math.round(cfg.campaignDiscount * 100)}% off.`,
      "accent",
    ),
    ok: true,
  };
}

/** Collect the pending Silicon Awards: each category the player WON pays +2 reputation and +800
 *  fans; a shutout still clears the stage with a feed note (losing on stage to a named rival is
 *  the content). Player-opt-in — the pinned sim never collects, so the baseline is untouched. */
export const AWARD_REP_BONUS = 2;
export const AWARD_FANS_BONUS = 800;
export function collectAwards(state: GameState): GameState {
  const ceremony = state.pendingAwards;
  if (!ceremony) return state;
  const feed = [...state.feed];
  if (ceremony.playerWins > 0) {
    const titles = ceremony.winners.filter((w) => w.byPlayer).map((w) => w.title).join(", ");
    feed.push(feedItem(state.week, `The Silicon Awards: you took ${titles} against a field of ${ceremony.fieldSize}.`, "positive"));
    return {
      ...state,
      pendingAwards: null,
      reputation: Math.min(100, state.reputation + AWARD_REP_BONUS * ceremony.playerWins),
      fans: state.fans + AWARD_FANS_BONUS * ceremony.playerWins,
      feed: trimFeed(feed),
    };
  }
  const device = ceremony.winners.find((w) => w.categoryId === "device");
  feed.push(feedItem(state.week, `The Silicon Awards went to the rivals this year${device ? ` — ${device.companyName}'s ${device.productName} took Device of the Year` : ""}.`, "neutral"));
  return { ...state, pendingAwards: null, feed: trimFeed(feed) };
}

/** Take the client commission on offer. Gates mirror the card's UI: a wired line, the machines
 *  the job calls for, and only one commission at a time. No upfront cost — the line IS the bet
 *  (your own builds run +1 week while it's occupied). */
export function acceptSideOrder(state: GameState): ActionResult {
  const offer = state.pendingSideOrder;
  if (!offer) return { state, ok: false, reason: "No commission on the table." };
  if (state.week > offer.expiresWeek) return { state, ok: false, reason: "The offer has expired." };
  if (state.activeSideOrder) return { state, ok: false, reason: "The line is already running a commission." };
  if (!lineComplete(state.factoryFloor)) return { state, ok: false, reason: "Wire Intake → Packer first — the client needs a working line." };
  const missing = sideOrderMissingKinds(state.factoryFloor.machines.map((m) => m.kind), offer);
  if (missing.length > 0) return { state, ok: false, reason: `Needs a ${MACHINE_DEFS[missing[0]].name} on the floor.` };
  const { expiresWeek: _drop, ...rest } = offer;
  void _drop;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Signed ${offer.clientName}'s order: ${offer.units.toLocaleString()} units in ${offer.weeksNeeded} weeks, ${format(sideOrderPayout(offer))} on delivery.`, "accent"));
  return {
    state: { ...state, pendingSideOrder: null, activeSideOrder: { ...rest, startedWeek: state.week }, feed: trimFeed(feed) },
    ok: true,
  };
}

/** Pass on the offer — no fee, the client shops elsewhere. */
export function declineSideOrder(state: GameState): GameState {
  if (!state.pendingSideOrder) return state;
  return { ...state, pendingSideOrder: null };
}

/** Walk out on a RUNNING commission — the client bills a cancellation fee (a fraction of the
 *  payout). The escape hatch when your own launch suddenly matters more. */
export function cancelSideOrder(state: GameState): ActionResult {
  const active = state.activeSideOrder;
  if (!active) return { state, ok: false, reason: "No commission is running." };
  const penalty = Math.round(sideOrderPayout(active) * SIDE_ORDER_CANCEL_PCT) as Money;
  if (state.cash < penalty) return { state, ok: false, reason: `Need ${format(sub(penalty, state.cash))} more to buy out the contract.` };
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Cancelled ${active.clientName}'s order — ${format(penalty)} cancellation fee.`, "negative"));
  return { state: { ...state, activeSideOrder: null, cash: sub(state.cash, penalty), feed: trimFeed(feed) }, ok: true };
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

/** The company's NET WORTH in CENTS — the size/valuation signal that scales financing so a large
 *  company can borrow proportionally more (engine/financing.ts). */
function netWorthCents(state: GameState): number {
  return Math.round(toDollars(netWorth(state)) * 100);
}

/** Operational weekly PROFIT in CENTS (revenue − burn, before debt service) — the cash-flow signal
 *  that lifts credit for a profitable company. Negative profit contributes nothing (clamped in the
 *  engine). */
function weeklyProfitCents(state: GameState): number {
  return Math.round(toDollars(sub(nextWeekRevenue(state), burn(state))) * 100);
}

/** How much the player can still borrow right now (Money). Exposed for the financing UI. */
export function loanCreditAvailable(state: GameState): Money {
  return cents(creditLimit(weeklyRevenueCents(state), state.loans ?? [], netWorthCents(state), weeklyProfitCents(state)));
}

/** The weekly interest rate the player would be offered for a new loan right now (0..1). */
export function loanRateNow(state: GameState): number {
  return loanRate(state.reputation, weeklyRevenueCents(state), state.loans ?? [], netWorthCents(state), weeklyProfitCents(state));
}

/** Take on a debt-financing loan (Track C): receive the principal (less a small origination fee) as
 *  cash now, in exchange for fixed weekly debt service amortized over the term. Rejected if bankrupt,
 *  below the minimum, or beyond the current credit limit. */
export function takeLoan(state: GameState, principalCents: number): GameState {
  if (state.bankrupt) return state;
  const loans = state.loans ?? [];
  const f = BALANCE.financing;
  const principal = Math.round(principalCents);
  const nwCents = netWorthCents(state);
  const profitCents = weeklyProfitCents(state);
  const limit = creditLimit(weeklyRevenueCents(state), loans, nwCents, profitCents);
  if (principal < f.minLoan || principal > limit) return state;
  const loan = makeLoan(`loan-${state.week}-${loans.length}`, principal, state.reputation, weeklyRevenueCents(state), loans, state.week, nwCents, profitCents);
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

// ---------- Timed research (the active slot + a queue) ----------
// The live game researches through these; researchNext/buyProject above stay as the instant primitives
// (tests + the auto-research delegation use them). One research DEVELOPS at a time (the progress ring),
// paid up front; buying more lines them up in a QUEUE and each auto-starts when it reaches the front.
// Rule: a component line / project can be active OR queued at most once (keeps tier costs simple).

/** Weeks a research of `rpCost` takes to complete — cost-scaled, clamped to the tuned band. */
export function researchWeeksFor(rpCost: number): number {
  const t = BALANCE.research.timer;
  return Math.max(t.minWeeks, Math.min(t.maxWeeks, Math.round(rpCost / t.rpPerWeek)));
}

/** Is the lab currently developing a research? */
export const researchBusy = (s: GameState): boolean => (s.activeResearch ?? null) !== null;
/** The researches lined up behind the active one (never undefined). */
export const researchQueueList = (s: GameState): QueuedResearch[] => s.researchQueue ?? [];
/** Is the queue at capacity (so nothing more can be lined up)? */
export const researchQueueFull = (s: GameState): boolean => researchQueueList(s).length >= BALANCE.research.timer.maxQueue;

export type ResearchSlotStatus = "active" | "queued" | null;
/** Whether a component line is currently developing, waiting in the queue, or neither (for the UI). */
export function tierResearchStatus(s: GameState, kind: ComponentKind): ResearchSlotStatus {
  if (s.activeResearch?.kind === "tier" && s.activeResearch.ref === kind) return "active";
  return researchQueueList(s).some((q) => q.kind === "tier" && q.ref === kind) ? "queued" : null;
}
/** Whether a project is currently developing, waiting in the queue, or neither (for the UI). */
export function projectResearchStatus(s: GameState, id: ProjectId): ResearchSlotStatus {
  if (s.activeResearch?.kind === "project" && s.activeResearch.ref === id) return "active";
  return researchQueueList(s).some((q) => q.kind === "project" && q.ref === id) ? "queued" : null;
}

/** Whole weeks remaining on the active research (0 when idle or finishing this week). */
export function researchWeeksLeft(s: GameState): number {
  const a = s.activeResearch;
  if (!a) return 0;
  return Math.max(0, a.totalWeeks - (s.week - a.startWeek));
}

/** Place a paid research spec: start it if the lab is idle, else append it to the queue. Returns the
 *  original state (no-op) if the queue is full. Shared by the tier + project entry points. */
function placeResearch(state: GameState, spec: QueuedResearch): GameState {
  if (!state.activeResearch) {
    return {
      ...state,
      researchPoints: state.researchPoints - spec.rpCost,
      activeResearch: { ...spec, startWeek: state.week },
      feed: trimFeed([...state.feed, feedItem(state.week, `The lab started developing ${spec.name}.`, "accent")]),
    };
  }
  if (researchQueueFull(state)) return state;
  return {
    ...state,
    researchPoints: state.researchPoints - spec.rpCost,
    researchQueue: [...researchQueueList(state), spec],
    feed: trimFeed([...state.feed, feedItem(state.week, `Queued research: ${spec.name}.`, "accent")]),
  };
}

/** Start — or queue — the next tier of a component line (timed). Pays the RP up front. No-op if the
 *  line is already active/queued, it's maxed, the queue is full, or you can't afford it. */
export function startResearchTier(state: GameState, kind: ComponentKind): GameState {
  if (tierResearchStatus(state, kind) !== null) return state; // already active or queued
  const cost = rdRpCostFor(state, kind);
  if (cost === null || state.researchPoints < cost) return state;
  const next = researchedTier(state, kind) + 1;
  const def = tierDef(kind, next);
  if (!def) return state;
  return placeResearch(state, {
    kind: "tier", ref: kind, tierLevel: next, name: def.name,
    blurb: `A stronger ${kind} tier for everything you build next.`,
    rpCost: cost, totalWeeks: researchWeeksFor(cost),
  });
}

/** Start — or queue — a company research project (timed). Pays the RP up front. No-op if it's already
 *  active/queued/owned, fork-locked, too advanced, the queue is full, or you can't afford it. */
export function startResearchProject(state: GameState, id: ProjectId): GameState {
  if (projectResearchStatus(state, id) !== null) return state; // already active or queued
  if (hasProject(state.completedProjects, id)) return state;
  const proj = projectById(id);
  if (proj.era > state.era || state.researchPoints < proj.rpCost) return state;
  if (forkLockedBy(state.completedProjects, id)) return state;
  return placeResearch(state, {
    kind: "project", ref: id, name: proj.name, blurb: proj.blurb,
    rpCost: proj.rpCost, totalWeeks: researchWeeksFor(proj.rpCost),
  });
}

/** Cancel the ACTIVE research (refund the RP) and pull the next queued item up to develop, if any. */
export function cancelResearch(state: GameState): GameState {
  const a = state.activeResearch;
  if (!a) return state;
  const [nextUp, ...rest] = researchQueueList(state);
  const nextActive = nextUp ? { ...nextUp, startWeek: state.week } : null;
  const feed = trimFeed([...state.feed, feedItem(state.week,
    `Shelved research: ${a.name}. RP refunded.${nextActive ? ` Now developing ${nextActive.name}.` : ""}`, "neutral")]);
  return { ...state, researchPoints: state.researchPoints + a.rpCost, activeResearch: nextActive, researchQueue: rest, feed };
}

/** Remove a QUEUED research (refund the RP). No-op if `ref` isn't in the queue. */
export function cancelQueuedResearch(state: GameState, ref: string): GameState {
  const queue = researchQueueList(state);
  const item = queue.find((q) => q.ref === ref);
  if (!item) return state;
  const feed = trimFeed([...state.feed, feedItem(state.week, `Removed ${item.name} from the research queue. RP refunded.`, "neutral")]);
  return { ...state, researchPoints: state.researchPoints + item.rpCost, researchQueue: queue.filter((q) => q.ref !== ref), feed };
}

// Late-game repeatable RP sink: once the tree (and component tiers) are bought out, RP would
// otherwise accrue forever with nothing to do. A developer keynote converts research momentum
// into audience — fans + a point of reputation — repeatable at a real price, so an R&D-heavy
// endgame company always has a lever to pull. Deterministic (no RNG); the sim never calls it.
export const KEYNOTE_RP_COST = 150;
export const KEYNOTE_FANS = 400;
export const KEYNOTE_REP = 1;

/** Host a developer keynote: spend RP, gain fans + reputation (capped at 100). Repeatable. */
export function hostKeynote(state: GameState): GameState {
  if (state.researchPoints < KEYNOTE_RP_COST) return state;
  const feed = trimFeed([...state.feed, feedItem(state.week, `Hosted a developer keynote — the community showed up.`, "positive")]);
  return {
    ...state,
    researchPoints: state.researchPoints - KEYNOTE_RP_COST,
    fans: state.fans + KEYNOTE_FANS,
    reputation: Math.min(100, state.reputation + KEYNOTE_REP),
    feed,
  };
}

// ---------- Office builder (furniture layout) ----------
export function placeFurniture(state: GameState, type: FurnitureId, c: number, r: number, rot: Rot): GameState {
  const cost = dollars(furnitureCost(type));
  if (state.cash < cost) return state; // can't afford — no-op (the UI surfaces "Need $X")
  const iid = `f${state.furnitureCounter}`;
  const layout = addFurniture(state.layout, iid, type, c, r, rot, state.facilityTier);
  if (layout === state.layout) return state; // rejected (overlap / out of bounds) — no charge
  return { ...state, cash: sub(state.cash, cost), layout, furnitureCounter: state.furnitureCounter + 1 };
}
export function moveFurniture(state: GameState, iid: string, c: number, r: number): GameState {
  const layout = moveFurnitureOp(state.layout, iid, c, r, state.facilityTier);
  return layout === state.layout ? state : { ...state, layout };
}
export function rotateFurniture(state: GameState, iid: string): GameState {
  const layout = rotateFurnitureOp(state.layout, iid, state.facilityTier);
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
    if (canPlace(state.layout, it.type, c, r, it.rot, undefined, state.facilityTier)) {
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
/** Repaint the factory building (wall paint + floor finish palette indices). */
export function setFactoryDecor(state: GameState, patch: Partial<{ wall: number; floor: number }>): GameState {
  return { ...state, factoryDecor: { ...state.factoryDecor, ...patch } };
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

export interface NavAttention { hq: boolean; design: boolean; research: boolean; market: boolean; company: boolean }

/** Where is there something ACTIONABLE right now? Drives the bottom-nav "attention" dots so a player
 *  is never left wondering what to do next. Read-only + cheap; each flag is a genuine decision the
 *  player can act on this moment (not an always-on nag). */
export function navAttention(s: GameState): NavAttention {
  const shipped = s.launched.length >= 1;
  const cash = s.cash as number;
  return {
    // A milestone or a personal decision waiting at HQ.
    hq: canAdvance(s) || canIPO(s) || s.pendingChoice != null || (s.pendingPoach ?? null) != null,
    // Pipeline idle once you're rolling → design the next product.
    design: shipped && s.building.length === 0 && s.ready.length === 0,
    // A project or component upgrade you can afford right now.
    research: researchReady(s),
    // A new region you can afford to open.
    market: REGIONS.some((r) => !s.unlockedRegions.includes(r.id) && cash >= (r.unlockCost as number)),
    // A licensing contract to sign, an OS version to ship, or the platform to found.
    company: (s.pendingLicenseOffer ?? null) != null || (s.platformUnlocked && canReleaseOsVersion(s)) || canFoundPlatform(s),
  };
}

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
  const sc = BALANCE.platform.security;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `${osDisplayName(state)} ${newVersion}.0 released, the installed base updated. +${reward.fans.toLocaleString()} fans.`, "positive"));
  return {
    ...state,
    osVersion: newVersion,
    reputation: Math.min(100, state.reputation + reward.reputation),
    fans: state.fans + reward.fans,
    // A full release is also the biggest security event there is: it wipes the current threat and
    // hardens the platform, and counts as a patch for the cooldown (you just shipped the newest build).
    osThreat: clampSecurity((state.osThreat ?? 0) * (1 - sc.releaseThreatClear)),
    osSecurity: clampSecurity((state.osSecurity ?? 0) + sc.releaseSecurityGain),
    lastPatchWeek: state.week,
    feed: trimFeed(feed),
  };
}

/** Ship a security patch — the immersive "update" action. Clears most of the current threat, hardens
 *  the platform, and earns a little goodwill. On a cooldown so it's a deliberate, periodic ritual, not
 *  a spam button. No-op unless the division is unlocked and the cooldown has elapsed. */
export function shipSecurityPatch(state: GameState): ActionResult {
  if (!state.platformUnlocked) return { state, ok: false, reason: "Found the Platform division first." };
  const left = patchCooldownLeft(state.week, state.lastPatchWeek);
  if (left > 0) return { state, ok: false, reason: `Next patch ready in ${left} week${left === 1 ? "" : "s"}.` };
  const sc = BALANCE.platform.security;
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Shipped a ${osDisplayName(state)} security update, threats patched and the platform hardened.`, "positive"));
  return {
    state: {
      ...state,
      osThreat: clampSecurity((state.osThreat ?? 0) * (1 - sc.patchThreatClear)),
      osSecurity: clampSecurity((state.osSecurity ?? 0) + sc.patchSecurityGain),
      reputation: Math.min(100, state.reputation + sc.patchRepBonus),
      fans: state.fans + sc.patchFanBonus,
      lastPatchWeek: state.week,
      feed: trimFeed(feed),
    },
    ok: true,
  };
}

/** Total weekly licensing fees from all rivals currently licensing your OS (fee scales with each
 *  rival's reputation × your OS tier). */
export function weeklyLicenseFees(s: GameState): Money {
  if (s.osLicensees.length === 0) return ZERO;
  const tier = osTierInfo(s).tier;
  const exclusive = s.osExclusive ?? {};
  const exMult = BALANCE.platform.contract.exclusiveRoyaltyMult;
  let acc = ZERO;
  for (const id of s.osLicensees) {
    const rival = s.competitors.find((c) => c.id === id);
    if (!rival) continue;
    const fee = rivalLicenseFee(rival.reputation, tier);
    acc = add(acc, id in exclusive ? scale(fee, exMult) : fee);
  }
  return acc;
}

/** Sign the inbound licensing contract on the table: bank the upfront signing bonus, add the suitor
 *  as a licensee (recurring royalty + churn like any other), and record the category as exclusive
 *  when the deal demanded it. No-op if there's no offer or the division isn't unlocked. */
export function signLicenseOffer(state: GameState): ActionResult {
  const offer = state.pendingLicenseOffer ?? null;
  if (!offer || !state.platformUnlocked) return { state, ok: false, reason: "No contract to sign." };
  if (state.osLicensees.includes(offer.rivalId)) return { state, ok: false, reason: "Already a licensee." };
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `Signed ${offer.rivalName} to ${offer.exclusive ? "an exclusive " : "a "}${osDisplayName(state)} licence — ${format(offer.signingBonus)} upfront, ${format(offer.royaltyPerWeek)}/wk.`, "positive"));
  return {
    state: {
      ...state,
      cash: add(state.cash, offer.signingBonus),
      osLicensees: [...state.osLicensees, offer.rivalId],
      osLicenseeHealth: { ...state.osLicenseeHealth, [offer.rivalId]: BALANCE.platform.licenseeChurn.startHealth },
      osExclusive: offer.exclusive ? { ...(state.osExclusive ?? {}), [offer.rivalId]: offer.category } : (state.osExclusive ?? {}),
      pendingLicenseOffer: null,
      feed: trimFeed(feed),
    },
    ok: true,
  };
}

/** Walk away from the inbound offer — it lapses with no cost. */
export function declineLicenseOffer(state: GameState): ActionResult {
  if (!state.pendingLicenseOffer) return { state, ok: false, reason: "No contract to decline." };
  return { state: { ...state, pendingLicenseOffer: null }, ok: true };
}

/** Push the inbound offer for a bigger signing bonus — a ONE-shot, deterministic gamble (engine's
 *  resolveNegotiation, salt 163). The suitor either sweetens the bonus, holds firm (original terms
 *  stay signable), or WALKS (the offer is pulled). No-op if there's no offer, the division isn't
 *  unlocked, or this offer has already been negotiated. Returns the outcome for the reveal. */
export function negotiateLicenseOffer(state: GameState): ActionResult {
  const offer = state.pendingLicenseOffer ?? null;
  if (!offer || !state.platformUnlocked) return { state, ok: false, reason: "No contract to negotiate." };
  if (offer.negotiated) return { state, ok: false, reason: "You've already pushed this deal." };
  const res = resolveNegotiation(state.seed, offer);
  const feed = [...state.feed];
  if (res.outcome === "walked") {
    feed.push(feedItem(state.week, `${offer.rivalName} walked away from the ${osDisplayName(state)} deal — you pushed too hard.`, "negative"));
    return { state: { ...state, pendingLicenseOffer: null, feed: trimFeed(feed) }, ok: true, negotiationOutcome: "walked", negotiationBonusDelta: ZERO };
  }
  if (res.outcome === "improved") {
    feed.push(feedItem(state.week, `${offer.rivalName} sweetened the ${osDisplayName(state)} deal — signing bonus up to ${format(res.signingBonus)}.`, "positive"));
    return {
      state: { ...state, pendingLicenseOffer: { ...offer, signingBonus: res.signingBonus, negotiated: true }, feed: trimFeed(feed) },
      ok: true, negotiationOutcome: "improved", negotiationBonusDelta: res.bonusDelta,
    };
  }
  // Held firm: the original terms remain on the table; you just can't push again.
  feed.push(feedItem(state.week, `${offer.rivalName} held firm on the ${osDisplayName(state)} deal — the original terms stand.`, "neutral"));
  return { state: { ...state, pendingLicenseOffer: { ...offer, negotiated: true }, feed: trimFeed(feed) }, ok: true, negotiationOutcome: "firm", negotiationBonusDelta: ZERO };
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

// ---- Living App Store + Security (the immersive OS layer) ----
/** Apps published to your App Store (0 unless the division is live). */
export const platformAppCount = (s: GameState): number => (s.platformUnlocked ? Math.floor(s.osApps ?? 0) : 0);
/** Whether the App Store is open for business (the App Marketplace module is installed). */
export const appStoreOpen = (s: GameState): boolean => s.platformUnlocked && s.osFeatures.includes("appMarket");
/** Current OS threat pressure (0..100), 0 unless the division is live. */
export const osThreatLevel = (s: GameState): number => (s.platformUnlocked ? clampSecurity(s.osThreat ?? 0) : 0);
/** Current OS security hardening (0..100), 0 unless the division is live. */
export const osSecurityRating = (s: GameState): number => (s.platformUnlocked ? clampSecurity(s.osSecurity ?? 0) : 0);
/** Net security exposure (0..100) — how far current threat outruns your hardening. */
export const osNetExposure = (s: GameState): number => (s.platformUnlocked ? netExposure(s.osThreat ?? 0, s.osSecurity ?? 0) : 0);
/** Weeks until another security patch can ship (0 = ready). */
export const securityPatchCooldownLeft = (s: GameState): number => patchCooldownLeft(s.week, s.lastPatchWeek);
/** Can a security patch ship right now (division live + cooldown elapsed)? */
export const canShipSecurityPatch = (s: GameState): boolean => s.platformUnlocked && securityPatchCooldownLeft(s) <= 0;

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

function hireCostFor(role: StaffRole, skill: number, discounted = false): Money {
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
    hiredWeek: state.week,
    ...identity,
    bio: staffBio(identity.trait, identity.specialty, state.staffCounter),
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
  return hireStaff(state, role, SPECIALIST_SKILL, staffName(state.staffCounter));
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
      id: `c${counter}`,
      role,
      name: staffName(counter),
      skill: headline,
      skills,
      salary: salaryFor(role, headline),
      hireFee: hireCostFor(role, headline, hasProject(state.completedProjects, "talentNetwork")),
      ...identity,
      bio: staffBio(identity.trait, identity.specialty, counter),
    });
    counter++;
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
    hiredWeek: state.week,
    specialty: cand.specialty,
    trait: cand.trait,
    mood: cand.mood,
    appearance: cand.appearance,
    bio: cand.bio,
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

/** "Skip to next decision" — did this week's tick produce something that needs the player's
 *  input? Returns a short reason to show when time auto-pauses, or null to keep skipping.
 *  PURE prev→next diff; the checks mirror the moments the UI already treats as decision points
 *  (ready shelf, choice/poach cards, era goal, finished sales runs, the red low-runway HUD). */
export function skipInterrupt(prev: GameState, next: GameState): string | null {
  if (next.ready.length > prev.ready.length) return "A build is ready to launch";
  if (!prev.pendingChoice && next.pendingChoice) return "An event needs your call";
  if (!prev.pendingPoach && next.pendingPoach) return "A rival is poaching your staff";
  if (!prev.pendingStrike && next.pendingStrike) return "A rival is attacking your product";
  if (!prev.pendingSideOrder && next.pendingSideOrder) return "A client wants your factory line";
  if (!prev.pendingAwards && next.pendingAwards) return "The Silicon Awards ceremony";
  // A paid-for recruiter shortlist EXPIRES — skipping past its arrival would waste the fee.
  if (next.candidates.length > 0 && prev.candidates.length === 0) return "Your recruiter's shortlist arrived";
  if (!canAdvance(prev) && canAdvance(next)) return "Era goal reached";
  const finished = (s: GameState) => s.launched.filter((l) => l.weeksElapsed >= l.weeklyUnits.length).length;
  if (finished(next) > finished(prev)) return "A product finished its run";
  const lowRunway = (s: GameState) => {
    const b = toDollars(weeklyOutflow(s));
    return b > 0 && toDollars(s.cash) / b < 4;
  };
  if (!lowRunway(prev) && lowRunway(next)) return "Cash is running low";
  return null;
}

/** An affordable, unlocked research PROJECT is waiting — drives the nav badge on the Research
 *  tab so a player grinding weeks on another screen learns RP crossed a threshold. Projects only
 *  (not component tiers): tiers are near-continuously affordable mid-game and would make the
 *  badge a permanent nag instead of a signal. */
export function researchReady(state: GameState): boolean {
  const rp = Math.floor(state.researchPoints);
  return RESEARCH_PROJECTS.some(
    (p) => p.era <= state.era && !state.completedProjects.includes(p.id) && rp >= p.rpCost && !forkLockedBy(state.completedProjects, p.id),
  );
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

/** The player's strongest category — the one their launches have sold the most units in (their main
 *  line), defaulting to phone. Drives where the arch-rival aims its launches. Pure. */
export function playerTopCategory(s: GameState): CategoryId {
  const units = new Map<CategoryId, number>();
  for (const lp of s.launched) units.set(lp.product.category, (units.get(lp.product.category) ?? 0) + lp.unitsSold);
  let best: CategoryId = "phone";
  let bestN = -1;
  for (const [cat, n] of units) if (n > bestN) { best = cat; bestN = n; }
  return best;
}

/** The arch-rival's live competitor state (null if none, or if it's been acquired/removed). */
export const nemesisRival = (s: GameState): CompetitorState | null =>
  s.nemesis ? s.competitors.find((c) => c.id === s.nemesis!.rivalId) ?? null : null;

/** Is this rival the player's arch-rival? */
export const isNemesis = (s: GameState, rivalId: string): boolean => (s.nemesis?.rivalId ?? null) === rivalId;

/** Dismiss the "rivalry declared" reveal (the moment has been seen). Clears the transient flag only. */
export function dismissRivalry(state: GameState): GameState {
  if (!state.pendingRivalry) return state;
  return { ...state, pendingRivalry: null };
}

// ---- Living fan community ----
export interface CommunitySnapshot { sentiment: number; superfans: number; tier: MoodTier; label: string; moment: string; }
/** A read-only snapshot of the fan community's mood for the HQ panel (mood tier + superfans + a rotating
 *  community-moment line). Pure; the moment uses a derived hash, never the sim RNG. */
export function communitySnapshot(s: GameState): CommunitySnapshot {
  const sentiment = s.fanSentiment ?? 0;
  const tier = moodTier(sentiment);
  return { sentiment, superfans: s.superfans ?? 0, tier, label: MOOD_LABEL[tier], moment: communityMoment(s.seed, s.week, sentiment) };
}

// ---- Eureka R&D breakthroughs ----
/** The R&D "insight building" gauge (0..1) for the Research banner. */
export const eurekaInsight = (s: GameState): number => insightProgress(s.week, s.lastEurekaWeek);
/** How many staff are currently assigned to R&D (an active lab). */
export const rndStaffCount = (s: GameState): number => s.staff.filter((x) => x.assignment === "rnd").length;

export interface EurekaResult { ok: boolean; jackpot?: boolean; rp?: number; reason?: string; }

/** Resolve the breakthrough on the table. "bank" takes the guaranteed RP; "chase" rolls the prototype
 *  gamble (a deterministic hash on the moment's week) for a jackpot or a fizzle, with a little rep/fans
 *  on a jackpot. No-op if nothing's pending. Returns the outcome so the UI can stage the reveal. */
export function resolveEureka(state: GameState, choice: "bank" | "chase"): { state: GameState; result: EurekaResult } {
  const moment = state.pendingEureka ?? null;
  if (!moment) return { state, result: { ok: false, reason: "No breakthrough to resolve." } };
  const eu = BALANCE.research.eureka;
  const feed = [...state.feed];
  if (choice === "bank") {
    feed.push(feedItem(state.week, `Banked the ${moment.componentKind} breakthrough, +${moment.bankRp} RP to the lab.`, "positive"));
    return {
      state: { ...state, researchPoints: state.researchPoints + moment.bankRp, pendingEureka: null, feed: trimFeed(feed) },
      result: { ok: true, jackpot: false, rp: moment.bankRp },
    };
  }
  const outcome = resolveEurekaChase(state.seed, moment);
  if (outcome.jackpot) {
    feed.push(feedItem(state.week, `The prototype worked, a genuine ${moment.componentKind} breakthrough. +${outcome.rp} RP, and word gets out.`, "positive"));
    return {
      state: {
        ...state,
        researchPoints: state.researchPoints + outcome.rp,
        reputation: Math.min(BALANCE.reputation.max, state.reputation + eu.jackpotRepBonus),
        fans: state.fans + eu.jackpotFanBonus,
        pendingEureka: null,
        feed: trimFeed(feed),
      },
      result: { ok: true, jackpot: true, rp: outcome.rp },
    };
  }
  feed.push(feedItem(state.week, `The prototype fizzled, only +${outcome.rp} RP salvaged. Should've banked it.`, "neutral"));
  return {
    state: { ...state, researchPoints: state.researchPoints + outcome.rp, pendingEureka: null, feed: trimFeed(feed) },
    result: { ok: true, jackpot: false, rp: outcome.rp },
  };
}

// ---- Staff growth moments ----
export interface StaffMomentResult { ok: boolean; reason?: string; kind?: string; staffName?: string; }

/** Resolve the staff growth moment on the table: apply the CHOSEN option (index into moment.options)
 *  to the target staffer as a permanent character upgrade. No-op if nothing's pending or the target
 *  has since left. Player-opt-in, so the pinned sim never calls it → byte-identical. */
export function resolveStaffMoment(state: GameState, optionIndex: number): { state: GameState; result: StaffMomentResult } {
  const moment = state.pendingStaffMoment ?? null;
  if (!moment) return { state, result: { ok: false, reason: "No growth moment to resolve." } };
  const opt = moment.options[optionIndex];
  if (!opt) return { state: { ...state, pendingStaffMoment: null }, result: { ok: false, reason: "No such option." } };
  const idx = state.staff.findIndex((s) => s.id === moment.staffId);
  if (idx < 0) return { state: { ...state, pendingStaffMoment: null }, result: { ok: false, reason: "That teammate has left." } };
  const s = state.staff[idx];
  let upgraded = s;
  let line = "";
  if (opt.kind === "specialty" && opt.specialty) {
    upgraded = { ...s, secondSpecialty: opt.specialty };
    line = `${s.name} picked up ${opt.label} — they now lift a second stat on Design.`;
  } else if (opt.kind === "trait" && opt.trait) {
    upgraded = { ...s, bonusTrait: opt.trait };
    line = `${s.name} developed a ${opt.label.toLowerCase()}.`;
  } else if (opt.kind === "mentor") {
    upgraded = { ...s, isMentor: true };
    line = `${s.name} became a team mentor — the whole team learns faster now.`;
  } else {
    return { state: { ...state, pendingStaffMoment: null }, result: { ok: false, reason: "Unknown upgrade." } };
  }
  const staff = [...state.staff];
  staff[idx] = upgraded;
  const feed = [...state.feed, feedItem(state.week, line, "positive")];
  return { state: { ...state, staff, pendingStaffMoment: null, feed: trimFeed(feed) }, result: { ok: true, kind: opt.kind, staffName: s.name } };
}

// ---- Staff life events (item 2.2) ----
export interface StaffEventResult { ok: boolean; reason?: string; staffName?: string; label?: string; }

/** Resolve the staff life event on the table: apply the CHOSEN option's effect (mood/team-mood/skill/
 *  loyalty, minus any cash cost). If the player can't afford the cash option, the choice is rejected
 *  (the card stays up). Player-opt-in, so the pinned sim never calls it → byte-identical. */
export function resolveStaffEvent(state: GameState, optionIndex: number): { state: GameState; result: StaffEventResult } {
  const ev = state.pendingStaffEvent ?? null;
  if (!ev) return { state, result: { ok: false, reason: "No staff event to resolve." } };
  const opt = ev.options[optionIndex];
  if (!opt) return { state: { ...state, pendingStaffEvent: null }, result: { ok: false, reason: "No such option." } };
  const eff: StaffEventEffect = opt.effect;
  const cost = eff.cashCost ? dollars(eff.cashCost) : ZERO;
  if (cost > 0 && state.cash < cost) {
    return { state, result: { ok: false, reason: `Need ${format(cost)} for that.` } }; // keep the card up
  }
  const idx = state.staff.findIndex((s) => s.id === ev.staffId);
  // The teammate may have left (poached/fired) before the player answered — apply team-wide effects
  // only, and close the card.
  const staff = state.staff.map((s) => {
    let m = s;
    if (eff.teamMood) m = { ...m, mood: clampMood(m.mood + eff.teamMood) };
    if (idx >= 0 && s.id === ev.staffId) {
      m = {
        ...m,
        mood: clampMood(m.mood + (eff.mood ?? 0)), // their own delta, on top of any team delta already applied
        moodLowWeeks: (eff.mood ?? 0) > 0 ? 0 : m.moodLowWeeks,
        skill: eff.skill ? Math.min(BALANCE.staff.maxSkill, m.skill + eff.skill) : m.skill,
        poachCooldownUntil: eff.retainWeeks ? Math.max(m.poachCooldownUntil ?? 0, state.week + eff.retainWeeks) : m.poachCooldownUntil,
      };
    }
    return m;
  });
  const feed = [...state.feed, feedItem(state.week, `${ev.staffName}: you chose "${opt.label}".`, "accent")];
  return {
    state: { ...state, staff, cash: cost > 0 ? sub(state.cash, cost) : state.cash, pendingStaffEvent: null, feed: trimFeed(feed) },
    result: { ok: true, staffName: ev.staffName, label: opt.label },
  };
}

// ---- Post-launch reactive events (item 3.6) ----
export interface PostLaunchResult { ok: boolean; reason?: string; label?: string; }

/** Resolve the post-launch event on the table: apply the CHOSEN option's effect (cash spent/recovered,
 *  reputation + fans). If the player can't afford a cash option, the choice is rejected (card stays up).
 *  Player-opt-in, so the pinned sim never calls it → byte-identical. */
export function resolvePostLaunch(state: GameState, optionIndex: number): { state: GameState; result: PostLaunchResult } {
  const ev = state.pendingPostLaunch ?? null;
  if (!ev) return { state, result: { ok: false, reason: "No post-launch event to resolve." } };
  const opt = ev.options[optionIndex];
  if (!opt) return { state: { ...state, pendingPostLaunch: null }, result: { ok: false, reason: "No such option." } };
  const eff: PostLaunchEffect = opt.effect;
  const cost = eff.cashCost ? dollars(eff.cashCost) : ZERO;
  if (cost > 0 && state.cash < cost) {
    return { state, result: { ok: false, reason: `Need ${format(cost)} for that.` } }; // keep the card up
  }
  let cash = state.cash;
  if (cost > 0) cash = sub(cash, cost);
  if (eff.cashGain) cash = add(cash, dollars(eff.cashGain));
  const rep = Math.max(BALANCE.reputation.min, Math.min(BALANCE.reputation.max, state.reputation + (eff.rep ?? 0)));
  const fans = Math.max(0, state.fans + (eff.fans ?? 0));
  const feed = [...state.feed, feedItem(state.week, `“${ev.productName}”: you chose "${opt.label}".`, "accent")];
  return {
    state: { ...state, cash, reputation: rep, fans, pendingPostLaunch: null, feed: trimFeed(feed) },
    result: { ok: true, label: opt.label },
  };
}

// ---- Regional events ----
export interface RegionalEventResult { ok: boolean; reason?: string; responded?: boolean; regionId?: RegionId; }

/** Resolve the regional event on the table. RESPOND (spend the cash) or IGNORE, either way moving that
 *  region's loyalty by the event's respond/ignore delta (clamped). No-op if nothing's pending; respond
 *  fails if you can't afford it (the card stays up so you can ignore instead). Player-opt-in, so the
 *  home-only pinned sim never reaches it → byte-identical. */
export function resolveRegionalEvent(state: GameState, respond: boolean): { state: GameState; result: RegionalEventResult } {
  const event = state.pendingRegionalEvent ?? null;
  if (!event) return { state, result: { ok: false, reason: "No regional event to resolve." } };
  const rname = regionById(event.regionId)?.name ?? "the market";
  if (respond && state.cash < event.cost) {
    return { state, result: { ok: false, reason: `You can't afford to respond in ${rname}.` } };
  }
  const delta = respond ? event.loyaltyRespond : event.loyaltyIgnore;
  const cap = BALANCE.market.regions.loyalty.cap;
  const cur = state.regionLoyalty ?? {};
  const regionLoyalty = { ...cur, [event.regionId]: Math.max(-cap, Math.min(cap, (cur[event.regionId] ?? 0) + delta)) };
  const cash = respond ? sub(state.cash, event.cost) : state.cash;
  const line = `${rname}: standing ${delta >= 0 ? "rose" : "slipped"} ${delta >= 0 ? "+" : ""}${delta}.`;
  const feed = [...state.feed, feedItem(state.week, line, delta >= 0 ? "positive" : "negative")];
  return {
    state: { ...state, cash, regionLoyalty, pendingRegionalEvent: null, feed: trimFeed(feed) },
    result: { ok: true, responded: respond, regionId: event.regionId },
  };
}

export interface CommunityAskResult { ok: boolean; reason?: string; answered?: boolean; fanGain?: number; }
/** Resolve a pending community ask. ANSWER it (accept=true): spend the cash, grow the base by fanGain,
 *  and lift the mood (which then decays via the normal EMA). PASS (accept=false): a small mood dip. Both
 *  clear the pending ask. No-op if nothing's pending or you can't afford to answer. Player-claimed, so
 *  the pinned sim (which never launches) never reaches it → byte-identical. */
export function resolveCommunityAsk(state: GameState, accept: boolean): { state: GameState; result: CommunityAskResult } {
  const ask = state.pendingCommunityAsk ?? null;
  if (!ask) return { state, result: { ok: false, reason: "No community ask to resolve." } };
  const clampSent = (n: number): number => (n < -1 ? -1 : n > 1 ? 1 : n);
  const feed = [...state.feed];
  if (!accept) {
    const fanSentiment = clampSent((state.fanSentiment ?? 0) + ask.passSentiment);
    feed.push(feedItem(state.week, "You passed on the community's ask — the fans are a little let down.", "neutral"));
    return { state: { ...state, fanSentiment, pendingCommunityAsk: null, feed: trimFeed(feed) }, result: { ok: true, answered: false } };
  }
  if (!gte(state.cash, ask.cost)) return { state, result: { ok: false, reason: "Not enough cash to answer this." } };
  const info = ASK_INFO[ask.kind];
  const fanSentiment = clampSent((state.fanSentiment ?? 0) + ask.sentimentGain);
  feed.push(feedItem(state.week, `${info.done} +${ask.fanGain.toLocaleString()} fans join the community.`, "positive"));
  return {
    state: {
      ...state,
      cash: sub(state.cash, ask.cost),
      fans: state.fans + ask.fanGain,
      fanSentiment,
      pendingCommunityAsk: null,
      feed: trimFeed(feed),
    },
    result: { ok: true, answered: true, fanGain: ask.fanGain },
  };
}

// ---------- Post-IPO shareholder loop: buybacks + quarterly earnings ----------

export interface BuybackResult { ok: boolean; reason?: string; gained?: number; spent?: Money; }
/** Buy back `amount` (cash) worth of the company's own shares at the current valuation: raise the
 *  founder's ownership, spend the cash (a real sink), and signal confidence (a small momentum bump).
 *  Capped so buybacks can't fully re-privatize. No-op if not listed / can't afford / already at cap. */
export function buybackShares(state: GameState, amount: Money): { state: GameState; result: BuybackResult } {
  if (!state.listed) return { state, result: { ok: false, reason: "Company isn't public." } };
  const sh = BALANCE.ipo.shareholders;
  const headroom = sh.maxOwnership - state.ownership;
  if (headroom <= 0.0005) return { state, result: { ok: false, reason: "You already hold nearly all the shares." } };
  const val = companyValuation(state);
  const gain = Math.min(buybackOwnershipGain(amount, val), headroom);
  if (gain <= 0) return { state, result: { ok: false, reason: "Nothing to buy back." } };
  const spend = scale(val, gain);
  if (!gte(state.cash, spend)) return { state, result: { ok: false, reason: "Not enough cash for that buyback." } };
  const vmCap = BALANCE.valuationMomentum.cap;
  const momentum = Math.max(-vmCap, Math.min(vmCap, (state.valuationMomentum ?? 0) + buybackMomentumBump(gain)));
  const feed = [...state.feed];
  feed.push(feedItem(state.week, `${state.companyName} bought back ${(gain * 100).toFixed(1)}% of its shares for ${format(spend)}.`, "accent"));
  return {
    state: { ...state, cash: sub(state.cash, spend), ownership: Math.min(1, state.ownership + gain), valuationMomentum: momentum, feed: trimFeed(feed) },
    result: { ok: true, gained: gain, spent: spend },
  };
}

export interface EarningsAckResult { ok: boolean; defended?: boolean; }
/** Acknowledge a quarterly earnings result. On a MISS you may DEFEND the price: spend a slice of the
 *  valuation on a buyback to steady the shares (+ reconsolidate ownership). Beats (and "ride it out")
 *  just clear the call. No-op if nothing's pending. */
export function resolveEarnings(state: GameState, defend: boolean): { state: GameState; result: EarningsAckResult } {
  const report = state.pendingEarnings ?? null;
  if (!report) return { state, result: { ok: false } };
  const cleared: GameState = { ...state, pendingEarnings: null };
  if (defend && !report.beat) {
    const amount = scale(companyValuation(state), BALANCE.ipo.shareholders.defendBuybackPct);
    const bb = buybackShares(cleared, amount);
    return { state: bb.state, result: { ok: true, defended: bb.result.ok } };
  }
  return { state: cleared, result: { ok: true, defended: false } };
}

export interface ShareholderPulse { expectation: Money; quarterRevenue: Money; pct: number; weeksToCall: number; }
/** A read-only snapshot of where this quarter stands vs the street's expectation, for the equity card.
 *  Null when the company isn't public. */
export function shareholderPulse(state: GameState): ShareholderPulse | null {
  if (!state.listed) return null;
  const sh = BALANCE.ipo.shareholders;
  const quarterRevenue = sub(state.cumulativeRevenue, (state.quarterStartRevenue ?? state.cumulativeRevenue) as Money);
  const expectation = (Math.max(1, (state.earningsExpectation ?? sh.minExpectation) as number)) as Money;
  const pct = Math.min(999, Math.round((toDollars(quarterRevenue) / toDollars(expectation)) * 100));
  const weeksToCall = Math.max(0, sh.quarterWeeks - (state.week - (state.lastEarningsWeek ?? state.week)));
  return { expectation, quarterRevenue, pct, weeksToCall };
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

/** The LIVE verdict bars a launch must clear right now — the static era bars, RAISED by the company's
 *  own rolling expectations baseline (recent track record). A hit must top what you've been shipping,
 *  so a mature studio can't guarantee a hit by re-maxing the same spec — it takes a genuine step up.
 *  A brand-new company (launchExpectation 0/undefined) gets the plain static bars, so early launches
 *  and the pinned sim's opener are unchanged. The hitFactory project keeps lowering the hit bar. */
export function launchBars(state: GameState): { hit: number; solid: number; flop: number } {
  const base = verdictBands(state.era);
  const x = BALANCE.reputation.expectation;
  const exp = Math.max(0, state.launchExpectation ?? 0);
  const hitRaw = Math.max(base.hit, exp * x.hitMargin);
  const hit = hasProject(state.completedProjects, "hitFactory") ? hitRaw * 0.88 : hitRaw;
  return {
    hit: Math.round(hit),
    solid: Math.round(Math.max(base.solid, exp * x.solidMargin)),
    flop: Math.round(Math.max(base.flop, exp * x.flopMargin)),
  };
}

/** The verdict for a competition-adjusted effective score against the live (expectations-raised) bars.
 *  Shared by the launch reducer and the Design Lab projection so the two always agree. */
export function verdictFor(state: GameState, effectiveScore: number): "hit" | "solid" | "steady" | "flop" {
  const b = launchBars(state);
  if (effectiveScore >= b.hit) return "hit";
  if (effectiveScore <= b.flop) return "flop";
  if (effectiveScore >= b.solid) return "solid";
  return "steady";
}

/** Roll the expectations baseline forward after a launch scores `effectiveScore` — an EMA that tracks
 *  your recent competition-adjusted performance, so the NEXT launch's bar reflects it. Pure. */
export function nextLaunchExpectation(prev: number | undefined, effectiveScore: number): number {
  const a = BALANCE.reputation.expectation.alpha;
  const p = Math.max(0, prev ?? 0);
  const blended = p <= 0 ? effectiveScore * a : p * (1 - a) + effectiveScore * a;
  return Math.max(0, Math.round(blended));
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
  // Kick off the shareholder loop: the street's first quarterly bar is set from the current run-rate.
  const quarterEstimate = scale(nextWeekRevenue(state), BALANCE.ipo.shareholders.quarterWeeks);
  return {
    ...state,
    listed: true,
    ownership: 1 - pct,
    cash: add(state.cash, raised),
    lastEarningsWeek: state.week,
    quarterStartRevenue: state.cumulativeRevenue,
    earningsExpectation: nextExpectation(quarterEstimate),
    earningsQuarter: 0,
    pendingEarnings: null,
    feed: trimFeed(feed),
  };
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
  const held = state.holdings[id] ?? 0;
  const next: GameState = { ...state, cash: sub(state.cash, cost), holdings: { ...state.holdings, [id]: held + qty } };
  // Crossing an ownership threshold is a milestone — announce the board seat / controlling stake so the
  // takeover runway is legible (a feed line, not an interrupt: low-noise, and never fired by the pinned
  // sim, which doesn't trade). Only the highest threshold newly crossed is reported.
  const t = BALANCE.mergers.takeover;
  const before = ownershipFractionOf(state, id);
  const after = ownershipFractionOf(next, id);
  if (before < t.controlFrac && after >= t.controlFrac) {
    const feed = [...state.feed, feedItem(state.week, `You now hold a controlling stake in ${comp.name} — a hostile buyout is on the table at a reduced premium.`, "positive")];
    return { ...next, feed: trimFeed(feed) };
  }
  if (before < t.boardSeatFrac && after >= t.boardSeatFrac) {
    const feed = [...state.feed, feedItem(state.week, `Your stake in ${comp.name} earned you a board seat — you can now read their momentum from the inside.`, "accent")];
    return { ...next, feed: trimFeed(feed) };
  }
  return next;
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

/** The player's ownership fraction of rival `id` (shares held ÷ the rival's float, clamped 0..1). */
export function ownershipFractionOf(state: GameState, id: string): number {
  const total = rivalDef(id)?.shares ?? 0;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (state.holdings[id] ?? 0) / total));
}

/** A board seat — insider intel access — earned by holding boardSeatFrac of a rival's float. */
export function hasBoardSeat(state: GameState, id: string): boolean {
  return ownershipFractionOf(state, id) >= BALANCE.mergers.takeover.boardSeatFrac;
}

/** A controlling stake — the hostile-takeover discount — earned by holding controlFrac of the float. */
export function hasControllingStake(state: GameState, id: string): boolean {
  return ownershipFractionOf(state, id) >= BALANCE.mergers.takeover.controlFrac;
}

/** Board-seat intel on a rival: its otherwise-hidden arc phase (momentum) + next-launch week. Null
 *  until you hold a board seat — the payoff for accumulating a real stake. Pure read (UI-only). */
export function rivalBoardIntel(state: GameState, id: string): { arcPhase: RivalArcPhase; nextLaunchWeek: number } | null {
  if (!hasBoardSeat(state, id)) return null;
  const c = state.competitors.find((x) => x.id === id);
  if (!c) return null;
  return { arcPhase: c.arcPhase ?? "stable", nextLaunchWeek: c.nextLaunchWeek };
}

/** B3 — the all-cash cost to acquire a rival outright: its market cap × the control premium, LESS
 *  the market value of any shares the player already holds (you only pay for the rest). A CONTROLLING
 *  STAKE (controlFrac of the float) drops the premium to the reduced hostile rate — you already hold
 *  effective control. Null if the rival isn't on the board. Floored at a token amount so it's never free. */
export function acquisitionCost(state: GameState, id: string): Money | null {
  const c = state.competitors.find((x) => x.id === id);
  if (!c) return null;
  const premium = hasControllingStake(state, id)
    ? BALANCE.mergers.takeover.hostilePremium
    : BALANCE.mergers.acquisitionPremium;
  const gross = scale(rivalMarketCap(c), premium);
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
  // Absorb their productive assets: R&D pipeline → a one-time RP windfall; installed base → a
  // permanent services annuity (see absorbedServicesRevenue). Both scale with the rival's reputation.
  const rpWindfall = Math.round(Math.max(0, rivalRep) * m.rpPerRepPoint);
  const baseGain = Math.round(Math.max(0, rivalRep) * m.installedBasePerRep);

  const feed = [...state.feed];
  feed.push(feedItem(
    state.week,
    `Acquired ${c.name} for ${format(cost)} — absorbed their brand (+${m.repBonus} rep), ${fansGain.toLocaleString()} fans, ${rpWindfall} research from their patents, and ${baseGain.toLocaleString()} customers onto your services.`,
    "positive",
  ));
  // Buying out your arch-rival is the ultimate way to settle the score — the rivalry ends in your
  // favour, with a climactic feed beat instead of a silent prune.
  const wasNemesis = state.nemesis?.rivalId === id;
  if (wasNemesis) {
    feed.push(feedItem(state.week, `You bought out ${c.name}, your arch-rival, ${state.nemesis!.playerWins}–${state.nemesis!.rivalWins} in the end. The feud is over. You won.`, "positive"));
  }

  return {
    ...state,
    cash: sub(state.cash, cost),
    competitors,
    holdings,
    osLicensees,
    osLicenseeHealth,
    fans: state.fans + fansGain,
    reputation,
    researchPoints: state.researchPoints + rpWindfall,
    absorbedBase: (state.absorbedBase ?? 0) + baseGain,
    acquiredRivals: [...state.acquiredRivals, id],
    nemesis: wasNemesis ? null : state.nemesis,
    feed: trimFeed(feed),
  };
}

/** Recurring weekly services income from the installed base absorbed via acquisitions — the rivals'
 *  former customers now pay YOU. 0 until the first acquisition, so a game that never acquires (and the
 *  pinned sim) is byte-identical. Pure; shared by the tick and the revenue-preview selector. */
export function absorbedServicesRevenue(s: GameState): Money {
  return cents(Math.round((s.absorbedBase ?? 0) * BALANCE.mergers.absorbedServiceRate));
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

// Offline catch-up was removed: the sim advances ONLY while the app is open and running (the weekly
// tick). Closing or backgrounding the game freezes time; reopening resumes exactly where it stopped,
// with no wall-clock weeks fast-forwarded and no "while you were away" recap. `advanceOneWeek`'s
// `offline` parameter is retained but dormant (nothing passes `true` in production) — its `!offline`
// guards still document which systems are live-play-only.

export { dollars };
