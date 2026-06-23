// Rival AI — turns a rival's abstract launch (a category + a strength number) into a REAL, renderable
// product: chosen component tiers, a finish, a price and a name (Epic B "Living Rivals"). PURE +
// deterministic (seeded). This is what lets the player SEE and learn from what beat them, instead of
// competing against an invisible "strength" — the direct fix for the genre's "rivals are just a color
// on the map" failure (Computer Tycoon). The strength number still drives the market math unchanged;
// this is an additive visibility layer, so it introduces no balance ripple.
import { CATEGORIES, COMPONENT_LINES, maxTier } from "./catalogs.ts";
import { rivalDef } from "./competitors.ts";
import { dollars, toDollars } from "./money.ts";
import { computeStats, overallScore } from "./product.ts";
import type { Rng } from "./rng.ts";
import { BALANCE } from "./balance.ts";
import {
  defaultCameraDesign,
  type CameraLayout,
  type CameraModuleShape,
  type CategoryId,
  type ComponentKind,
  type FinishId,
  type NotchStyle,
  type Product,
} from "./types.ts";

export type RivalTone = "premium" | "value" | "balanced";

/** A rival's released product — a fully renderable Product plus display metadata. Stored newest-first
 *  in state.rivalReleases (capped) and surfaced in the Rival Releases feed. */
export interface RivalRelease {
  rivalId: string;
  rivalName: string;
  week: number;
  category: CategoryId;
  product: Product; // renderable via DeviceRenderer (zero image assets — pillar #4)
  overall: number; // 0..100 perceived quality, for display
  strength: number; // the market strength this launch projected (what it does to YOUR launches)
  tone: RivalTone;
  tagline: string;
  /** B2 — true when an undercutter shipped this into a category the player is winning (priced low). */
  contested: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Highest component tier of a line that the given era has unlocked (so an era-1 rival can't ship
 *  era-3 silicon). Falls back to tier 1. */
function eraMaxTier(kind: ComponentKind, era: number): number {
  const tiers = COMPONENT_LINES[kind].tiers;
  let m = 1;
  for (const t of tiers) if (t.era <= era) m = Math.max(m, t.tier);
  return Math.min(m, maxTier(kind));
}

/** A rival's product personality, derived from its calibrated identity (competitors.ts). Premium
 *  houses skew toward design-driving components + higher margins; value houses skew toward raw
 *  internals at a lower price; the rest are balanced. */
export function rivalTone(rivalId: string): RivalTone {
  const def = rivalDef(rivalId);
  if (!def) return "balanced";
  if (def.reputation >= 65) return "premium";
  if (def.vol >= 1.3) return "value";
  return "balanced";
}

/** Per-component tier bias by tone (added to the strength-derived base tier before clamping). Premium
 *  pushes the visible/quality components up; value pushes internals up but trims the showy ones. */
const TONE_BIAS: Record<RivalTone, Partial<Record<ComponentKind, number>>> = {
  premium: { display: 1, materials: 1, camera: 1, software: 1 },
  value: { chip: 1, battery: 1, materials: -1, camera: -1 },
  balanced: {},
};

const PRICE_MARGIN: Record<RivalTone, number> = { premium: 1.25, value: 0.9, balanced: 1.05 };

const MODEL_WORDS = [
  "Vync", "Aero", "Pulse", "Edge", "Nova", "Flux", "Halo", "Vertex",
  "Orbit", "Prism", "Lumen", "Apex", "Drift", "Zephyr", "Onyx", "Vista",
];

/** Stable 32-bit hash (FNV-1a) so a rival's line name is deterministic per rival + category. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A rival's FLAGSHIP LINE name for a category — stable across the whole game (e.g. Pomelo always
 *  ships its "Lumen" phone line), so rivals build real product series the player can recognise. */
export function rivalLineName(rivalId: string, rivalName: string, category: CategoryId): string {
  const word = MODEL_WORDS[hashString(`${rivalId}:${category}`) % MODEL_WORDS.length];
  return `${rivalName} ${word}`;
}

const FINISHES: FinishId[] = ["plastic", "aluminium", "titanium", "gold"];
const CAM_LAYOUTS: CameraLayout[] = ["vertical", "horizontal", "square", "triangle"];
const CAM_MODULES: CameraModuleShape[] = ["squircle", "circle", "pill"];
const NOTCHES: NotchStyle[] = ["none", "punch", "notch", "island"];

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[rng.int(arr.length)] ?? arr[0];
}

/** Generate a rival's released product deterministically from the launch facts + a seeded rng.
 *  `strength` is the market strength the launch projected (competitors.ts); the product is built so
 *  its perceived quality tracks that strength, shaped by the rival's tone. */
export function generateRivalProduct(args: {
  rivalId: string;
  rivalName: string;
  category: CategoryId;
  era: number;
  strength: number;
  week: number;
  rng: Rng;
  /** B2 — when true (an undercutter contesting the player), the product ships aggressively cheap. */
  contested?: boolean;
  /** How many products the rival has already shipped in this category's line — drives the series
   *  number (0 → the base name, 1 → "… 2", …), so rivals build recognisable flagship series. */
  seriesIndex?: number;
}): RivalRelease {
  const { rivalId, rivalName, category, era, strength, week, rng, contested = false, seriesIndex = 0 } = args;
  const tone = rivalTone(rivalId);
  const bias = TONE_BIAS[tone];
  const slots = CATEGORIES[category].slots;

  // Strength → a 0..1 quality target. baseStrength≈28 maps to a mid-low build; ~95 to flagship.
  const q = clamp((strength - 15) / 80, 0.08, 1);

  const tiers: Partial<Record<ComponentKind, number>> = {};
  for (const kind of slots) {
    const cap = eraMaxTier(kind, era);
    const base = q * cap + (bias[kind] ?? 0);
    const jitter = rng.next() < 0.35 ? (rng.next() < 0.5 ? -1 : 1) : 0;
    tiers[kind] = clamp(Math.round(base + jitter), 1, cap);
  }

  // Finish + cosmetics scale with quality + tone (premium leans titanium/gold).
  const finishIdx = clamp(Math.round(q * (FINISHES.length - 1) + (tone === "premium" ? 0.6 : tone === "value" ? -0.6 : 0)), 0, FINISHES.length - 1);
  const camCount = slots.includes("camera") ? clamp(Math.round(1 + q * 3 + (tone === "premium" ? 0.4 : tone === "value" ? -0.4 : 0)), 1, 4) : 1;

  const product: Product = {
    id: `rival-${rivalId}-${week}`,
    name: "", // set below once we know the tone
    category,
    tiers,
    finish: FINISHES[finishIdx],
    colorIndex: rng.int(6),
    price: dollars(1), // set below from computed value
    designTier: clamp(Math.round(1 + q * 3), 1, 4),
    camera: {
      ...defaultCameraDesign(),
      count: camCount,
      layout: pick(CAM_LAYOUTS, rng),
      module: pick(CAM_MODULES, rng),
      flash: rng.next() < 0.85,
    },
    notch: slots.includes("display") ? pick(NOTCHES, rng) : "none",
  };

  // Price from the product's own perceived value × the tone's margin (mirrors the player's fair-price
  // model so a rival's pricing reads as a deliberate posture, not a random number).
  const stats = computeStats(product);
  const overall = overallScore(stats, category);
  const fair = Math.max(1, overall * toDollars(BALANCE.market.price.valueToPrice));
  // A contesting undercutter slashes the price below its usual posture to start a price war.
  const margin = PRICE_MARGIN[tone] * (contested ? BALANCE.competitors.undercutPriceMult : 1);
  product.price = dollars(Math.max(1, Math.round(fair * margin)));

  // Name: the rival's stable flagship LINE for this category + a series number, so rivals build a
  // recognisable product series ("Pomelo Lumen", "Pomelo Lumen 2", …). No real product names (IP rule).
  const line = rivalLineName(rivalId, rivalName, category);
  product.name = seriesIndex > 0 ? `${line} ${seriesIndex + 1}` : line;

  const catName = CATEGORIES[category].displayName.toLowerCase();
  const tagline = contested
    ? `Undercutting the market with a cut-price ${catName}.`
    : tone === "premium" ? `A premium ${catName} aimed at the top of the market.`
      : tone === "value" ? `An aggressive-value ${catName} built for volume.`
        : `A well-rounded ${catName} for the mainstream.`;

  return { rivalId, rivalName, week, category, product, overall, strength, tone, tagline, contested };
}
