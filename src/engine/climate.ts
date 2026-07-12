// Market climate (Track B: a world that reacts) — the market is not static. Buyer SEGMENTS swell and
// fade on slow seasonal cycles (so the same recipe wins more or less depending on WHEN you ship), and
// individual REGIONS hit periodic crises that temporarily shrink their demand (so a globally-expanded
// player rides real ups and downs). Deterministic from the week — no rng, no persisted state — so it's
// readable and reproducible: the player can learn the rhythm and time the market against it. PURE.
import { BALANCE } from "./balance.ts";
import type { RegionId, SegmentId } from "./types.ts";

const TAU = Math.PI * 2;

// Each segment oscillates on its own period + phase so the mix is always shifting, never in lockstep.
const SEGMENT_CYCLE: Record<SegmentId, { period: number; phase: number }> = {
  budget: { period: 41, phase: 0.0 },
  mainstream: { period: 47, phase: 0.3 },
  pro: { period: 37, phase: 0.6 },
  style: { period: 29, phase: 0.15 },
  enterprise: { period: 53, phase: 0.8 },
};

/** A segment's size multiplier this week (mean 1.0), swinging by ±amplitude on its own slow cycle.
 *  Applied to the segment MIX and re-normalized by the caller, so the cycle redistributes demand
 *  between segments without inflating the total — timing positioning, not free volume. */
export function segmentSizeMul(seg: SegmentId, week: number): number {
  const c = SEGMENT_CYCLE[seg];
  if (!c) return 1;
  const amp = BALANCE.market.climate.segmentAmplitude;
  return 1 + amp * Math.sin(TAU * (week / c.period + c.phase));
}

// Regions enter a crisis on a long period, staggered, for a short window. Home is never shocked.
const REGION_CYCLE: Record<string, { period: number; offset: number }> = {
  north_america: { period: 88, offset: 12 },
  europe: { period: 96, offset: 40 },
  asia: { period: 80, offset: 64 },
  emerging: { period: 72, offset: 24 },
};

/** A region's demand multiplier this week: 1.0 normally, easing down to (1 − crisisDepth) at the
 *  middle of its periodic crisis window. Home (your domestic base) is always stable at 1.0. */
export function regionShockMul(region: RegionId, week: number): number {
  if (region === "home") return 1;
  const c = REGION_CYCLE[region];
  if (!c) return 1;
  const cl = BALANCE.market.climate;
  const phase = (((week - c.offset) % c.period) + c.period) % c.period;
  if (phase < cl.crisisWeeks) {
    const ease = Math.sin(Math.PI * (phase / cl.crisisWeeks)); // 0 at the edges, 1 at the middle
    return 1 - cl.crisisDepth * ease;
  }
  return 1;
}

/** Whether a region is currently in a noticeable crisis (for UI badges). */
export function regionInCrisis(region: RegionId, week: number): boolean {
  return regionShockMul(region, week) < 0.97;
}

/** A coarse label for how a segment's demand is trending this week (for a readable climate UI):
 *  rising past +risingBand, falling past −risingBand, else steady. Uses next week vs. this week. */
export function segmentTrend(seg: SegmentId, week: number): "rising" | "falling" | "steady" {
  const delta = segmentSizeMul(seg, week + 1) - segmentSizeMul(seg, week);
  const band = BALANCE.market.climate.risingBand;
  if (delta > band) return "rising";
  if (delta < -band) return "falling";
  return "steady";
}

// --- Narration (Track B) — turn the silent climate cycles into readable feed beats. PURE. ---
// climate.ts is imported by segments.ts / regions.ts, so it can't import their label maps back
// (circular). The handful of names the narration needs live here, locally.
const SEGMENT_LABEL: Record<SegmentId, string> = {
  budget: "Budget", mainstream: "Mainstream", pro: "Pro", style: "Style", enterprise: "Enterprise",
};
const REGION_LABEL: Record<string, string> = {
  north_america: "North America", europe: "Europe", asia: "Asia", emerging: "Emerging Markets",
};
// Order the world reads in — deterministic, so run1 === run2.
const SEGMENT_ORDER: readonly SegmentId[] = ["budget", "mainstream", "pro", "style", "enterprise"];
const REGION_ORDER: readonly string[] = ["north_america", "europe", "asia", "emerging"];

export type ClimateBeat = { text: string; tone: "positive" | "negative" | "accent" };

/** At most one narration beat for this week's climate, or null. Region crises (rarer, more dramatic)
 *  take priority over segment surges. Fully derived from `week` + the unlocked-region list — no RNG,
 *  no state — so it stays byte-identical across a replay. Called weekly; each cycle event fires once
 *  (crisis onset/recovery on the edge week, a segment surge on the week it tops out). */
export function climateNarration(week: number, unlockedRegions: readonly RegionId[]): ClimateBeat | null {
  if (week < 1) return null;
  // 1) Region crises — a region tipping INTO or OUT OF a downturn, only for markets you've opened.
  for (const region of REGION_ORDER) {
    if (!unlockedRegions.includes(region as RegionId)) continue;
    const now = regionInCrisis(region as RegionId, week);
    const before = regionInCrisis(region as RegionId, week - 1);
    if (now && !before) {
      return { text: `${REGION_LABEL[region]} is sliding into a downturn — demand there will soften for a while.`, tone: "negative" };
    }
    if (!now && before) {
      return { text: `${REGION_LABEL[region]} is climbing out of its slump — demand there is recovering.`, tone: "positive" };
    }
  }
  // 2) Segment surges — a buyer segment cresting the top of its slow cycle (a good window to ship for it).
  const amp = BALANCE.market.climate.segmentAmplitude;
  const peakFloor = 1 + amp * 0.82; // only narrate a genuinely swollen segment, not every ripple
  for (const seg of SEGMENT_ORDER) {
    const prev = segmentSizeMul(seg, week - 1);
    const cur = segmentSizeMul(seg, week);
    const next = segmentSizeMul(seg, week + 1);
    if (cur > prev && cur >= next && cur >= peakFloor) {
      return { text: `${SEGMENT_LABEL[seg]} buyers are out in force right now — a strong week to court that segment.`, tone: "accent" };
    }
  }
  return null;
}
