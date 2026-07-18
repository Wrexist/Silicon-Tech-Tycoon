// Era Mandates (feature #6) — a run-long strategic-identity modifier drafted at each era advance. On
// entering a new era the player is offered 3 mandates (or may decline) and the one they adopt shapes
// the WHOLE run: a small upside paired with a small downside, so it's an identity trade-off, not a
// power spike. PURE + deterministic.
//
// Sim-safe by construction: the 3-of-N offer is a DERIVED hash of (seed, week, salt 281) — never the
// sim RNG — and effects are CLAIMED via an opt-in reducer (chooseMandate). A run that holds no mandate
// (fresh empty list, every old save, and the do-nothing reproducibility pin, which never advances era)
// aggregates to the all-zero bonus, so it stays byte-identical. Magnitudes are capped small (≤10% /
// ±1 tier) and every effect routes through an EXISTING bonus seam (the prestige-style design ceiling /
// hype / RP-mult, plus build cost, launch fan gain and addressable demand).

/** Fractional effects are capped at ±0.10; the design-ceiling shift at ±1 tier. Enforced by tests. */
export const MANDATE_FRACTION_CAP = 0.1;
export const MANDATE_CEILING_CAP = 1;

/** Fresh derived-hash salt for the mandate offer stream (registered in CLAUDE.md). Never reused. */
export const MANDATE_SALT = 281;

/** A mandate's effect vocabulary — every field maps to a real consumption seam in the state layer.
 *  All optional; a mandate sets at most TWO (one upside, one downside). Fractions are additive deltas
 *  (0.08 = +8%); `buildCostReduction` is signed (+ = cheaper to build, − = pricier). */
export interface MandateEffect {
  /** ± integer added to the design-tier ceiling (folds into prestigeBonuses.designCeiling). */
  designCeiling?: number;
  /** ± additive launch-hype bonus (folds into prestigeBonuses.hype). */
  hype?: number;
  /** ± fractional weekly-RP multiplier (folds into prestigeBonuses.rpMult). */
  rpMult?: number;
  /** Signed build-cost reduction: + cheaper, − pricier. Applied at the tooling + per-unit seams. */
  buildCostReduction?: number;
  /** ± fractional multiplier on the NEW fans a launch earns (never the standing base or a flop loss). */
  fanGainMult?: number;
  /** ± fractional multiplier on the addressable market (alongside the challenge demand rule). */
  demandMult?: number;
}

export interface Mandate {
  id: string;
  name: string;
  /** One-line identity description (shown in the draft + the Company screen). */
  description: string;
  /** Short upside label for the trade-off chip. */
  upside: string;
  /** Short downside label for the trade-off chip. */
  downside: string;
  /** The era being ENTERED must be ≥ this for the mandate to be offered (later-era identities). */
  minEra: number;
  effect: MandateEffect;
}

/** The authored catalog. Each is a two-sided identity: a small edge bought with a small concession.
 *  Kept deliberately flavour-forward — no mandate is a strict upgrade, and none stacks past the caps. */
export const MANDATES: readonly Mandate[] = [
  {
    id: "cult",
    name: "Cult Following",
    description: "A devoted core shows up for every drop — but the mainstream stays cool.",
    upside: "+10% fan growth",
    downside: "−6% launch hype",
    minEra: 1,
    effect: { fanGainMult: 0.1, hype: -0.06 },
  },
  {
    id: "press",
    name: "Press Darlings",
    description: "The press adores your reveals; the labs get whatever attention is left over.",
    upside: "+9% launch hype",
    downside: "−5% research",
    minEra: 1,
    effect: { hype: 0.09, rpMult: -0.05 },
  },
  {
    id: "lean",
    name: "Lean Machine",
    description: "Ruthless efficiency on the line, at the cost of showroom shine.",
    upside: "−8% build cost",
    downside: "−5% launch hype",
    minEra: 1,
    effect: { buildCostReduction: 0.08, hype: -0.05 },
  },
  {
    id: "skunkworks",
    name: "Skunkworks",
    description: "Pour everything into the lab; manufacturing pays the premium.",
    upside: "+9% research",
    downside: "+6% build cost",
    minEra: 1,
    effect: { rpMult: 0.09, buildCostReduction: -0.06 },
  },
  {
    id: "massmarket",
    name: "Mass Market",
    description: "Sell to everyone — reach the whole world, win no one's heart.",
    upside: "+8% market demand",
    downside: "−7% fan growth",
    minEra: 1,
    effect: { demandMult: 0.08, fanGainMult: -0.07 },
  },
  {
    id: "prestige",
    name: "Prestige Brand",
    description: "An aura of luxury that commands attention — and costs to maintain.",
    upside: "+8% launch hype",
    downside: "+6% build cost",
    minEra: 1,
    effect: { hype: 0.08, buildCostReduction: -0.06 },
  },
  {
    id: "grassroots",
    name: "Grassroots",
    description: "Word of mouth builds a loyal base, one true believer at a time.",
    upside: "+9% fan growth",
    downside: "−6% market demand",
    minEra: 1,
    effect: { fanGainMult: 0.09, demandMult: -0.06 },
  },
  {
    id: "boutique",
    name: "Boutique Atelier",
    description: "A tiny studio obsessed with craft over scale.",
    upside: "+1 design ceiling",
    downside: "−6% market demand",
    minEra: 2,
    effect: { designCeiling: 1, demandMult: -0.06 },
  },
  {
    id: "vertical",
    name: "Vertical Integration",
    description: "Own the whole line — cheaper to build, but the labs slow down.",
    upside: "−9% build cost",
    downside: "−6% research",
    minEra: 2,
    effect: { buildCostReduction: 0.09, rpMult: -0.06 },
  },
  {
    id: "designhouse",
    name: "Design House",
    description: "Taste above all; the extra flourishes cost a little more to make.",
    upside: "+1 design ceiling",
    downside: "+5% build cost",
    minEra: 2,
    effect: { designCeiling: 1, buildCostReduction: -0.05 },
  },
  {
    id: "openplatform",
    name: "Open Platform",
    description: "Ubiquity over glamour: your tech is everywhere, never the headline.",
    upside: "+9% market demand",
    downside: "−6% launch hype",
    minEra: 3,
    effect: { demandMult: 0.09, hype: -0.06 },
  },
  {
    id: "moonshot",
    name: "Moonshot Culture",
    description: "Chase the frontier; the crowd can wait for the finished product.",
    upside: "+10% research",
    downside: "−6% fan growth",
    minEra: 3,
    effect: { rpMult: 0.1, fanGainMult: -0.06 },
  },
] as const;

export function mandateById(id: string): Mandate | undefined {
  return MANDATES.find((m) => m.id === id);
}

/** Tiny deterministic hash → [0,1), the canonical eureka/license/side-order recipe — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Mandates eligible for an era draft: unlocked by the era being ENTERED and not already held. */
export function eligibleMandates(eraTo: number, held: readonly string[]): Mandate[] {
  const has = new Set(held);
  return MANDATES.filter((m) => m.minEra <= eraTo && !has.has(m.id));
}

/** The 3 (or fewer) mandate ids offered when advancing INTO `eraTo`. Deterministic from (seed, week,
 *  salt 281): each eligible mandate gets a per-candidate hash key (its catalog index folded into the
 *  week arg so the keys are distinct within one offer yet still a pure function of seed/week/salt), and
 *  the lowest `count` keys win. Excludes already-held + era-ineligible mandates. Pure + reproducible. */
export function offerMandates(
  seed: number,
  week: number,
  eraTo: number,
  held: readonly string[],
  count = 3,
): string[] {
  const pool = eligibleMandates(eraTo, held);
  const keyed = pool.map((m) => ({
    id: m.id,
    key: hash01(seed, week + MANDATES.indexOf(m) * 8009, MANDATE_SALT),
  }));
  // Sort by hash key; ties (astronomically unlikely) break on catalog order for a stable result.
  keyed.sort((a, b) => a.key - b.key || MANDATES.findIndex((m) => m.id === a.id) - MANDATES.findIndex((m) => m.id === b.id));
  return keyed.slice(0, Math.min(count, keyed.length)).map((k) => k.id);
}

/** The aggregated bonus from all held mandates. Empty/absent list → the all-zero bonus, so a run that
 *  holds nothing (old saves, the pinned sim) is a byte-exact no-op. Merged where prestige-style
 *  modifiers are consumed (design ceiling / hype / RP via prestigeBonuses; build cost / fan gain /
 *  demand at their own seams). Unknown ids are skipped so a forged save can't inject an effect. */
export interface MandateBonus {
  designCeiling: number;
  hype: number;
  rpMult: number;
  /** Signed build-cost reduction (+ cheaper). */
  buildCostReduction: number;
  fanGainMult: number;
  demandMult: number;
}

export const ZERO_MANDATE_BONUS: MandateBonus = {
  designCeiling: 0,
  hype: 0,
  rpMult: 0,
  buildCostReduction: 0,
  fanGainMult: 0,
  demandMult: 0,
};

export function aggregateMandates(held: readonly string[] | undefined): MandateBonus {
  if (!held || held.length === 0) return ZERO_MANDATE_BONUS;
  const out: MandateBonus = { ...ZERO_MANDATE_BONUS };
  for (const id of held) {
    const m = mandateById(id);
    if (!m) continue;
    out.designCeiling += m.effect.designCeiling ?? 0;
    out.hype += m.effect.hype ?? 0;
    out.rpMult += m.effect.rpMult ?? 0;
    out.buildCostReduction += m.effect.buildCostReduction ?? 0;
    out.fanGainMult += m.effect.fanGainMult ?? 0;
    out.demandMult += m.effect.demandMult ?? 0;
  }
  return out;
}
