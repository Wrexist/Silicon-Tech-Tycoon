// Pre-launch Keynote gamble (feature #4) — while a product is still in the build queue the player may
// "announce" it: commit to a public ship-by window for a hype bonus that pays off big if the promise is
// KEPT (ship inside the window) and stings if it SLIPS (window passes without launch). This turns the
// quiet build weeks into a real commit-vs-flexibility decision. PURE + deterministic.
//
// Sim-safe by construction: announce + launch are player actions (deterministic), the only randomness is
// the press-reaction FLAVOUR line, drawn from a DERIVED hash of (seed, week) — never the sim RNG. The
// pinned solo sim never builds, so it never announces → no keynote state is ever written → byte-identical.
import { BALANCE } from "./balance.ts";

/** Tiny deterministic hash → [0,1). SAME recipe as eureka / license offers / side orders — never the
 *  sim RNG. Salt 293 is reserved for the keynote press-flavour stream (registered in CLAUDE.md). */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The promise window in weeks = the build weeks still remaining at announce + a small grace. Committing
 *  earlier (more weeks remaining) means a longer public wait → more exposure to a slip, but a bigger max
 *  bonus (see keynoteMaxBonus). Floored at 1 so a near-done build still gets a real window. */
export function keynoteWindowWeeks(remainingBuildWeeks: number): number {
  return Math.max(1, Math.ceil(remainingBuildWeeks)) + BALANCE.keynote.graceWeeks;
}

/** The hype bonus LOCKED at announce for a KEPT promise. Scales with how far ahead you commit
 *  (remaining build weeks) — earlier announce = bigger max — at ~3%/lead-week over a small floor,
 *  capped so it can never out-stack mastery / mandates. Frozen onto the keynote so later balance
 *  changes never retro-alter a live promise. */
export function keynoteMaxBonus(remainingBuildWeeks: number): number {
  const k = BALANCE.keynote;
  const lead = Math.max(1, Math.ceil(remainingBuildWeeks));
  return Math.max(0, Math.min(k.maxHype, k.baseHype + k.perLeadWeek * lead));
}

/** Authored press-reaction flavour variants for the announce feed line. Pure text — never touches
 *  balance — so the hashed pick is purely cosmetic and safe to draw from a derived hash. */
const PRESS_FLAVOUR: readonly string[] = [
  "the tech press clears its calendar",
  "pre-order forums light up overnight",
  "the rumour mill goes into overdrive",
  "analysts scramble to revise their notes",
  "the community starts a countdown",
  "every gadget blog runs the teaser",
];

/** Pick the announce-week press flavour from the derived hash (seed, week, salt 293). Deterministic —
 *  the same announce always reads the same line, so it's reproducible. Cosmetic only. */
export function keynotePressFlavour(seed: number, week: number): string {
  return PRESS_FLAVOUR[Math.floor(hash01(seed, week, 293) * PRESS_FLAVOUR.length) % PRESS_FLAVOUR.length];
}
