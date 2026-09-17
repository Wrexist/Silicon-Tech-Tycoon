// Test Prototype: an OPTIONAL spend on the active design that returns a tighter forecast and may
// surface one flaw to fix. Optional on purpose — declining changes nothing, so existing pacing and
// the design -> build -> launch math are untouched, and a do-nothing run stays byte-identical.
import { BALANCE } from "./balance.ts";
import { scale, type Money } from "./money.ts";
import type { StatKey } from "./types.ts";

/** This wave's derived-hash salt. Side-channel randomness must never draw on the main sim RNG. */
export const PROTOTYPE_SALT = 317;

/** Tiny deterministic hash -> [0,1), copied verbatim from moonshots.ts (salt 307 stream). Each
 *  derived-hash stream owns its helper — there is no shared one — so 317 behaves like every other
 *  stream and never draws from the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function prototypeCost(era: number): Money {
  return scale(BALANCE.prototype.baseCost, 1 + (Math.max(1, era) - 1) * BALANCE.prototype.costPerEra);
}

export interface PrototypeOutcome {
  /** The one stat worth fixing, or null when the prototype found nothing to flag. */
  flaw: StatKey | null;
  /** How much tighter the forecast band gets, in the same units `forecastBand` consumes. */
  confidenceGain: number;
}

/** Resolve a prototype attempt for a (seed, week, draft). Pure and total: the same inputs always
 *  produce the same outcome, and the flaw can only ever be the draft's own weakest stat. */
export function prototypeOutcome(
  seed: number,
  week: number,
  args: { era: number; weakestStat: StatKey | null; rp: number },
): PrototypeOutcome {
  const roll = hash01(seed, week, PROTOTYPE_SALT);
  const found = args.rp >= BALANCE.prototype.rpToCatchFlaw && roll < BALANCE.prototype.flawChance;
  return {
    flaw: found ? args.weakestStat : null,
    confidenceGain: BALANCE.prototype.confidenceGain,
  };
}
