// Market events — periodic happenings that nudge the simulation and create timing decisions.
// PURE catalog + selection; the state layer interprets each effect.
import type { Rng } from "./rng.ts";
import { STAT_KEYS, type StatKey } from "./types.ts";

export type EventEffect =
  | { kind: "viralTrend"; stat: StatKey }
  | { kind: "rpBonus"; amount: number }
  | { kind: "rivalScandal"; factor: number }
  | { kind: "talentWave"; mood: number }
  | { kind: "supplyCrunch"; cash: number } // dollars cost
  | { kind: "pressFeature"; reputation: number }
  | { kind: "burnout"; mood: number }
  | { kind: "fansBonus"; fans: number }
  | { kind: "repBoost"; rep: number }
  | { kind: "cashWindfall"; cash: number };

export interface MarketEvent {
  id: string;
  title: string;
  minEra: number;
  weight: number;
  effect: EventEffect;
  tone: "positive" | "negative" | "neutral" | "accent";
}

const STAT_LABEL: Record<StatKey, string> = {
  performance: "performance",
  quality: "quality",
  battery: "battery life",
  design: "design",
  ecosystem: "ecosystem",
};

export const MARKET_EVENTS: MarketEvent[] = [
  // Era 1+
  { id: "press", title: "A glowing review put your brand in the spotlight.", minEra: 1, weight: 3, effect: { kind: "pressFeature", reputation: 5 }, tone: "positive" },
  { id: "rpbreak", title: "A research breakthrough accelerated your labs.", minEra: 1, weight: 3, effect: { kind: "rpBonus", amount: 14 }, tone: "accent" },
  { id: "scandal", title: "A rival's product was recalled — the field just opened up.", minEra: 1, weight: 2, effect: { kind: "rivalScandal", factor: 0.5 }, tone: "positive" },
  { id: "talent", title: "A wave of fresh energy lifted the whole team.", minEra: 1, weight: 2, effect: { kind: "talentWave", mood: 14 }, tone: "positive" },
  { id: "supply", title: "A supply crunch raised costs this quarter.", minEra: 1, weight: 2, effect: { kind: "supplyCrunch", cash: 8000 }, tone: "negative" },
  { id: "fans-buzz", title: "Word of mouth is spreading — your fans are recruiting new fans.", minEra: 1, weight: 2, effect: { kind: "fansBonus", fans: 400 }, tone: "positive" },
  { id: "grant", title: "A small business grant boosted your runway.", minEra: 1, weight: 1, effect: { kind: "cashWindfall", cash: 12000 }, tone: "positive" },
  { id: "blog-hit", title: "Your founder's blog post went viral — the startup community took notice.", minEra: 1, weight: 2, effect: { kind: "pressFeature", reputation: 3 }, tone: "positive" },
  { id: "supplier-fail", title: "A key supplier closed — emergency sourcing strained the budget.", minEra: 1, weight: 1, effect: { kind: "supplyCrunch", cash: 6000 }, tone: "negative" },
  { id: "rp-late-night", title: "Late-night lab sessions paid off — research is ahead of schedule.", minEra: 1, weight: 2, effect: { kind: "rpBonus", amount: 10 }, tone: "accent" },
  { id: "early-fans", title: "Early adopters are raving about your products online.", minEra: 1, weight: 2, effect: { kind: "fansBonus", fans: 300 }, tone: "positive" },
  { id: "rival-stumble", title: "A rival's delayed launch left an opening in the market.", minEra: 1, weight: 1, effect: { kind: "rivalScandal", factor: 0.65 }, tone: "positive" },
  // Era 2+
  { id: "burnout", title: "Crunch time took a toll on morale.", minEra: 2, weight: 2, effect: { kind: "burnout", mood: -12 }, tone: "negative" },
  { id: "press-cover", title: "Your company landed on the cover of a major tech publication.", minEra: 2, weight: 2, effect: { kind: "repBoost", rep: 4 }, tone: "positive" },
  { id: "supply-severe", title: "Component shortages hit the whole industry — costly quarter ahead.", minEra: 2, weight: 2, effect: { kind: "supplyCrunch", cash: 22000 }, tone: "negative" },
  { id: "fans-campaign", title: "Fans launched a social campaign around your brand — viral moment.", minEra: 2, weight: 2, effect: { kind: "fansBonus", fans: 1200 }, tone: "positive" },
  { id: "rpbreak-major", title: "A major research breakthrough — your lab is ahead of schedule.", minEra: 2, weight: 2, effect: { kind: "rpBonus", amount: 32 }, tone: "accent" },
  { id: "conference-win", title: "An industry conference spotlighted your brand to a global audience.", minEra: 2, weight: 2, effect: { kind: "repBoost", rep: 3 }, tone: "positive" },
  { id: "api-launch", title: "Third-party developers started building on your platform.", minEra: 2, weight: 2, effect: { kind: "fansBonus", fans: 800 }, tone: "positive" },
  { id: "talent-drain", title: "A rival poached a few industry peers — team morale dipped.", minEra: 2, weight: 1, effect: { kind: "burnout", mood: -8 }, tone: "negative" },
  { id: "supply-rush", title: "Geopolitical tensions caused a costly last-minute component rush.", minEra: 2, weight: 1, effect: { kind: "supplyCrunch", cash: 18000 }, tone: "negative" },
  { id: "journalist-profile", title: "A journalist published a profile of your startup journey — goodwill gained.", minEra: 2, weight: 2, effect: { kind: "repBoost", rep: 5 }, tone: "positive" },
  // Era 3+
  { id: "rivalry-price-war", title: "Rivals slashed prices — the market got temporarily more competitive.", minEra: 3, weight: 2, effect: { kind: "rivalScandal", factor: 0.7 }, tone: "negative" },
  { id: "ecosystem-boom", title: "Third-party developers flooded your platform — ecosystem value surges.", minEra: 3, weight: 2, effect: { kind: "fansBonus", fans: 3000 }, tone: "positive" },
  { id: "acquisition-offer", title: "An acquisition offer boosted investor confidence in the sector.", minEra: 3, weight: 1, effect: { kind: "cashWindfall", cash: 80000 }, tone: "positive" },
  { id: "award-win", title: "Your flagship product won a prestigious industry design award.", minEra: 3, weight: 2, effect: { kind: "repBoost", rep: 6 }, tone: "positive" },
  { id: "fan-milestone", title: "Consumer confidence in your brand reached an all-time high.", minEra: 3, weight: 2, effect: { kind: "fansBonus", fans: 5000 }, tone: "positive" },
  { id: "supply-chain-crisis", title: "A global supply-chain disruption hit your sourcing hard.", minEra: 3, weight: 2, effect: { kind: "supplyCrunch", cash: 45000 }, tone: "negative" },
  { id: "platform-deal", title: "A landmark platform partnership boosted your ecosystem reach.", minEra: 3, weight: 1, effect: { kind: "cashWindfall", cash: 120000 }, tone: "positive" },
  { id: "burnout-severe", title: "The pace caught up with the team — a serious morale dip.", minEra: 3, weight: 1, effect: { kind: "burnout", mood: -18 }, tone: "negative" },
  { id: "rp-lab-expansion", title: "A research lab expansion accelerated every ongoing project.", minEra: 3, weight: 2, effect: { kind: "rpBonus", amount: 55 }, tone: "accent" },
  // Additional era 1+ events for early-game variety
  { id: "indie-review", title: "An independent reviewer gave you top marks — brand trust climbed.", minEra: 1, weight: 2, effect: { kind: "pressFeature", reputation: 4 }, tone: "positive" },
  { id: "component-deal", title: "A supplier relationship paid off — one-time cost savings.", minEra: 1, weight: 1, effect: { kind: "cashWindfall", cash: 9000 }, tone: "positive" },
  { id: "competitor-recall", title: "A competitor's product recall made buyers more cautious — and more curious about you.", minEra: 1, weight: 1, effect: { kind: "fansBonus", fans: 500 }, tone: "positive" },
  { id: "hackathon-win", title: "Your engineers won an industry hackathon — a morale and press win.", minEra: 1, weight: 1, effect: { kind: "talentWave", mood: 10 }, tone: "positive" },
  { id: "cold-snap", title: "Economic headwinds cooled consumer spending this quarter.", minEra: 1, weight: 1, effect: { kind: "supplyCrunch", cash: 5000 }, tone: "negative" },
  // Additional era 2+ events
  { id: "patent-win", title: "A patent victory let your team focus on building, not defending.", minEra: 2, weight: 1, effect: { kind: "repBoost", rep: 3 }, tone: "positive" },
  { id: "ad-campaign", title: "A viral ad campaign drove a wave of new brand interest.", minEra: 2, weight: 1, effect: { kind: "fansBonus", fans: 1500 }, tone: "positive" },
  // Additional era 3+ events
  { id: "vc-interview", title: "VC interest has driven a spike in industry attention around your sector.", minEra: 3, weight: 1, effect: { kind: "repBoost", rep: 5 }, tone: "positive" },
  // viral trends are generated dynamically per stat below
];

export function pickEvent(rng: Rng, era: number): MarketEvent {
  // 35% of the time, a viral demand trend toward a random stat.
  if (rng.next() < 0.35) {
    const stat = STAT_KEYS[rng.int(STAT_KEYS.length)];
    return {
      id: `viral-${stat}`,
      title: `Consumers can't stop talking about ${STAT_LABEL[stat]}.`,
      minEra: 1,
      weight: 1,
      effect: { kind: "viralTrend", stat },
      tone: "accent",
    };
  }
  const pool = MARKET_EVENTS.filter((e) => e.minEra <= era);
  // Defensive: an out-of-range era could yield an empty pool — never return undefined.
  if (pool.length === 0) {
    return { id: "calm", title: "The market is quiet this week.", minEra: 1, weight: 1, effect: { kind: "rpBonus", amount: 0 }, tone: "neutral" };
  }
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let roll = rng.next() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}
