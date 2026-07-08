// Eureka breakthroughs — an active, funded R&D lab occasionally has a flash of insight: a staged
// "aha" moment with a REAL bet. Bank it for a guaranteed RP windfall, or CHASE the prototype — a
// jackpot-or-fizzle gamble. This turns the flat RP trickle into occasional earned spikes with a
// decision. PURE + deterministic.
//
// Sim-safe by construction: the cadence is a DERIVED hash of (seed, week) — never the sim RNG — and
// the payoff is player-CLAIMED via an opt-in reducer. The pinned auto-player runs solo (no researchers
// assigned) and never resolves, so it never fires or banks a breakthrough → byte-identical.
import { BALANCE } from "./balance.ts";
import type { ComponentKind } from "./types.ts";

export interface EurekaMoment {
  week: number;
  /** The component line the insight touched — pure flavour for the reveal ("a spark in the chip line"). */
  componentKind: ComponentKind;
  /** Guaranteed RP if the player BANKS it. */
  bankRp: number;
  /** CHASE payoffs (the outcome is rolled deterministically at resolve time). */
  jackpotRp: number;
  fizzleRp: number;
  jackpotChance: number;
}

/** Tiny deterministic hash → [0,1), same recipe as license offers / side orders — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const COMPONENT_LINES: readonly ComponentKind[] = ["chip", "display", "battery", "materials", "software", "camera"];

/** Should a breakthrough fire this week? Roughly one per cadence window (deterministic). Callers gate
 *  on era / active researchers / cooldown before consulting this. */
export function eurekaDue(seed: number, week: number): boolean {
  return hash01(seed, week, 71) < 1 / BALANCE.research.eureka.cadenceWeeks;
}

/** Build the moment: pick the flavour line + compute the bank/chase payoffs (scaled by era). Pure. */
export function generateEureka(seed: number, week: number, era: number): EurekaMoment {
  const e = BALANCE.research.eureka;
  const kind = COMPONENT_LINES[Math.floor(hash01(seed, week, 83) * COMPONENT_LINES.length) % COMPONENT_LINES.length];
  const bankRp = Math.round(e.bankRpBase + Math.max(0, Math.floor(era) - 1) * e.bankRpPerEra);
  return {
    week,
    componentKind: kind,
    bankRp,
    jackpotRp: Math.round(bankRp * e.jackpotMult),
    fizzleRp: Math.round(bankRp * e.fizzleMult),
    jackpotChance: e.jackpotChance,
  };
}

export interface EurekaOutcome {
  jackpot: boolean;
  rp: number;
}

/** Resolve a CHASE: roll the derived hash (seed, the breakthrough's week) for jackpot-or-fizzle. Pure +
 *  deterministic — the same moment always resolves the same way, so it's reproducible. */
export function resolveEurekaChase(seed: number, moment: EurekaMoment): EurekaOutcome {
  const jackpot = hash01(seed, moment.week, 97) < moment.jackpotChance;
  return { jackpot, rp: jackpot ? moment.jackpotRp : moment.fizzleRp };
}

/** A soft 0..0.95 "insight building" gauge for the Research banner — how close the lab is to its next
 *  flash, from weeks since the last one over the cadence window. The cadence is probabilistic, so it
 *  caps below full (the lab stays "primed", never reads a stuck 100%) and resets when one fires. The
 *  never-happened sentinel (a large negative) is floored to 0 so a fresh game starts empty, not full.
 *  Presentational only (not persisted). */
export function insightProgress(week: number, lastEurekaWeek: number | undefined): number {
  const last = Math.max(0, lastEurekaWeek ?? 0);
  return Math.max(0, Math.min(0.95, (week - last) / BALANCE.research.eureka.cadenceWeeks));
}
