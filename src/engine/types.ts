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

// --- Device design customization (cosmetic + light gameplay) ---
export type CameraLayout = "vertical" | "horizontal" | "square" | "triangle";
export type CameraPosition = "topLeft" | "topCenter" | "center";
export type CameraModuleShape = "squircle" | "circle" | "pill";
export type NotchStyle = "none" | "punch" | "notch" | "island";

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
  plannedUnits?: number; // production run size chosen in the build wizard
  channelId?: string; // marketing channel selected at launch
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
  verdict?: "hit" | "flop" | "steady";
  /** Launch-moment drivers behind the verdict (added later; absent on older saves). */
  insight?: LaunchInsight;
}

export type StaffRole = "engineer" | "designer" | "marketer";
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

export interface Staff {
  id: string;
  role: StaffRole;
  name: string;
  skill: number; // 1..10
  salary: Money; // weekly
  assignment: Assignment;
  xp: number; // accumulates toward the next skill level-up
  specialty: Specialty;
  trait: Trait;
  mood: number; // 0..100, drifts over time
  appearance: Appearance;
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
}
