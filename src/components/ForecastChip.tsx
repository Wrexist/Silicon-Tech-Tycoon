import { TrendingUp } from "lucide-react";
import type { Product } from "../engine/types.ts";
import type { GameState } from "../state/gameState.ts";
import { readyForecast } from "../state/launchForecast.ts";

/** "Forecast: Solid performer" on a built product waiting to ship, so launching isn't a blind tap.
 *  Same bars and campaign the launch itself will use. */
export function ForecastChip({ state, product }: { state: GameState; product: Product }) {
  const f = readyForecast(state, product);
  return (
    <span className={`forecast-chip forecast-chip--${f.tone}`} title={`Forecast: ${f.label}`}>
      <TrendingUp size={11} aria-hidden /> <span className="sr-only">Forecast: </span>{f.label}
    </span>
  );
}
