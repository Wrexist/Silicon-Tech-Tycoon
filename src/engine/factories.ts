// Manufacturing factories — the "where (and how hard) you build" decision. Picking a factory for a
// product trades four axes:
//   • tooling   — multiplies the upfront tooling/first-run setup cost
//   • unit      — multiplies the per-unit assembly cost
//   • speed     — multiplies the build duration (weeks); <1 = faster to market
//   • capacity  — units/week the line can build before OVERTIME kicks in; a run that exceeds
//                 capacity × build-weeks pays an overtime surcharge on the excess units
// A cheap budget line is great for a boutique run and brutal for a mass run (overtime); a premium
// line costs more to set up but builds faster and at scale. PURE. The chosen id lives on the Product
// (product.factoryId). The "standard" factory is neutral (×1) with UNLIMITED capacity, so an unset
// factory behaves exactly as before suppliers/factories existed.
import type { Money } from "./money.ts";
import { dollars, ZERO } from "./money.ts";
import type { Product, FactoryId, CapacityStrategy } from "./types.ts";

export type { FactoryId, CapacityStrategy };

export type FactoryKind = "contract" | "owned";

export interface Factory {
  id: FactoryId;
  name: string;
  era: number;
  kind: FactoryKind; // contract = pay-per-use; owned = buy the line (acquireCost) + carry upkeep
  toolingMult: number; // multiplies upfront tooling
  unitMult: number; // multiplies per-unit assembly cost
  speedMult: number; // multiplies build weeks (<1 faster)
  capacityPerWeek: number; // units/week before overtime (Infinity = no ceiling)
  acquireCost: Money; // one-time cost to own the line (0 for contract)
  weeklyUpkeep: Money; // rent/maintenance charged every week you own it, idle or not (0 for contract)
  blurb: string;
}

/** Unset / older-save products resolve to this — neutral cost & speed, no capacity ceiling. */
export const DEFAULT_FACTORY_ID: FactoryId = "standard";

export const FACTORIES: Record<FactoryId, Factory> = {
  standard: {
    id: "standard",
    name: "Everline Assembly",
    era: 1,
    kind: "contract",
    toolingMult: 1.0,
    unitMult: 1.0,
    speedMult: 1.0,
    capacityPerWeek: Infinity,
    acquireCost: ZERO,
    weeklyUpkeep: ZERO,
    blurb: "Standard contract line. No surprises, no capacity ceiling.",
  },
  eastwind: {
    id: "eastwind",
    name: "Eastwind Budget",
    era: 1,
    kind: "contract",
    toolingMult: 0.7,
    unitMult: 0.9,
    speedMult: 1.3,
    capacityPerWeek: 1500,
    acquireCost: ZERO,
    weeklyUpkeep: ZERO,
    blurb: "Cheap tooling and units, but slow and capacity-limited, best for smaller runs.",
  },
  kairos: {
    id: "kairos",
    name: "Kairos Rapid",
    era: 2,
    kind: "contract",
    toolingMult: 1.2,
    unitMult: 1.05,
    speedMult: 0.7,
    capacityPerWeek: Infinity,
    acquireCost: ZERO,
    weeklyUpkeep: ZERO,
    blurb: "Fast turnaround for a premium, first to market.",
  },
  apex: {
    id: "apex",
    name: "Apex Automated",
    era: 3,
    kind: "contract",
    toolingMult: 1.5,
    unitMult: 0.82,
    speedMult: 0.7,
    capacityPerWeek: Infinity,
    acquireCost: ZERO,
    weeklyUpkeep: ZERO,
    blurb: "Automated line, fast and cheap per unit at scale, but a steep setup.",
  },
  homeline: {
    id: "homeline",
    name: "Homeline 1",
    era: 2,
    kind: "owned",
    toolingMult: 0.5,
    unitMult: 0.88,
    speedMult: 0.85,
    capacityPerWeek: 8000,
    acquireCost: dollars(900_000),
    weeklyUpkeep: dollars(9_000),
    blurb: "Your own line: half the tooling and cheaper units, but a big buy-in and weekly upkeep.",
  },
  gigafab: {
    id: "gigafab",
    name: "GigaFab",
    era: 3,
    kind: "owned",
    toolingMult: 0.45,
    unitMult: 0.78,
    speedMult: 0.65,
    capacityPerWeek: Infinity,
    acquireCost: dollars(9_000_000),
    weeklyUpkeep: dollars(60_000),
    blurb: "A flagship in-house megafab: fastest, cheapest at scale, unlimited capacity, at a price.",
  },
};

export const FACTORY_LIST: Factory[] = Object.values(FACTORIES);

/** Resolve a (possibly missing/invalid) factory id to its definition; defaults to standard. */
export function factoryFor(id?: FactoryId): Factory {
  return (id && FACTORIES[id]) || FACTORIES[DEFAULT_FACTORY_ID];
}

export function unlockedFactories(era: number): Factory[] {
  return FACTORY_LIST.filter((f) => f.era <= era);
}

export function isFactoryUnlocked(id: FactoryId, era: number): boolean {
  return factoryFor(id).era <= era;
}

/** Factories the player can build at right now: every era-unlocked CONTRACT line, plus any OWNED
 *  line they've acquired. (Owned lines must be bought in Operations before they can be selected.) */
export function availableFactories(era: number, owned: FactoryId[] = []): Factory[] {
  return unlockedFactories(era).filter((f) => f.kind === "contract" || owned.includes(f.id));
}

/** Owned lines available to acquire at this era that the player doesn't already own. */
export function acquirableFactories(era: number, owned: FactoryId[] = []): Factory[] {
  return unlockedFactories(era).filter((f) => f.kind === "owned" && !owned.includes(f.id));
}

/** Total weekly upkeep for the owned lines a company runs (idle or not). */
export function totalFactoryUpkeep(owned: FactoryId[] = []): Money {
  return owned.reduce((sum, id) => (sum + factoryFor(id).weeklyUpkeep) as Money, ZERO);
}

// --- Per-product effect accessors (read product.factoryId) -----------------------------------
export const factoryToolingMult = (p: Product): number => factoryFor(p.factoryId).toolingMult;
export const factoryUnitMult = (p: Product): number => factoryFor(p.factoryId).unitMult;
export const factorySpeedMult = (p: Product): number => factoryFor(p.factoryId).speedMult;
export const factoryCapacityPerWeek = (p: Product): number => factoryFor(p.factoryId).capacityPerWeek;

/** Units that exceed the factory's throughput over the build window (and so cost overtime). Pure. */
export function overtimeUnits(plannedUnits: number, capacityPerWeek: number, buildWeeks: number): number {
  if (!Number.isFinite(capacityPerWeek)) return 0;
  const ceiling = capacityPerWeek * Math.max(1, buildWeeks);
  return Math.max(0, Math.round(plannedUnits) - ceiling);
}

export interface CapacityOutcome {
  overUnits: number; // units beyond capacity × build-weeks
  buildWeeks: number; // the resolved build duration (stretched if the strategy extends it)
  overtimeFraction: number; // surcharge applied per over-capacity unit (0 unless "overtime")
  qualityPenalty: number; // quality-stat hit (0 unless "defects")
}

/** Resolve an over-capacity run by the chosen strategy. Within capacity → a clean no-op. PURE:
 *  - overtime: keep the schedule, pay a surcharge on the excess units.
 *  - stretch:  extend the schedule so throughput fits capacity, no surcharge.
 *  - defects:  keep schedule + cost, but the quality stat takes a hit scaled by how far over you ran. */
export function resolveCapacity(opts: {
  plannedUnits: number;
  capacityPerWeek: number;
  assemblyWeeks: number;
  strategy: CapacityStrategy;
  overtimeSurcharge: number;
  defectMaxPenalty: number;
}): CapacityOutcome {
  const { plannedUnits, capacityPerWeek, assemblyWeeks, strategy, overtimeSurcharge, defectMaxPenalty } = opts;
  const overUnits = overtimeUnits(plannedUnits, capacityPerWeek, assemblyWeeks);
  if (overUnits <= 0) {
    return { overUnits: 0, buildWeeks: assemblyWeeks, overtimeFraction: 0, qualityPenalty: 0 };
  }
  if (strategy === "stretch") {
    const needed = Math.ceil(Math.max(0, Math.round(plannedUnits)) / capacityPerWeek);
    return { overUnits, buildWeeks: Math.max(assemblyWeeks, needed), overtimeFraction: 0, qualityPenalty: 0 };
  }
  if (strategy === "defects") {
    const ceiling = capacityPerWeek * Math.max(1, assemblyWeeks);
    const overageRatio = ceiling > 0 ? Math.min(1, overUnits / ceiling) : 1;
    return { overUnits, buildWeeks: assemblyWeeks, overtimeFraction: 0, qualityPenalty: Math.round(defectMaxPenalty * overageRatio) };
  }
  // overtime (default)
  return { overUnits, buildWeeks: assemblyWeeks, overtimeFraction: overtimeSurcharge, qualityPenalty: 0 };
}
