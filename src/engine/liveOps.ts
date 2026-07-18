// Sell-Window Ops (feature #2) — the derivations behind the live-products ops board. PURE, no RNG.
//
// A launched product spends ~16 weeks selling down its curve (salesCurve.ts). This module turns that
// curve into two legible things the ops card renders:
//   1. Momentum — a small meter that VISUALIZES where the product sits on its own sales curve (it does
//      not re-model sales; the curve already decays, this just reads it). Rising → peak → declining.
//   2. Harvest settlement — the math for winding the window down early: the forgone tail converted to an
//      instant cash + fans payout at a slight convenience discount, so it's a pacing choice not a cheat.
// Both are gated by optional fields (`harvested`, `marketingPushes`) that default to no-ops, so a
// product that never uses the board runs the exact legacy curve.
import { BALANCE } from "./balance.ts";
import type { LaunchedProduct } from "./types.ts";
import { scale, type Money } from "./money.ts";

export type OpsPhase = "rising" | "peak" | "declining" | "ended";

export interface Momentum {
  /** 0..1 — this week's sales relative to the product's own peak week. Naturally decays down the tail. */
  value: number;
  /** value × 100, rounded, for display. */
  pct: number;
  phase: OpsPhase;
  weeksElapsed: number;
  totalWeeks: number;
  weeksLeft: number;
  live: boolean;
  /** The curve's peak week index — the "best before" marker for a Boost. */
  peakWeek: number;
  /** True once the product has passed its peak with no Boost ever spent — the one-time "act now" nudge.
   *  Derived (not stored): it holds for the post-peak window while Boost is still unused, then clears
   *  the moment a Boost runs or the window ends. */
  crossedPeakBoostUnused: boolean;
}

/** Where a live product sits on its sales curve, as a small legible meter. Pure derivation from the
 *  product's own weekly curve + whether it's been harvested. */
export function productMomentum(lp: LaunchedProduct): Momentum {
  const weekly = lp.weeklyUnits;
  const totalWeeks = weekly.length;
  const elapsed = lp.weeksElapsed;
  const ended = !!lp.harvested || elapsed >= totalWeeks;
  const peakUnits = weekly.length ? Math.max(...weekly) : 0;
  const peakWeek = peakUnits > 0 ? weekly.indexOf(peakUnits) : 0;
  const idx = Math.min(elapsed, Math.max(0, totalWeeks - 1));
  const cur = ended || totalWeeks === 0 ? 0 : weekly[idx] ?? 0;
  const value = ended || peakUnits <= 0 ? 0 : Math.max(0, Math.min(1, cur / peakUnits));
  const weeksLeft = Math.max(0, totalWeeks - elapsed);
  const boostUnused = (lp.marketingPushes ?? 0) === 0;
  let phase: OpsPhase;
  if (ended) phase = "ended";
  else if (elapsed < peakWeek) phase = "rising";
  else if (elapsed === peakWeek) phase = "peak";
  else phase = "declining";
  return {
    value,
    pct: Math.round(value * 100),
    phase,
    weeksElapsed: elapsed,
    totalWeeks,
    weeksLeft,
    live: !ended,
    peakWeek,
    crossedPeakBoostUnused: !ended && elapsed > peakWeek && boostUnused,
  };
}

export interface HarvestSettlement {
  /** Remaining sellable units the tail would still have moved (the "momentum" being cashed out). */
  units: number;
  /** The instant settlement paid now (the discounted tail). */
  cash: Money;
  /** The full expected tail gross, for the plain-language "vs let it run" comparison. */
  grossTail: Money;
  /** Goodwill fans from the sunset sale, scaled to the remaining units. */
  fans: number;
}

/** The settlement for harvesting a live product early, or null when there's nothing left to harvest
 *  (already harvested, or the window has closed). Pure — drives both the confirm preview and the
 *  reducer, so the number the player sees is the number they get.
 *
 *  EV: the remaining tail would bring `grossTail` into cash (production is paid up front, so each unit
 *  sells at FULL price). The settlement pays `harvestSettlementFrac` of that — strictly ≤ the tail — so
 *  harvesting trades a slice of value for instant closure. Never mints money. */
export function harvestSettlement(lp: LaunchedProduct): HarvestSettlement | null {
  if (lp.harvested) return null;
  const totalWeeks = lp.weeklyUnits.length;
  if (lp.weeksElapsed >= totalWeeks) return null;
  // What the curve would still move from here, capped by the production run left (the tick caps each
  // week's sale at totalUnits − unitsSold, so honour the same ceiling — phantom units never pay out).
  const curveRemaining = lp.weeklyUnits.slice(lp.weeksElapsed).reduce((a, b) => a + b, 0);
  const supplyRemaining = Math.max(0, lp.totalUnits - lp.unitsSold);
  const units = Math.max(0, Math.min(curveRemaining, supplyRemaining));
  if (units <= 0) return null;
  const grossTail = scale(lp.product.price, units);
  const cash = scale(lp.product.price, Math.round(units * BALANCE.liveOps.harvestSettlementFrac));
  const fans = Math.round((units / 1000) * BALANCE.liveOps.harvestFansPer1k);
  return { units, cash, grossTail, fans };
}
