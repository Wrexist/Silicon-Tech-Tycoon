// Forecast confidence — the converging pre-launch forecast (Epic C2). PURE.
//
// The build wizard shows a demand RANGE, not a single number. How WIDE that range is — and how far
// the real launch can land from the point estimate — should TIGHTEN as the player invests in knowing
// their market: marketer skill (market intuition) and the Demand Sensing research project (analytics).
// This is Motorsport Manager's feedback loop done RIGHT — it narrows with investment, and it stays
// HONEST: the same confidence scales the realized launch variance (gameState.launchReady), so a tight
// band is a truthful promise rather than a comforting lie. Readable simulation, pillar #5.
import { BALANCE } from "./balance.ts";

export interface ForecastInputs {
  /** Effective marketer skill driving market intuition (0..~10+). */
  marketerSkill: number;
  /** Whether the Demand Sensing research project is completed (analytics). */
  demandSensing: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** 0..maxConfidence — how reliable the launch forecast is, from accumulated market knowledge. */
export function forecastConfidence(inp: ForecastInputs): number {
  const f = BALANCE.market.forecast;
  const fromSkill = Math.max(0, inp.marketerSkill) * f.skillConfidencePerPoint;
  const fromSensing = inp.demandSensing ? f.demandSensingConfidence : 0;
  return clamp(fromSkill + fromSensing, 0, f.maxConfidence);
}

/** The ± band fraction shown in the wizard AND the cap on realized launch variance. Lerps from the
 *  base band (no market knowledge) down to the floor band (max confidence) — never below the floor.
 *  `confidence` is normalized against maxConfidence so the mapping holds if maxConfidence is retuned. */
export function forecastBand(confidence: number): number {
  const f = BALANCE.market.forecast;
  const c = f.maxConfidence > 0 ? clamp(confidence / f.maxConfidence, 0, 1) : 0;
  return f.baseBand - c * (f.baseBand - f.minBand);
}

/** Plain-language confidence label for the UI. */
export function forecastConfidenceLabel(confidence: number): "Low" | "Medium" | "High" {
  const f = BALANCE.market.forecast;
  const c = f.maxConfidence > 0 ? clamp(confidence / f.maxConfidence, 0, 1) : 0;
  if (c >= 0.5) return "High";
  if (c >= 0.25) return "Medium";
  return "Low";
}
