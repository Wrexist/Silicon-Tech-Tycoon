// Shared engine types. PURE — no React/DOM.
import type { Money } from "./money.ts";

export type StatKey = "performance" | "quality" | "battery" | "design" | "ecosystem";
export const STAT_KEYS: readonly StatKey[] = [
  "performance",
  "quality",
  "battery",
  "design",
  "ecosystem",
];

export type Stats = Record<StatKey, number>; // each 0..100

export type ComponentKind =
  | "chip"
  | "display"
  | "battery"
  | "materials"
  | "software"
  | "camera";

export type CategoryId =
  | "phone"
  | "tablet"
  | "laptop"
  | "desktop"
  | "monitor"
  | "console"
  | "wearable"
  | "experimental";

export type FinishId = "plastic" | "aluminium" | "titanium" | "gold";

/** Buyer segments (Epic A). The id lives here (the shared types home) so both engine/segments.ts and
 *  LaunchInsight below can reference it without a circular import. The SEGMENTS table + the demand
 *  math live in engine/segments.ts. */
export type SegmentId = "budget" | "mainstream" | "pro" | "style" | "enterprise";

/** Geographic markets (engine/regions.ts). "home" is always unlocked; the rest are paid expansions. */
export type RegionId = "home" | "north_america" | "europe" | "asia" | "emerging";

/** Component supplier id (engine/suppliers.ts owns the catalog + effects). */
export type SupplierId = "bargain" | "standard" | "lumen" | "novacore" | "atlas" | "vertex";

/** Manufacturing factory id (engine/factories.ts owns the catalog + effects). */
export type FactoryId = "standard" | "eastwind" | "kairos" | "apex" | "homeline" | "gigafab";

/** How to handle a production run that exceeds the chosen factory's throughput capacity:
 *  pay overtime, extend the schedule, or accept a quality hit. (engine/factories.ts) */
export type CapacityStrategy = "overtime" | "stretch" | "defects";

/** Canonical finish order, cheap→premium. Doubles as the unlock ladder: the first
 *  `BALANCE.design.freeFinishes` are available from the start; the rest are RP-unlocked in order. */
export const FINISH_ORDER: FinishId[] = ["plastic", "aluminium", "titanium", "gold"];

// --- Device design customization (cosmetic + light gameplay) ---
export type CameraLayout = "vertical" | "horizontal" | "square" | "triangle";
export type CameraPosition = "topLeft" | "topCenter" | "center";
export type CameraModuleShape = "squircle" | "circle" | "pill";
export type NotchStyle = "none" | "punch" | "notch" | "island";

/** Per-product build philosophy — a meaningful sidegrade so the optimal recipe depends on what the
 *  market wants (and on your margin strategy), not just "pick the top tier". Two trade axes,
 *  mutually exclusive (one readable choice):
 *    • performance / efficiency — shift points between performance and battery (stat↔stat).
 *    • value / premium — value lowers build cost but dims quality/design appeal; premium raises
 *      both appeal and build cost (margin↔appeal).
 *  Stat effects apply in the STATE layer (gameState.productStats), never in the protected
 *  computeStats, so there's zero retroactive balance ripple (launched products keep their snapshot
 *  stats). The cost multiplier is a pure engine helper (tuningCostMultiplier). */
export type ProductTuning =
  | "balanced"
  | "performance"
  | "efficiency"
  | "value"
  | "premium";

export interface CameraDesign {
  count: number; // 1..4 lenses placed on the back
  layout: CameraLayout;
  position: CameraPosition;
  module: CameraModuleShape;
  flash: boolean;
}

/** A single tier within a component line (e.g. chip tier 3). */
export interface ComponentTier {
  tier: number; // 1-based
  name: string;
  rdCost: Money; // one-time R&D to unlock this tier
  unitCost: Money; // per-unit build-cost contribution
  contributes: Partial<Stats>; // stat points this tier adds
  era: number; // minimum era this tier belongs to
}

export interface ComponentLine {
  kind: ComponentKind;
  displayName: string;
  global: boolean; // software is global: applies to all products once researched
  tiers: ComponentTier[];
}

export interface CategoryDef {
  id: CategoryId;
  displayName: string;
  glyph: string; // Lucide icon NAME (mapped via design/icons.tsx CategoryIcon) — never emoji
  slots: ComponentKind[]; // which component lines apply
  statEmphasis: Partial<Stats>; // category baseline taste weighting hint
  unlockEra: number; // era at which it becomes available
  starter: boolean;
  marketSize: number; // relative addressable volume
}

/** A product the player has designed. */
export interface Product {
  id: string;
  name: string;
  category: CategoryId;
  /** chosen tier per component kind (kind -> tier number) */
  tiers: Partial<Record<ComponentKind, number>>;
  finish: FinishId;
  colorIndex: number; // index into the finish's curated swatch set
  price: Money;
  designTier: number; // 1..N, raises the Design ceiling (from designers/effort)
  camera: CameraDesign;
  notch: NotchStyle;
  /** Screen refresh rate in Hz (60/90/120/144). Optional — older saves default to 60 on read; the
   *  effective value is capped by the display tier (see product.effectiveRefreshRate). */
  refreshRate?: number;
  /** On-board storage in GB (128/256/512/1024). Optional — defaults to 128 on read; capped by the
   *  software/OS tier (see product.effectiveStorage). */
  storage?: number;
  /** Category subsystem step (Track D, engine/subsystems.ts) — e.g. a laptop's cooling or a wearable's
   *  sensors. 0/undefined = the free baseline; categories without a subsystem ignore it. */
  subsystem?: number;
  plannedUnits?: number; // production run size chosen in the build wizard
  channelId?: string; // marketing channel selected at launch
  tuning?: ProductTuning; // performance/efficiency trade-off (defaults "balanced" on older saves)
  /** Geographic markets to ship this product to (engine/regions.ts). Optional — defaults to ["home"]
   *  on read, so older saves and home-only launches are unchanged. */
  regions?: RegionId[];
  /** Component supplier (engine/suppliers.ts) — trades unit cost / quality / lead time. Optional —
   *  unset resolves to the neutral "standard" supplier, so older saves are unchanged. */
  supplierId?: SupplierId;
  /** Dual-source the parts across a backup supplier — a small unit-cost premium for roughly half the
   *  supply-crunch exposure (a resilience hedge). Optional/false = single-sourced. */
  dualSource?: boolean;
  /** Manufacturing factory (engine/factories.ts) — trades tooling / per-unit cost / build speed /
   *  throughput capacity. Optional — unset resolves to the neutral "standard" factory (unlimited
   *  capacity), so older saves are unchanged. */
  factoryId?: FactoryId;
  /** How an over-capacity run is handled (overtime cost / longer schedule / quality hit). Optional —
   *  defaults to "overtime", the pre-P3 behaviour. */
  capacityStrategy?: CapacityStrategy;
  /** Quality-stat penalty BAKED at build time when the "defects" capacity strategy is used (depends
   *  on run size, so it's frozen onto the built product). Optional — absent = none. */
  defectPenalty?: number;
}

export function defaultCameraDesign(): CameraDesign {
  return { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true };
}

/** A snapshot of the launch-moment drivers behind a product's outcome.
 *  These depend on the market state at the instant of launch (trends drift, rivals come and go),
 *  so they're recorded here to let the post-launch detail screen explain WHY it won or flopped
 *  (pillar #5). All optional/additive — saves written before this existed simply lack it, and the
 *  UI derives a qualitative read from verdict + launchScore + stats instead. */
export interface LaunchInsight {
  demandFit: number; // 0..100 — how well stats matched what consumers wanted at launch
  priceFit: number; // 0.15..1.35 — how fair the price felt vs. perceived value (1 = on the money)
  hype: number; // total launch hype multiplier (reputation + marketing)
  matchingRivals: number; // rivals roughly as good as you, splitting the market
  betterRivals: number; // rivals clearly better than you
  competitionFactor: number; // 0..1 — share of demand kept after competition
  /** Epic A — which buyer segments this launch won and lost (the readable "won Pro, lost Budget on
   *  price" verdict). Optional/additive: saves written before segments lack it and the UI falls back. */
  dominantSegment?: SegmentId;
  weakestSegment?: SegmentId;
  perSegment?: { id: SegmentId; name: string; captured: number; fit: number; priceFit: number }[];
}

/** A product that has been launched into the market. */
export interface LaunchedProduct {
  product: Product;
  stats: Stats;
  unitCost: Money;
  launchScore: number;
  launchedWeek: number;
  totalUnits: number; // forecast total lifetime volume
  weeklyUnits: number[]; // the sales curve (units per week)
  unitsSold: number; // cumulative actual
  weeksElapsed: number;
  revenueToDate: Money;
  plannedUnits?: number; // production run size this product was built with
  /** Launch outcome the player saw — the competition-adjusted verdict, recorded for history. */
  verdict?: "hit" | "solid" | "flop" | "steady";
  /** Launch-moment drivers behind the verdict (added later; absent on older saves). */
  insight?: LaunchInsight;
  /** Number of mid-lifecycle price adjustments made. Old saves: undefined → treated as 0. */
  priceCuts?: number;
  /** Number of mid-lifecycle marketing pushes run (each with diminishing returns). Old saves: undefined → 0. */
  marketingPushes?: number;
  /** Number of mid-lifecycle restocks (reorders) funded on this product. Old saves: undefined → 0. */
  restocks?: number;
}

// engineer/designer/marketer build products; hr (People Lead) + researcher (Lead Researcher) are
// specialists you recruit to UNLOCK delegation (Auto-assign / Auto-research). Their weekly salary is
// the standing cost of that automation.
export type StaffRole = "engineer" | "designer" | "marketer" | "hr" | "researcher";
export type Assignment = "rnd" | "design" | "marketing" | "idle";

/** What a person is exceptional at — boosts the matching product stat. */
export type Specialty = StatKey;

/** Personality trait — a passive gameplay effect + flavor. */
export type Trait =
  | "perfectionist"
  | "fastLearner"
  | "hustler"
  | "visionary"
  | "veteran"
  | "teamPlayer";

export type Accessory = "none" | "glasses" | "headphones" | "cap" | "beanie" | "earrings";

/** Deterministic visual identity for the isometric scene + roster avatar. */
export interface Appearance {
  skin: number; // index into skin palette
  hair: number; // hairstyle index
  hairColor: number; // index into hair palette
  shirt: number; // index into shirt palette (their accent)
  accessory: Accessory;
}

/** Per-discipline proficiency, 0..100. Everyone has all three; their role's discipline is their
 *  headline. Drives variety ("good at different things") + the derived skill level. */
export interface Skills {
  engineering: number;
  design: number;
  marketing: number;
}

export interface Staff {
  id: string;
  role: StaffRole;
  name: string;
  skill: number; // 1..10 — headline competence used by the sim/economy (derived from `skills`)
  skills: Skills; // 0..100 per discipline
  salary: Money; // weekly
  assignment: Assignment;
  xp: number; // accumulates toward the next skill level-up
  specialty: Specialty;
  trait: Trait;
  mood: number; // 0..100, drifts over time
  moodLowWeeks?: number; // consecutive weeks below the churn threshold — resets to 0 when mood recovers
  /** Week until which this person can't be poached again (Track C): set when you win a counter-offer,
   *  so a retained employee isn't immediately targeted a second time. Optional → old saves default 0. */
  poachCooldownUntil?: number;
  /** The week this person was hired (drives growth-moment tenure). The founder + old-save hires have
   *  none → treated as week 0 (maximal tenure). Optional → golden-invariant safe. */
  hiredWeek?: number;
  // --- Growth moments (engine/staffMoment.ts): permanent character upgrades a tenured, senior
  // staffer earns over time, chosen by the player. All optional → a fresh/founder-only team (the
  // pinned solo sim) has none set, so every effect below is a no-op → byte-identical. ---
  /** A SECOND design specialty this person also lifts (on top of `specialty`) when assigned to Design. */
  secondSpecialty?: Specialty;
  /** A SECOND trait whose passive effect stacks with `trait` (output / XP / hype / design ceiling). */
  bonusTrait?: Trait;
  /** Whether this person mentors the whole team — a small company-wide weekly XP lift for everyone else. */
  isMentor?: boolean;
  appearance: Appearance;
}

/** A potential hire produced by a recruitment search — not yet on the team. */
export interface Candidate {
  id: string;
  role: StaffRole;
  name: string;
  skill: number; // 1..10 derived headline
  skills: Skills; // 0..100 per discipline
  salary: Money; // weekly salary if hired
  hireFee: Money; // one-time signing cost
  specialty: Specialty;
  trait: Trait;
  mood: number;
  appearance: Appearance;
}

/** Recruitment channel: a cheaper/slower board vs. a pricey headhunter that finds stronger people. */
export type RecruitTier = "board" | "headhunter";

/** An in-progress recruitment search. Resolves into `candidates` when weeksLeft hits 0. */
export interface Recruitment {
  tier: RecruitTier;
  weeksLeft: number;
  startedWeek: number;
}

/** A product being manufactured before it can launch. */
export interface BuildJob {
  product: Product;
  totalWeeks: number;
  weeksElapsed: number;
  plannedUnits?: number; // production run size chosen in the build wizard
  channelId?: string; // marketing channel selected at launch
}

export interface FacilityTier {
  tier: number;
  name: string;
  staffCapacity: number;
  weeklyRent: Money;
  upgradeCost: Money;
}

export interface ConsumerTrends {
  weights: Stats; // normalized-ish weights (sum ~1) of what consumers want now
  targetWeights: Stats; // drifting target the weights ease toward
}

export interface CompetitorState {
  id: string;
  name: string;
  blurb: string; // short flavour line shown on the stock exchange
  reputation: number; // 0..100
  /** strength they currently project into each category, 0..~100 */
  strengthByCategory: Partial<Record<CategoryId, number>>;
  nextLaunchWeek: number;
  sharePrice: number; // current share price in cents
  priceHistory: number[]; // recent share-price points (dollars) for the sparkline
  /** Rival story arc (Track B): current lifecycle phase + the week it re-rolls. Both optional and
   *  absent at game start / on old saves — the arc bootstraps (silently) on the first tick after load,
   *  so newGame stays byte-identical and no migration is needed. */
  arcPhase?: "ascending" | "peaking" | "declining" | "stable";
  arcUntil?: number;
}
