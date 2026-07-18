// The Nemesis Boss ladder (feature #7) — the arch-rival feud made into a VISIBLE, multi-week duel.
// While a nemesis stands (engine/nemesis.ts), a fixed-window challenge runs: out-VALUE them by a
// tier- and ascension-scaled margin before the countdown ends. Win → a trophy + a modest one-time
// reward, and the ladder tier escalates so the next duel demands a wider margin. Lose → no punishment
// beyond a taunt; the duel simply re-arms at the same tier.
//
// PURE + deterministic by construction: the duel is a weekly derivation of the player's company
// valuation vs the rival's market cap — no RNG in the win/lose decision. It only ever runs when a
// nemesis exists, and a nemesis only forms when the player CLASHES with a rival (which the pinned
// auto-player never does), so a do-nothing run never starts a duel → byte-identical. The only
// side-channel randomness (a victory flavour line) is a DERIVED hash of (seed, week, 277) — never the
// sim RNG, cosmetic-only.
import { BALANCE } from "./balance.ts";

export interface NemesisDuel {
  /** The rival being dueled — always mirrors the standing nemesis's rivalId. */
  rivalId: string;
  /** Week the duel armed. */
  startWeek: number;
  /** Week the window closes and the duel is judged. */
  endWeek: number;
  /** Ladder tier this duel was armed at (drives the target margin + reward). */
  tier: number;
  /** Your company value ÷ their market cap must reach this to win (snapshot of the tier/ascension
   *  scaling at arm time, so a mid-duel ascension change never moves the goalposts under the player). */
  targetMargin: number;
}

/** The margin the player must out-value the nemesis by to win, escalating with ladder tier and (so it
 *  stays meaningful at high Heat) the run's ascension level. Tier 0 asks for a slim lead; each rung
 *  widens it. Pure. */
export function duelTargetMargin(tier: number, ascensionLevel: number): number {
  const d = BALANCE.competitors.nemesis.duel;
  const t = Math.max(0, tier);
  const a = Math.max(0, ascensionLevel);
  return d.baseMargin + t * d.marginPerTier + a * d.marginPerAscension;
}

/** Arm a fresh duel window against `rivalId`, snapshotting the target margin for the given tier +
 *  ascension. Pure. */
export function startDuel(rivalId: string, week: number, tier: number, ascensionLevel: number): NemesisDuel {
  const d = BALANCE.competitors.nemesis.duel;
  return {
    rivalId,
    startWeek: week,
    endWeek: week + d.windowWeeks,
    tier: Math.max(0, tier),
    targetMargin: duelTargetMargin(tier, ascensionLevel),
  };
}

/** Live "you vs them" progress toward the win line, 0..1 (playerValue ÷ the margin-scaled target).
 *  Both values are plain dollars. A vanished rival (0 value) reads as already-won. Pure. */
export function duelProgress(playerValue: number, rivalValue: number, margin: number): number {
  const need = rivalValue * margin;
  if (need <= 0) return 1;
  return Math.max(0, Math.min(1, playerValue / need));
}

/** Has the player met the win line? (out-valued the nemesis by the required margin). Pure. */
export function duelMet(playerValue: number, rivalValue: number, margin: number): boolean {
  return playerValue >= rivalValue * margin;
}

/** The next ladder tier after a win, capped so the escalation can't run away into background noise. */
export function nextLadderTier(tier: number): number {
  return Math.min(BALANCE.competitors.nemesis.duel.tierCap, Math.max(0, tier) + 1);
}

export interface DuelReward {
  rep: number;
  fans: number;
  /** Only granted once the company is public (a Legacy-Era currency); 0 otherwise. */
  legacyPoints: number;
}

/** The one-time victory reward for clearing a duel at `tier`. Modest and economy-safe — a little rep +
 *  fans that grows slightly per rung, plus a single legacy point post-IPO. Pure. */
export function duelReward(tier: number, wentPublic: boolean): DuelReward {
  const r = BALANCE.competitors.nemesis.duel.reward;
  const t = Math.max(0, tier);
  return {
    rep: r.baseRep + t * r.repPerTier,
    fans: r.baseFans + t * r.fansPerTier,
    legacyPoints: wentPublic ? r.legacyPointsPostIpo : 0,
  };
}

// A short, triumphant "the ladder rises" flavour pool for the victory beat. Name-agnostic + IP-safe;
// the state layer fills {rival}. Cosmetic only.
const VICTORY_LINES: readonly string[] = [
  "You out-built {rival} over the window. They regroup — and come back harder.",
  "The duel with {rival} is yours. But a wounded rival is a dangerous one.",
  "{rival} blinked first. The ladder rises; the next round will cost more.",
  "You held the line against {rival} and won. They'll want that trophy back.",
];

/** A deterministic victory flavour line, picked from a DERIVED hash of (seed, week, 277) — never the
 *  sim RNG. Fresh salt 277 keeps it uncorrelated from every other side channel. Cosmetic-only. */
export function duelVictoryLine(seed: number, week: number): string {
  let h = ((seed >>> 0) ^ Math.imul((week + 1) >>> 0, 0x9e3779b1) ^ Math.imul((277 + 1) >>> 0, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return VICTORY_LINES[(h >>> 0) % VICTORY_LINES.length];
}
