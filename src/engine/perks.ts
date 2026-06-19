// Founder Perks — qualitative New Game+ mastery, "beyond bigger numbers" (RETENTION_ROADMAP Wave 4).
// PURE catalog + aggregator. Perks accrue with the prestige `legacy` level (no new persistence —
// the level is already saved + native-mirrored): prestige N grants the first N perks, in order.
// Effects are bounded and applied through the existing STATE-layer bonus selectors
// (designTierCeiling / hypeBonus / weeklyRpGen) — never the protected engine.
export interface PerkBonus {
  designCeiling: number; // + to the design-tier ceiling
  hype: number;          // + to the launch hype bonus
  rpMult: number;        // + fractional weekly-RP multiplier (0.15 = +15%)
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
] as const;

/** Perks active at a given prestige level (the first `level`, clamped). */
export function activePerks(legacyLevel: number): Perk[] {
  const n = Math.max(0, Math.min(PERKS.length, Math.floor(legacyLevel || 0)));
  return PERKS.slice(0, n);
}

/** Aggregate bonus from all active perks at a prestige level. */
export function perkBonuses(legacyLevel: number): PerkBonus {
  const out: PerkBonus = { designCeiling: 0, hype: 0, rpMult: 0 };
  for (const p of activePerks(legacyLevel)) {
    out.designCeiling += p.bonus.designCeiling ?? 0;
    out.hype += p.bonus.hype ?? 0;
    out.rpMult += p.bonus.rpMult ?? 0;
  }
  return out;
}

/** The perk the NEXT prestige would unlock (for the win-overlay preview), or undefined if maxed. */
export function nextPerk(legacyLevel: number): Perk | undefined {
  return PERKS[Math.max(0, Math.floor(legacyLevel || 0))];
}
