// Market events — periodic happenings that nudge the simulation and create timing decisions.
// PURE catalog + selection; the state layer interprets each effect.
import type { Rng } from "./rng.ts";
import { STAT_KEYS, type StatKey } from "./types.ts";

export type EventEffect =
  | { kind: "viralTrend"; stat: StatKey }
  | { kind: "rpBonus"; amount: number }
  | { kind: "rivalScandal"; factor: number }
  | { kind: "talentWave"; mood: number }
  | { kind: "supplyCrunch"; cash: number } // dollars cost
  | { kind: "pressFeature"; reputation: number }
  | { kind: "burnout"; mood: number };

export interface MarketEvent {
  id: string;
  title: string;
  minEra: number;
  weight: number;
  effect: EventEffect;
  tone: "positive" | "negative" | "neutral" | "accent";
}

const STAT_LABEL: Record<StatKey, string> = {
  performance: "performance",
  quality: "quality",
  battery: "battery life",
  design: "design",
  ecosystem: "ecosystem",
};

export const MARKET_EVENTS: MarketEvent[] = [
  { id: "press", title: "A glowing review put your brand in the spotlight.", minEra: 1, weight: 3, effect: { kind: "pressFeature", reputation: 5 }, tone: "positive" },
  { id: "rpbreak", title: "A research breakthrough accelerated your labs.", minEra: 1, weight: 3, effect: { kind: "rpBonus", amount: 14 }, tone: "accent" },
  { id: "scandal", title: "A rival's product was recalled — the field just opened up.", minEra: 1, weight: 2, effect: { kind: "rivalScandal", factor: 0.5 }, tone: "positive" },
  { id: "talent", title: "A wave of fresh energy lifted the whole team.", minEra: 1, weight: 2, effect: { kind: "talentWave", mood: 14 }, tone: "positive" },
  { id: "supply", title: "A supply crunch raised costs this quarter.", minEra: 1, weight: 2, effect: { kind: "supplyCrunch", cash: 8000 }, tone: "negative" },
  { id: "burnout", title: "Crunch time took a toll on morale.", minEra: 2, weight: 2, effect: { kind: "burnout", mood: -12 }, tone: "negative" },
  // viral trends are generated dynamically per stat below
];

export function pickEvent(rng: Rng, era: number): MarketEvent {
  // 35% of the time, a viral demand trend toward a random stat.
  if (rng.next() < 0.35) {
    const stat = STAT_KEYS[rng.int(STAT_KEYS.length)];
    return {
      id: `viral-${stat}`,
      title: `Consumers can't stop talking about ${STAT_LABEL[stat]}.`,
      minEra: 1,
      weight: 1,
      effect: { kind: "viralTrend", stat },
      tone: "accent",
    };
  }
  const pool = MARKET_EVENTS.filter((e) => e.minEra <= era);
  // Defensive: an out-of-range era could yield an empty pool — never return undefined.
  if (pool.length === 0) {
    return { id: "calm", title: "The market is quiet this week.", minEra: 1, weight: 1, effect: { kind: "rpBonus", amount: 0 }, tone: "neutral" };
  }
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let roll = rng.next() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}
