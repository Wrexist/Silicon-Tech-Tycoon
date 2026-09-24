import { DEFAULT_FACTORY_ID, factoryFor } from '../engine/factories.ts';
import { effectiveCapacityPerWeek, type GameState } from './gameState.ts';

/** The workshop is available from a new company's first day; individual purchases cost cash. */
export function hasFactoryAccess(_state: {
  era: number; ownedFactories: readonly unknown[]; building: readonly unknown[];
  ready: readonly unknown[]; launched: readonly unknown[];
}): boolean {
  return true;
}

/** A current-capacity forecast for the displayed run, not an invented shared-factory scheduler. */
export function factoryProductionSummary(state: GameState) {
  const lead = state.building[0] ?? null;
  const fac = factoryFor(lead?.product.factoryId ?? state.ownedFactories[0] ?? DEFAULT_FACTORY_ID);
  const capacity = lead ? effectiveCapacityPerWeek(state, lead.product) : fac.capacityPerWeek;
  const weeklyLoad = lead ? (lead.plannedUnits ?? 0) / Math.max(1, lead.totalWeeks) : 0;
  const util = Number.isFinite(capacity) && capacity > 0 ? weeklyLoad / capacity : null;
  const liveProducts = state.launched.filter(l => l.weeksElapsed < l.weeklyUnits.length);
  return {
    fac, util, overtime: util != null && util > 1,
    selling: liveProducts.length > 0,
    unitsWk: liveProducts.reduce((sum, l) => sum + (l.weeklyUnits[l.weeksElapsed] ?? 0), 0),
  };
}
