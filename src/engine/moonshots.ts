// Moonshot R&D gambles (FEATURES_RANKED #5) — an opt-in, high-cost EXPERIMENTAL research track for the
// late game (era 3+). The ordinary tree is fully solvable: every project is a guaranteed purchase. A
// moonshot is the opposite — it spends a steep pile of RP on a VISIBLE success probability. Land it and
// you bank a unique, permanent reward; miss and most of the RP burns (a small pity refund softens the
// blow). This gives late-game RP a real sink in the research-exhaustion limbo and adds honest,
// telegraphed risk to a game that is otherwise deterministic.
//
// PURE + deterministic, sim-safe by construction:
//  - The outcome is a DERIVED hash of (seed, week, moonshot) — the SAME canonical recipe as eureka /
//    license offers, NEVER the sim RNG. Salt 307 (registered in CLAUDE.md), with a per-moonshot
//    sub-salt folded in the way staff life events fold theirs, so each (seed, week, moonshot) resolves
//    the same way every replay but two moonshots on the same week can differ.
//  - There is no cadence and no interrupt: a moonshot only resolves when the PLAYER attempts it (an
//    opt-in reducer). A do-nothing run never attempts → the optional state stays empty → byte-identical.
//  - Every persistent reward folds through the existing prestige/design-budget/product-stat seams via
//    moonshotBonuses(), gated on membership in moonshotsWon. Empty won → the neutral bonus.
import type { Stats } from "./types.ts";

/** What a moonshot grants on success. Persistent kinds fold through moonshotBonuses(); `windfall` is a
 *  one-time hit applied at the moment of success (fans + reputation) and is NOT in the aggregation. */
export type MoonshotRewardKind =
  | "designCeiling" // + to the design-tier ceiling (structural — lets a build push one tier higher)
  | "epBudget"      // + EP to every project's design budget (feature #1)
  | "buildCost"     // fractional build-cost REDUCTION
  | "rpMult"        // + fractional weekly-RP income multiplier
  | "signature"     // a unique named per-product stat flourish (folds into productStats)
  | "windfall";     // a ONE-TIME fan + reputation surge (a named "breakthrough" feed moment)

export interface MoonshotReward {
  kind: MoonshotRewardKind;
  /** Plain-language one-liner for the card + the success feed line (e.g. "Design ceiling +1"). */
  label: string;
  designCeiling?: number;
  epBudget?: number;
  buildCostMult?: number; // 0.08 = −8% build cost
  rpMult?: number;        // 0.25 = +25% weekly RP
  stat?: Partial<Stats>;  // signature: a per-product stat bonus (applies to every product you ship)
  fans?: number;          // windfall
  reputation?: number;    // windfall
}

export interface Moonshot {
  id: string;
  name: string;
  /** A single flavour line for the card. */
  flavor: string;
  /** Steep — a meaningful multiple of a late-game research project (era-3 projects top out ~340 RP). */
  rpCost: number;
  /** Minimum era to attempt (3+, some 4+). */
  era: number;
  /** Visible success chance, stated plainly on the card. Authored inside [0.30, 0.70]. */
  successChance: number;
  reward: MoonshotReward;
}

/** Fraction of the RP cost returned on a FAILED attempt (the pity refund). The rest burns. */
export const MOONSHOT_PITY_REFUND = 0.25;
/** Hard minimum weeks between attempts of the SAME moonshot after a failure (a retry cooldown). A
 *  success is once-per-run, so cooldown only ever gates a moonshot you have not yet landed. */
export const MOONSHOT_COOLDOWN_WEEKS = 26;

// The catalog — six authored moonshots. Higher-value rewards carry lower odds, so the risk is honest
// and telegraphed. Costs sit well above the biggest ordinary projects (era-3 caps ~340, era-4 ~560),
// so a dedicated late-game lab can try most, but spamming attempts is never optimal.
export const MOONSHOTS: readonly Moonshot[] = [
  {
    id: "culturalMoment",
    name: "Cultural Singularity",
    flavor: "Bet the lab on one world-stopping demo — land it and the culture turns your way overnight.",
    rpCost: 460,
    era: 3,
    successChance: 0.65,
    reward: { kind: "windfall", label: "+8,000 fans and +4 reputation, instantly", fans: 8000, reputation: 4 },
  },
  {
    id: "neuralLattice",
    name: "Neural Design Lattice",
    flavor: "Let a generative model co-author your industrial design — if the aesthetic actually lands.",
    rpCost: 480,
    era: 3,
    successChance: 0.60,
    reward: { kind: "designCeiling", label: "Design ceiling +1 — push every build one tier higher", designCeiling: 1 },
  },
  {
    id: "genFoundry",
    name: "Generative Foundry",
    flavor: "Self-optimising tooling that packs more engineering into every board you lay out.",
    rpCost: 520,
    era: 3,
    successChance: 0.55,
    reward: { kind: "epBudget", label: "+3 EP to every project's design budget", epBudget: 3 },
  },
  {
    id: "zeroWaste",
    name: "Zero-Waste Fabrication",
    flavor: "A closed-loop line that recovers nearly every gram of material — if the process holds.",
    rpCost: 560,
    era: 3,
    successChance: 0.50,
    reward: { kind: "buildCost", label: "Build costs −8%, permanently", buildCostMult: 0.08 },
  },
  {
    id: "quantumCluster",
    name: "Quantum Research Cluster",
    flavor: "A speculative compute substrate that could compound every future breakthrough — or never boot.",
    rpCost: 760,
    era: 4,
    successChance: 0.45,
    reward: { kind: "rpMult", label: "+25% weekly research income, permanently", rpMult: 0.25 },
  },
  {
    id: "signatureSemantics",
    name: "Signature Semantics",
    flavor: "A house design language so distinctive that every device you ship wears it unmistakably.",
    rpCost: 820,
    era: 4,
    successChance: 0.40,
    reward: { kind: "signature", label: "A signature look: +3 Design and +3 Ecosystem on every product", stat: { design: 3, ecosystem: 3 } },
  },
];

/** Tiny deterministic hash → [0,1), the SAME recipe as eureka / license offers — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function moonshotById(id: string): Moonshot | undefined {
  return MOONSHOTS.find((m) => m.id === id);
}

/** The catalog index of a moonshot (its per-moonshot sub-salt input), or -1 if unknown. */
export function moonshotIndex(id: string): number {
  return MOONSHOTS.findIndex((m) => m.id === id);
}

/** The derived-hash roll for a specific moonshot in a specific week. Salt 307 with the moonshot's
 *  catalog index folded in as a sub-salt (3070 + index), mirroring staff life events' sub-salts, so the
 *  roll is deterministic per (seed, week, moonshot) but two moonshots the same week roll independently. */
export function moonshotRoll(seed: number, week: number, id: string): number {
  return hash01(seed, week, 3070 + Math.max(0, moonshotIndex(id)));
}

/** Resolve an attempt: success iff the derived roll is under the moonshot's stated chance. Pure +
 *  deterministic — the same (seed, week, moonshot) always resolves the same way, so it replays exactly. */
export function resolveMoonshot(seed: number, week: number, id: string): boolean {
  const m = moonshotById(id);
  if (!m) return false;
  return moonshotRoll(seed, week, id) < m.successChance;
}

/** The pity RP refunded on a failed attempt (floored). The rest of the cost is spent. */
export function moonshotRefund(rpCost: number): number {
  return Math.floor(rpCost * MOONSHOT_PITY_REFUND);
}

/** Weeks left on a moonshot's retry cooldown given the last (failed) attempt week, or 0 if ready. */
export function moonshotCooldownLeft(week: number, lastAttemptWeek: number | undefined): number {
  if (lastAttemptWeek == null) return 0;
  return Math.max(0, MOONSHOT_COOLDOWN_WEEKS - (week - lastAttemptWeek));
}

/** The aggregate persistent bonus from every WON moonshot. Empty won → the all-zero bonus, so old
 *  saves + the do-nothing pin (which never win one) fold to no change. `windfall` rewards are one-time
 *  and deliberately excluded here — they're applied at the moment of success, not aggregated. */
export interface MoonshotBonus {
  designCeiling: number;
  hype: number;
  rpMult: number;
  buildCostMult: number;
  epBudget: number;
  /** The summed signature per-product stat flourish (empty until a signature moonshot is won). */
  stat: Partial<Stats>;
}

const ZERO_MOONSHOT_BONUS: MoonshotBonus = {
  designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0, epBudget: 0, stat: {},
};

export function moonshotBonuses(won: readonly string[] | undefined): MoonshotBonus {
  if (!won || won.length === 0) return ZERO_MOONSHOT_BONUS;
  const out: MoonshotBonus = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0, epBudget: 0, stat: {} };
  for (const id of won) {
    const m = moonshotById(id);
    if (!m) continue;
    const r = m.reward;
    out.designCeiling += r.designCeiling ?? 0;
    out.rpMult += r.rpMult ?? 0;
    out.buildCostMult += r.buildCostMult ?? 0;
    out.epBudget += r.epBudget ?? 0;
    if (r.stat) for (const k of Object.keys(r.stat) as (keyof Stats)[]) out.stat[k] = (out.stat[k] ?? 0) + (r.stat[k] ?? 0);
  }
  return out;
}
