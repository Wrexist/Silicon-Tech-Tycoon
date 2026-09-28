// The projected launch outcome, in the words the player sees — ONE mapping from the live verdict bars
// to a label, shared by the Design Lab's forecast and the "Ready to launch" rows so a product can never
// read "Projected hit" in one place and "Steady seller" in another.
import { BALANCE } from "../engine/balance.ts";
import type { ChannelId } from "../engine/marketing.ts";
import type { Product } from "../engine/types.ts";
import { launchBars, planProduction, type GameState } from "./gameState.ts";

export type ForecastTone = "positive" | "accent" | "neutral";
export interface LaunchForecast { label: string; tone: ForecastTone; flop: boolean }

/** Map an effective launch score (launchScore × competitionFactor — the gate launchReady applies)
 *  onto the company's CURRENT verdict bars. */
export function forecastFromScore(effectiveScore: number, bands: { hit: number; solid: number; flop: number }): LaunchForecast {
  if (effectiveScore >= bands.hit) return { label: "Projected hit", tone: "positive", flop: false };
  if (effectiveScore <= bands.flop) return { label: "Needs refinement", tone: "neutral", flop: true };
  if (effectiveScore >= bands.solid) return { label: "Solid performer", tone: "positive", flop: false };
  return { label: "Steady seller", tone: "accent", flop: false };
}

/** Forecast for a BUILT product waiting on the shelf, with the campaign it was built with. Pure read. */
export function readyForecast(state: GameState, product: Product): LaunchForecast {
  const plan = planProduction(state, product, product.plannedUnits ?? BALANCE.build.minRun, (product.channelId as ChannelId) ?? "none");
  return forecastFromScore(plan.launchScore * plan.competitionFactor, launchBars(state));
}
