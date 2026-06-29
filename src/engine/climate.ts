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
