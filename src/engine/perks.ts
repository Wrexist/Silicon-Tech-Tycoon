// Founder Perks — qualitative New Game+ mastery, "beyond bigger numbers" (RETENTION_ROADMAP Wave 4).
// PURE catalog + aggregator. Perks accrue with the prestige `legacy` level (no new persistence —
// the level is already saved + native-mirrored): prestige N grants the first N perks, in order.
// Effects are bounded and applied through the existing STATE-layer bonus selectors
// (designTierCeiling / hypeBonus / weeklyRpGen) — never the protected engine.
export interface PerkBonus {
  designCeiling: number; // + to the design-tier ceiling
  hype: number;          // + to the launch hype bonus
  rpMult: number;        // + fractional weekly-RP multiplier (0.15 = +15%)
  buildCostMult: number; // + fractional build-cost REDUCTION (0.10 = −10% tooling + per-unit cost)
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  bonus: Partial<PerkBonus>;
}

/** The perk ladder — each prestige unlocks the next. Effects are deliberately modest + varied so
 *  successive companies feel qualitatively different, not just richer. */
export const PERKS: readonly Perk[] = [
  { id: "visionary", name: "Design Visionary", description: "Your taste is legendary — design ceiling +1.", bonus: { designCeiling: 1 } },
  { id: "hype-machine", name: "Hype Machine", description: "Launches land louder — +15% launch hype.", bonus: { hype: 0.15 } },
  { id: "research-power", name: "Research Powerhouse", description: "Your labs hum — +15% weekly research.", bonus: { rpMult: 0.15 } },
  { id: "master-designer", name: "Master Designer", description: "Another leap in craft — design ceiling +1.", bonus: { designCeiling: 1 } },
  { id: "marketing-genius", name: "Marketing Genius", description: "The world watches your every reveal — +20% launch hype.", bonus: { hype: 0.20 } },
  { id: "lab-director", name: "Lab Director", description: "World-class R&D — +25% weekly research.", bonus: { rpMult: 0.25 } },
  // --- The deep-prestige tail (7th+ company) — a NEW qualitative axis (cheaper manufacturing) so
  //     a veteran founder plays a different margin game, not just a richer one. ---
  { id: "supply-chain", name: "Supply Chain Master", description: "Lean operations — build costs −10%.", bonus: { buildCostMult: 0.10 } },
  { id: "brand-legend", name: "Brand Legend", description: "A name spoken in every home — +25% launch hype.", bonus: { hype: 0.25 } },
  { id: "innovation-engine", name: "Innovation Engine", description: "Breakthroughs on tap — +30% weekly research.", bonus: { rpMult: 0.30 } },
  { id: "industrialist", name: "Industrialist", description: "You own the whole pipeline — build costs −15%.", bonus: { buildCostMult: 0.15 } },
] as const;

/** Perks active at a given prestige level (the first `level`, clamped). */
export function activePerks(legacyLevel: number): Perk[] {
  const n = Math.max(0, Math.min(PERKS.length, Math.floor(legacyLevel || 0)));
  return PERKS.slice(0, n);
}

/** Aggregate bonus from all active perks at a prestige level. The build-cost reduction is clamped to
 *  a hard ceiling so manufacturing can never become free, no matter how many times you prestige. */
export function perkBonuses(legacyLevel: number): PerkBonus {
  const out: PerkBonus = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 };
  for (const p of activePerks(legacyLevel)) {
    out.designCeiling += p.bonus.designCeiling ?? 0;
    out.hype += p.bonus.hype ?? 0;
    out.rpMult += p.bonus.rpMult ?? 0;
    out.buildCostMult += p.bonus.buildCostMult ?? 0;
  }
  out.buildCostMult = Math.max(0, Math.min(0.4, out.buildCostMult)); // never below 60% of cost
  return out;
}

/** The perk the NEXT prestige would unlock (for the win-overlay preview), or undefined if maxed. */
export function nextPerk(legacyLevel: number): Perk | undefined {
  return PERKS[Math.max(0, Math.floor(legacyLevel || 0))];
}
