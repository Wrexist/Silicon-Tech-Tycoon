// Competitor AI — rival public companies that launch products (producing competitorStrength the
// market reads) AND trade on the stock market with a live share price. PURE.
//
// Names are ORIGINAL but evoke real-world archetypes (IP rule: no real brand names). Pomelo ≈ the
// premium "fruit" maker, Tristar ≈ the broad "three-stars" conglomerate, Googol ≈ the search/
// platform giant, NovaPlus ≈ the flagship-killer, Pandacore ≈ the aggressive value manufacturer.
import { BALANCE } from "./balance.ts";
import { unlockedCategories } from "./eras.ts";
import type { Rng } from "./rng.ts";
import type { CategoryId, CompetitorState } from "./types.ts";

interface RivalDef {
  id: string;
  name: string;
  blurb: string;
  reputation: number;
  share: number; // starting share price in dollars
  vol: number; // volatility multiplier (premium = steady, value = swingy)
  /** Categories this rival launches into far more often + with a strength bonus (their identity). */
  preferredCategories: readonly CategoryId[];
  /** When true, this rival watches the player's recent hits and counter-punches in those categories. */
  isLead: boolean;
}

export const RIVALS: RivalDef[] = [
  { id: "pomelo",    name: "Pomelo",    blurb: "Premium design & a walled-garden ecosystem.", reputation: 72, share: 188, vol: 0.7, preferredCategories: ["phone", "wearable"],               isLead: true  },
  { id: "tristar",   name: "Tristar",   blurb: "A broad electronics giant that ships everything.", reputation: 64, share: 96, vol: 0.9, preferredCategories: ["phone", "tablet", "laptop"],   isLead: false },
  { id: "googol",    name: "Googol",    blurb: "Search, services and a platform play.",        reputation: 67, share: 142, vol: 1.0, preferredCategories: ["tablet", "laptop", "experimental"], isLead: false },
  { id: "novaplus",  name: "NovaPlus",  blurb: "Flagship specs at a fraction of the price.",  reputation: 46, share: 34,  vol: 1.3, preferredCategories: ["phone"],                           isLead: false },
  { id: "pandacore", name: "Pandacore", blurb: "Aggressive value and relentless volume.",     reputation: 41, share: 22,  vol: 1.4, preferredCategories: ["phone", "tablet", "desktop"],       isLead: false },
  { id: "quantyx",   name: "Quantyx",   blurb: "A scrappy challenger betting on the next wave.", reputation: 30, share: 11, vol: 1.6, preferredCategories: ["experimental", "wearable"],      isLead: false },
];

export function rivalDef(id: string): RivalDef | undefined {
  return RIVALS.find((r) => r.id === id);
}

export interface CompetitorLaunch {
  competitor: string;
  category: CategoryId;
  strength: number;
  week: number;
}

export function initCompetitors(rng: Rng): CompetitorState[] {
  return RIVALS.map((r) => ({
    id: r.id,
    name: r.name,
    blurb: r.blurb,
    reputation: r.reputation + rng.range(-4, 4),
    strengthByCategory: {},
    nextLaunchWeek: 2 + rng.int(BALANCE.competitors.launchEveryWeeks),
    sharePrice: Math.round(r.share * 100 * (0.92 + rng.range(0, 0.16))),
    priceHistory: [r.share],
  }));
}

/** Evolve a rival's share price one week: drift + momentum (reputation) + a launch pop + noise. */
function evolveShare(c: CompetitorState, launched: boolean, rng: Rng): { sharePrice: number; priceHistory: number[] } {
  const s = BALANCE.stocks;
  const vol = rivalDef(c.id)?.vol ?? 1;
  const momentum = (c.reputation / 100 - 0.45) * 0.006; // strong brands trend up
  const pop = launched ? s.launchPop * (0.5 + rng.next()) : 0;
  const noise = rng.range(-1, 1) * s.volatility * vol;
  // Clamp the weekly change so a future balance tweak can never drive (1 + change) <= 0
  // and flip a share price negative; -0.95 leaves headroom below the Math.max(50) floor.
  const change = Math.max(-0.95, s.drift + momentum + pop + noise);
  const sharePrice = Math.max(50, Math.round(c.sharePrice * (1 + change)));
  const priceHistory = [...c.priceHistory, sharePrice / 100];
  if (priceHistory.length > s.historyLength) priceHistory.shift();
  return { sharePrice, priceHistory };
}

/** Advance one week: decay strengths, fire due rival launches (with specialization + reactivity),
 *  and move every share price.
 *  @param recentPlayerHitCats - categories where the player scored a hit recently; the lead rival
 *    (Pomelo) reacts by boosting strength in those categories and shortening its next launch interval. */
export function advanceCompetitors(
  comps: readonly CompetitorState[],
  week: number,
  era: number,
  rng: Rng,
  recentPlayerHitCats?: readonly CategoryId[],
): { competitors: CompetitorState[]; launches: CompetitorLaunch[] } {
  const launches: CompetitorLaunch[] = [];
  const decay = BALANCE.competitors.strengthDecayPerWeek;
  const cats = unlockedCategories(era);
  const bal = BALANCE.competitors;

  const competitors = comps.map((c) => {
    const strengthByCategory: CompetitorState["strengthByCategory"] = {};
    for (const [cat, s] of Object.entries(c.strengthByCategory)) {
      const decayed = (s as number) * decay;
      if (decayed > 1) strengthByCategory[cat as CategoryId] = decayed;
    }

    let nextLaunchWeek = c.nextLaunchWeek;
    let launchedNow = false;
    if (week >= c.nextLaunchWeek && cats.length) {
      const def = rivalDef(c.id);

      // Weighted category selection: preferred categories appear preferredCategoryWeight times, others once.
      const weightedCats: CategoryId[] = [];
      for (const cat of cats) {
        const w = def && (def.preferredCategories as readonly string[]).includes(cat) ? bal.preferredCategoryWeight : 1;
        for (let i = 0; i < w; i++) weightedCats.push(cat);
      }
      const cat = weightedCats[rng.int(weightedCats.length)];

      // Strength: base + reputation factor + jitter
      let strength = bal.baseStrength + c.reputation * 0.4 + rng.range(-6, 10);

      // Home-turf bonus: preferred categories are genuinely harder to contest.
      if (def && (def.preferredCategories as readonly string[]).includes(cat)) {
        strength += bal.preferredStrengthBonus;
      }

      // Reactivity: the lead rival counter-punches when the player has been winning here.
      const isReacting = !!(def?.isLead && recentPlayerHitCats?.includes(cat));
      if (isReacting) {
        strength = Math.min(bal.reactMaxStrength, strength + bal.reactStrengthBonus);
      }

      strengthByCategory[cat] = Math.max(strengthByCategory[cat] ?? 0, strength);
      launches.push({ competitor: c.name, category: cat, strength: Math.round(strength), week });
      launchedNow = true;

      // Schedule next launch; cut the interval if reacting to player hits.
      const baseInterval = bal.launchEveryWeeks + rng.int(bal.launchJitter);
      nextLaunchWeek = week + Math.max(1, baseInterval - (isReacting ? bal.reactCadenceCut : 0));
    }

    const { sharePrice, priceHistory } = evolveShare(c, launchedNow, rng);
    return { ...c, strengthByCategory, nextLaunchWeek, sharePrice, priceHistory };
  });

  return { competitors, launches };
}

/** Strongest rival presence in a category right now (0 if none). */
export function competitorStrengthFor(comps: readonly CompetitorState[], category: CategoryId): number {
  let max = 0;
  for (const c of comps) {
    const s = c.strengthByCategory[category];
    if (s && s > max) max = s;
  }
  return max;
}

/** Every rival's current strength in a category (only those actively shipping there). */
export function rivalStrengthsFor(comps: readonly CompetitorState[], category: CategoryId): number[] {
  const out: number[] = [];
  for (const c of comps) {
    // Use the same "rival is present" threshold (>0) as competitorStrengthFor so the
    // planner and the score's competition term agree on which rivals are active.
    const s = c.strengthByCategory[category];
    if (s && s > 0) out.push(s);
  }
  return out;
}
