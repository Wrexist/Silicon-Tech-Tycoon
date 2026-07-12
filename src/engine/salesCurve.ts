// Sales curve — turns a launchScore into a ramp→peak→decline volume curve over weeks. PURE.
import { BALANCE } from "./balance.ts";

export interface SalesForecast {
  totalUnits: number;
  weeklyUnits: number[]; // length = sales.totalWeeks
}

/** Word-of-mouth curve shaping (item 1.1). Overrides the default ramp/decline and adds an optional
 *  late "second wind" hump — so a loved product ramps fast and sells for weeks, a panned one spikes
 *  and collapses. All fields optional → omitted fields fall back to the flat BALANCE.sales defaults,
 *  so passing `undefined` reproduces the original curve byte-for-byte. */
export interface CurveShape {
  rampPow?: number;
  declinePow?: number;
  /** A gentle mid-tail resurgence (word of mouth), added to the decline weights. 0 = none. */
  tailLift?: number;
}

/** The curve shape for a launch verdict (item 1.1). "steady" is exactly the legacy default. */
export function verdictCurveShape(verdict: "hit" | "solid" | "steady" | "flop"): CurveShape {
  return BALANCE.sales.wordOfMouth[verdict];
}

/** Shape weights per week (unnormalized). `shape` word-of-mouth-tunes the silhouette; omitted → the
 *  flat BALANCE.sales defaults (identical to the pre-1.1 curve). */
function curveWeights(shape?: CurveShape): number[] {
  const { totalWeeks } = BALANCE.sales;
  const rampPow = shape?.rampPow ?? BALANCE.sales.rampPow;
  const declinePow = shape?.declinePow ?? BALANCE.sales.declinePow;
  const tailLift = Math.max(0, shape?.tailLift ?? 0);
  const peakWeek = Math.min(BALANCE.sales.peakWeek, totalWeeks - 1); // guard divide-by-zero if misconfigured
  const declineSpan = Math.max(1, totalWeeks - peakWeek);
  const w: number[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    if (i <= peakWeek) {
      w.push(Math.pow((i + 1) / (peakWeek + 1), rampPow));
    } else {
      const t = (i - peakWeek) / declineSpan;
      let d = Math.pow(Math.max(0, 1 - t), declinePow);
      // Word-of-mouth second wind: a soft hump centred mid-decline (peaks ~55% through the tail),
      // so a hit's sales resurge before the final fade instead of monotonically decaying.
      if (tailLift > 0) d += tailLift * Math.exp(-((t - 0.55) ** 2) / (2 * 0.22 * 0.22));
      w.push(d);
    }
  }
  return w;
}

/** Spread a fixed total over the ramp→peak→decline curve (sums to exactly `totalUnits`). `shape`
 *  word-of-mouth-tunes the silhouette (item 1.1); omitted → the legacy curve. */
export function distributeOverCurve(totalUnits: number, shapeOverride?: CurveShape): number[] {
  const total = Math.max(0, Math.round(totalUnits));
  const shape = curveWeights(shapeOverride);
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
