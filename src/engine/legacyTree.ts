// Legacy Points spend-tree (item 4.3) — the prestige meta layer for the post-IPO endgame. Megaprojects
// (item 4.1) bank Legacy Points; here the player SPENDS them on a tiered tree of permanent boons,
// choosing a route (raw power / marketing / research / margin) so every Legacy Era becomes a distinct
// build instead of a fixed drip. PURE catalog + aggregator, reusing the PerkBonus shape so the boons
// fold through the exact same state-layer selectors as the founder perks (hype / rp / design / cost).
//
// Sim-safe: the tree is gated on wentPublic (the pinned solo sim never IPOs), and an empty selection
// aggregates to all-zero — the neutral PerkBonus — so nothing changes until the player spends a point.
import type { PerkBonus } from "./perks.ts";

export interface LegacyPerk {
  id: string;
  name: string;
  description: string;
  tier: number;         // 1..3 — higher tiers cost more and gate on progress in earlier tiers
  cost: number;         // Legacy Points to buy
  bonus: Partial<PerkBonus>;
}

// Three tiers, four routes each (power/marketing/research/margin). Buying is additive — take as many
// as your Legacy Points afford — and a tier gates on how many perks you've already bought, so the
// tree reads as a real progression. Costs rise per tier; a full Legacy Era (~18 points from the four
// megaprojects) buys a handful, never everything — the choice is the point.
export const LEGACY_TREE: readonly LegacyPerk[] = [
  // Tier 1 — the opening picks (no gate).
  { id: "lt-design1", name: "Visionary Studio", description: "Design ceiling +1.", tier: 1, cost: 3, bonus: { designCeiling: 1 } },
  { id: "lt-hype1", name: "Signal Boost", description: "+15% launch hype.", tier: 1, cost: 3, bonus: { hype: 0.15 } },
  { id: "lt-rp1", name: "Skunkworks", description: "+20% weekly research.", tier: 1, cost: 3, bonus: { rpMult: 0.20 } },
  { id: "lt-cost1", name: "Lean Empire", description: "Build costs −8%.", tier: 1, cost: 3, bonus: { buildCostMult: 0.08 } },
  // Tier 2 — needs ≥1 tier-1 perk.
  { id: "lt-hype2", name: "Cultural Force", description: "+25% launch hype.", tier: 2, cost: 5, bonus: { hype: 0.25 } },
  { id: "lt-rp2", name: "Moonshot Labs", description: "+30% weekly research.", tier: 2, cost: 5, bonus: { rpMult: 0.30 } },
  { id: "lt-cost2", name: "Vertical Empire", description: "Build costs −12%.", tier: 2, cost: 5, bonus: { buildCostMult: 0.12 } },
  { id: "lt-design2", name: "Master Atelier", description: "Design ceiling +1.", tier: 2, cost: 5, bonus: { designCeiling: 1 } },
  // Tier 3 — needs ≥3 perks total (a committed route).
  { id: "lt-hype3", name: "Household Name", description: "+35% launch hype.", tier: 3, cost: 8, bonus: { hype: 0.35 } },
  { id: "lt-rp3", name: "Frontier Institute", description: "+40% weekly research.", tier: 3, cost: 8, bonus: { rpMult: 0.40 } },
  { id: "lt-cost3", name: "Total Integration", description: "Build costs −15%.", tier: 3, cost: 8, bonus: { buildCostMult: 0.15 } },
  { id: "lt-design3", name: "Design Legend", description: "Design ceiling +2.", tier: 3, cost: 8, bonus: { designCeiling: 2 } },
] as const;

export function legacyPerkById(id: string): LegacyPerk | undefined {
  return LEGACY_TREE.find((p) => p.id === id);
}

/** How many perks a tier requires to be already owned before it opens. */
function tierGate(tier: number): number {
  return tier <= 1 ? 0 : tier === 2 ? 1 : 3;
}

/** Whether `id` can be bought now given what's already chosen: not owned, and its tier gate is met. */
export function legacyPerkAvailable(chosen: readonly string[], id: string): boolean {
  const p = legacyPerkById(id);
  if (!p || chosen.includes(id)) return false;
  return chosen.length >= tierGate(p.tier);
}

/** Aggregate bonus from all chosen Legacy perks — the neutral all-zero PerkBonus when none are chosen,
 *  so the tree is a pure no-op until spent. The build-cost reduction is clamped so cost never goes
 *  negative even stacked with the founder perks (those clamp separately; this clamps its own slice). */
export function legacyTreeBonuses(chosen: readonly string[] = []): PerkBonus {
  const out: PerkBonus = { designCeiling: 0, hype: 0, rpMult: 0, buildCostMult: 0 };
  for (const id of chosen) {
    const p = legacyPerkById(id);
    if (!p) continue;
    out.designCeiling += p.bonus.designCeiling ?? 0;
    out.hype += p.bonus.hype ?? 0;
    out.rpMult += p.bonus.rpMult ?? 0;
    out.buildCostMult += p.bonus.buildCostMult ?? 0;
  }
  out.buildCostMult = Math.max(0, Math.min(0.4, out.buildCostMult));
  return out;
}
