// Sales curve — turns a launchScore into a ramp→peak→decline volume curve over weeks. PURE.
import { BALANCE } from "./balance.ts";

export interface SalesForecast {
  totalUnits: number;
  weeklyUnits: number[]; // length = sales.totalWeeks
}

export type SalesPhase = "ramping" | "peak" | "declining" | "ended";

/** C4: where a launched product sits on its ramp->peak->decline curve right now, derived purely from
 *  its weeklyUnits + how many weeks have elapsed. "ended" once the curve is spent. Used to tag the
 *  "Selling now" rows so a melting hit reads as Declining, not just a shrinking number. Pure. */
export function salesPhase(weeklyUnits: readonly number[], weeksElapsed: number): SalesPhase {
  const n = weeklyUnits.length;
  if (n === 0 || weeksElapsed >= n) return "ended";
  let peakIdx = 0;
  let peak = -Infinity;
  for (let i = 0; i < n; i++) {
    if (weeklyUnits[i] > peak) { peak = weeklyUnits[i]; peakIdx = i; }
  }
  const cur = Math.max(0, weeksElapsed);
  if (cur < peakIdx) return "ramping";
  if (cur > peakIdx) return "declining";
  return "peak";
}

/** Shape weights per week (unnormalized). */
function curveWeights(): number[] {
  const { totalWeeks, rampPow, declinePow } = BALANCE.sales;
  const peakWeek = Math.min(BALANCE.sales.peakWeek, totalWeeks - 1); // guard divide-by-zero if misconfigured
  const declineSpan = Math.max(1, totalWeeks - peakWeek);
  const w: number[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    if (i <= peakWeek) {
      w.push(Math.pow((i + 1) / (peakWeek + 1), rampPow));
    } else {
      const t = (i - peakWeek) / declineSpan;
      w.push(Math.pow(Math.max(0, 1 - t), declinePow));
    }
  }
  return w;
}

/** Spread a fixed total over the ramp→peak→decline curve (sums to exactly `totalUnits`). */
export function distributeOverCurve(totalUnits: number): number[] {
  const total = Math.max(0, Math.round(totalUnits));
  const shape = curveWeights();
  const shapeSum = shape.reduce((a, b) => a + b, 0) || 1;
  const weeklyUnits: number[] = shape.map((s) => Math.floor((s / shapeSum) * total));
  let assigned = weeklyUnits.reduce((a, b) => a + b, 0);
  let remainder = total - assigned;
  const order = shape
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.i);
  let idx = 0;
  while (remainder > 0 && order.length) {
    weeklyUnits[order[idx % order.length]] += 1;
    remainder--;
    idx++;
  }
  return weeklyUnits;
}

export function forecast(launchScore: number, marketSize: number, priceFit = 1): SalesForecast {
  // Immunise this public boundary against non-finite inputs so a NaN/Infinity can never propagate
  // into weeklyUnits/totalUnits and reach the planner or UI (matches the engine's guard-at-the-edge
  // pattern). Today's callers pass clamped values; this is cheap insurance for the contract.
  marketSize = Number.isFinite(marketSize) ? Math.max(0, marketSize) : 0;
  priceFit = Number.isFinite(priceFit) ? Math.max(0, priceFit) : 1;
  launchScore = Number.isFinite(launchScore) ? launchScore : 0;
  const raw = launchScore * BALANCE.sales.scoreToVolume * marketSize;
  // Any product that ships at a sensible price sells *something* (keeps the early game teachable),
  // but the floor is SCALED BY priceFit so a grossly overpriced product loses it too. A
  // price-independent floor guaranteed a minimum unit count at ANY price, so revenue = floor × price
  // grew without bound — another "max price always sells" route. At a fair price priceFit ≈ 1 (full
  // teachable floor); when gouging, priceFit → 0 and the floor collapses with it.
  const floor = launchScore > 0 ? BALANCE.sales.floorUnits * marketSize * priceFit : 0;
  const totalUnits = Math.max(0, Math.round(Math.max(raw, floor)));
  const shape = curveWeights();
  const shapeSum = shape.reduce((a, b) => a + b, 0) || 1;
  const weeklyUnits: number[] = shape.map((s) => Math.floor((s / shapeSum) * totalUnits));

  // Distribute rounding remainder onto the peak weeks so totals match exactly.
  let assigned = weeklyUnits.reduce((a, b) => a + b, 0);
  let remainder = totalUnits - assigned;
  const order = shape
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.i);
  let idx = 0;
  while (remainder > 0 && order.length) {
    weeklyUnits[order[idx % order.length]] += 1;
    remainder--;
    idx++;
  }

  return { totalUnits, weeklyUnits };
}
