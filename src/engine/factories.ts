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
import type { Product, FactoryId } from "./types.ts";

export type { FactoryId };

export type FactoryKind = "contract" | "owned";

export interface Factory {
  id: FactoryId;
  name: string;
  era: number;
  kind: FactoryKind; // P2 ships contract lines; owned lines arrive in P3
  toolingMult: number; // multiplies upfront tooling
  unitMult: number; // multiplies per-unit assembly cost
  speedMult: number; // multiplies build weeks (<1 faster)
  capacityPerWeek: number; // units/week before overtime (Infinity = no ceiling)
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
    blurb: "Cheap tooling and units, but slow and capacity-limited — best for smaller runs.",
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
    blurb: "Fast turnaround for a premium — first to market.",
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
    blurb: "Automated line — fast and cheap per unit at scale, but a steep setup.",
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
