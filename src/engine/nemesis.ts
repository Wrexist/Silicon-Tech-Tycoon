// The Arch-Rival / Nemesis — one rival becomes YOUR villain: a persistent 1:1 rivalry with a living
// "heat" meter and a head-to-head record that escalates on every clash (you overtake them, they strike
// you, an awards duel) and cools in quiet weeks. A hot nemesis fights back — biasing its launches at
// your strongest category with a heat-scaled edge — and taunts you in the feed. PURE + deterministic.
//
// Sim-safe by construction: a nemesis only forms when the player CLASHES with a rival (overtakes one,
// gets struck, loses an awards duel), which the pinned auto-player — it ships nothing and beats no one —
// never does. So a do-nothing run never enters the branch and stays byte-identical. All side-channel
// randomness (taunt pick) is a DERIVED hash of (seed, week), NEVER the main sim RNG stream.
import { BALANCE } from "./balance.ts";

export interface Nemesis {
  rivalId: string;
  sinceWeek: number;
  heat: number;       // 0..100 rivalry intensity
  peakHeat: number;   // high-water mark (drives the "bitter"/"all-out" flavour + never regresses)
  playerWins: number; // head-to-head tally
  rivalWins: number;
  lastClashWeek: number;
}

/** A clash this tick, harvested from signals the tick already computes. `forming` kinds can BIRTH a
 *  nemesis (a rival aggressed or was bested); all kinds stoke an existing one. */
export type ClashKind = "overtake" | "dethroned" | "struck" | "awardWin" | "awardLoss";
export interface ClashSignal { kind: ClashKind; rivalId: string; }

function clashEffect(kind: ClashKind): { heat: number; pw: number; rw: number } {
  const h = BALANCE.competitors.nemesis.heat;
  switch (kind) {
    case "overtake":  return { heat: h.overtake, pw: 1, rw: 0 };
    case "dethroned": return { heat: h.dethroned, pw: 1, rw: 0 };
    case "struck":    return { heat: h.struck, pw: 0, rw: 1 };
    case "awardWin":  return { heat: h.awardWin, pw: 1, rw: 0 };
    case "awardLoss": return { heat: h.awardLoss, pw: 0, rw: 1 };
  }
}

export type HeatTier = "simmering" | "heated" | "bitter" | "allout";

/** Bucket rivalry heat into a UI tier (label + escalation). */
export function heatTier(heat: number): HeatTier {
  if (heat >= 80) return "allout";
  if (heat >= 55) return "bitter";
  if (heat >= 28) return "heated";
  return "simmering";
}
export const HEAT_TIER_LABEL: Record<HeatTier, string> = {
  simmering: "Simmering", heated: "Heated", bitter: "Bitter", allout: "All-out war",
};

/** Advance the rivalry one week: prune if the rival is gone, form on the strongest forming clash when
 *  there's no nemesis, apply this week's clashes with the nemesis, else decay. Returns the (possibly
 *  new) nemesis plus `declared` (non-null only on the week it first forms — drives the reveal moment).
 *  Pure: `existsById` and `pickWeight` are injected so this never touches the competitor list directly. */
export function updateNemesis(args: {
  current: Nemesis | null;
  signals: readonly ClashSignal[];
  week: number;
  existsById: (id: string) => boolean;
  pickWeight: (id: string) => number; // tie-break weight when several clashes could form (e.g. rival reputation)
}): { nemesis: Nemesis | null; declared: Nemesis | null } {
  const n = BALANCE.competitors.nemesis;
  let current = args.current;
  if (current && !args.existsById(current.rivalId)) current = null; // rival left the field → rivalry over

  let declared: Nemesis | null = null;
  if (!current) {
    const forming = args.signals.filter((s) => args.existsById(s.rivalId));
    if (forming.length) {
      let best = forming[0];
      for (const s of forming) {
        const w = args.pickWeight(s.rivalId);
        const bw = args.pickWeight(best.rivalId);
        if (w > bw || (w === bw && s.rivalId < best.rivalId)) best = s;
      }
      current = { rivalId: best.rivalId, sinceWeek: args.week, heat: n.formHeat, peakHeat: n.formHeat, playerWins: 0, rivalWins: 0, lastClashWeek: args.week };
      declared = current;
    }
  }
  if (!current) return { nemesis: null, declared: null };

  const mine = args.signals.filter((s) => s.rivalId === current!.rivalId);
  let { heat, playerWins, rivalWins, lastClashWeek } = current;
  if (mine.length === 0) {
    heat = Math.max(0, heat - n.decayPerWeek);
  } else {
    for (const s of mine) {
      const e = clashEffect(s.kind);
      heat += e.heat; playerWins += e.pw; rivalWins += e.rw;
    }
    lastClashWeek = args.week;
  }
  heat = Math.max(0, Math.min(100, heat));
  return {
    nemesis: { ...current, heat, peakHeat: Math.max(current.peakHeat, heat), playerWins, rivalWins, lastClashWeek },
    declared,
  };
}

/** The nemesis's launch edge: extra category weight toward the player's turf + a heat-scaled strength
 *  bonus (applied pre-cap, so it never breaches the winnability ceiling). Null for a non-nemesis rival. */
export function nemesisLaunchEdge(nemesis: Nemesis | null | undefined, rivalId: string): { turfWeight: number; strengthBonus: number } | null {
  if (!nemesis || nemesis.rivalId !== rivalId) return null;
  const n = BALANCE.competitors.nemesis;
  return { turfWeight: n.turfCategoryWeight, strengthBonus: n.turfStrengthBonusAtMaxHeat * (Math.max(0, Math.min(100, nemesis.heat)) / 100) };
}

// Doctrine-flavoured first-person taunts (the state layer prefixes the rival's name). IP-safe, fictional.
const TAUNTS: Record<string, readonly string[]> = {
  defender: [
    "Enjoy the spotlight. We were here first, and we'll be here last.",
    "A neat little launch. We'll answer it before your buyers notice.",
    "You're renting our market. We're about to collect.",
  ],
  trendChaser: [
    "Cute idea. We'll ship it better, and sooner.",
    "Thanks for the market research. We'll take it from here.",
    "Whatever you just launched, expect ours next quarter.",
  ],
  undercutter: [
    "Beautiful margins you've got there. Shame if someone undercut them.",
    "We'll sell the same thing for less, and your fans will notice.",
    "Premium is a nice word for overpriced. We'll fix that.",
  ],
  generalist: [
    "Don't get comfortable at the top. We're just warming up.",
    "Good launch. Ours is better, you'll see.",
    "You made this personal. We're happy to oblige.",
  ],
};

/** A doctrine-flavoured taunt, deterministically picked from a derived hash of (seed, week) — never the
 *  sim RNG. The caller prefixes the rival's name (the engine stays name-agnostic + IP-safe). */
export function nemesisTaunt(doctrine: string, seed: number, week: number): string {
  const pool = TAUNTS[doctrine] ?? TAUNTS.generalist;
  let h = ((seed >>> 0) ^ Math.imul((week + 1) >>> 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return pool[(h >>> 0) % pool.length];
}
