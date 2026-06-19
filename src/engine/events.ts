// Market events — periodic happenings that nudge the simulation and create timing decisions.
// PURE catalog + selection; the state layer interprets each effect.
import type { Rng } from "./rng.ts";
import { STAT_KEYS, type StatKey } from "./types.ts";

// ---------- Player-choice events ----------
export interface ChoiceOption {
  id: string;
  label: string;
  description: string;
  effect: EventEffect;
}

export interface ChoiceEvent {
  id: string;
  title: string;
  body: string;
  minEra: number;
  tone: "positive" | "negative" | "neutral" | "accent";
  options: readonly [ChoiceOption, ChoiceOption];
}

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

export const CHOICE_EVENTS: ChoiceEvent[] = [
  {
    id: "ip_licensing",
    title: "IP Licensing Offer",
    body: "A larger company wants to license your IP portfolio for a flat fee. Quick cash — or hold out for the long game?",
    minEra: 1,
    tone: "accent",
    options: [
      { id: "accept", label: "Accept the deal", description: "Cash injection now — but you hand over leverage on your IP.", effect: { kind: "cashWindfall", cash: 60_000 } },
      { id: "decline", label: "Keep it in-house", description: "Stay independent and build your own platform value.", effect: { kind: "repBoost", rep: 5 } },
    ],
  },
  {
    id: "pr_crisis",
    title: "Viral Criticism",
    body: "A popular tech influencer published a harsh critique of your product quality. Respond publicly, or let it blow over?",
    minEra: 1,
    tone: "negative",
    options: [
      { id: "respond", label: "Respond publicly", description: "A measured, public response costs effort but earns lasting trust.", effect: { kind: "repBoost", rep: 7 } },
      { id: "ignore", label: "Stay silent", description: "Say nothing and ride it out. The internet forgets quickly — usually.", effect: { kind: "fansBonus", fans: -900 } },
    ],
  },
  {
    id: "rnd_partnership",
    title: "University Research Partnership",
    body: "A university lab wants to co-develop technology with you — they share findings in exchange for early access to results.",
    minEra: 2,
    tone: "accent",
    options: [
      { id: "partner", label: "Partner up", description: "A significant research boost — the collaboration pays dividends fast.", effect: { kind: "rpBonus", amount: 60 } },
      { id: "selffund", label: "Go it alone", description: "Keep research fully internal. Slower, but entirely your IP.", effect: { kind: "pressFeature", reputation: 4 } },
    ],
  },
  {
    id: "platform_deal",
    title: "Exclusive Distribution Deal",
    body: "A major distributor offers a lucrative exclusive partnership — your products sold only through their channel for a year.",
    minEra: 3,
    tone: "accent",
    options: [
      { id: "exclusive", label: "Take the deal", description: "Huge upfront payment — but fans may not love the exclusivity.", effect: { kind: "cashWindfall", cash: 220_000 } },
      { id: "open", label: "Stay open", description: "Keep selling everywhere. Your community respects the independence.", effect: { kind: "fansBonus", fans: 3_000 } },
    ],
  },
  // --- Era 1: early founder dilemmas ---
  {
    id: "open_source",
    title: "Open-Source Gambit",
    body: "Your team wants to open-source the in-house toolkit they built. It would rally developers — but hand your edge to rivals too.",
    minEra: 1,
    tone: "accent",
    options: [
      { id: "release", label: "Open-source it", description: "Developers rally to your platform — a wave of grassroots goodwill.", effect: { kind: "fansBonus", fans: 1_600 } },
      { id: "keep", label: "Keep it proprietary", description: "Hold your technical edge close. Reviewers respect the polish.", effect: { kind: "pressFeature", reputation: 4 } },
    ],
  },
  {
    id: "angel_offer",
    title: "An Angel Comes Knocking",
    body: "A respected angel investor offers an early cheque. Easy runway — but you'd be giving up a slice of the company you fought for.",
    minEra: 1,
    tone: "accent",
    options: [
      { id: "take", label: "Take the investment", description: "A cash injection now — runway to build boldly.", effect: { kind: "cashWindfall", cash: 45_000 } },
      { id: "bootstrap", label: "Stay bootstrapped", description: "Keep full ownership. The market respects the conviction.", effect: { kind: "repBoost", rep: 6 } },
    ],
  },
  {
    id: "crunch_call",
    title: "The Deadline Call",
    body: "You can hit the launch window if the team crunches — or slip the date and keep them fresh. Your call.",
    minEra: 1,
    tone: "neutral",
    options: [
      { id: "ship", label: "Ship on time", description: "Hit the date and ride the launch hype — the team digs deep.", effect: { kind: "fansBonus", fans: 1_200 } },
      { id: "protect", label: "Give the team room", description: "Slip the date to protect morale. A rested team is a sharp team.", effect: { kind: "talentWave", mood: 12 } },
    ],
  },
  // --- Era 2: scaling dilemmas ---
  {
    id: "defect_found",
    title: "A Quiet Defect",
    body: "QA found a rare defect after units already shipped. Recall and own it publicly, or bet the failure rate stays low?",
    minEra: 2,
    tone: "negative",
    options: [
      { id: "recall", label: "Issue a recall", description: "Own it publicly and make it right. Costly now, trusted later.", effect: { kind: "repBoost", rep: 7 } },
      { id: "ship", label: "Ship and monitor", description: "Bet the failure rate is low. If word gets out, fans walk.", effect: { kind: "fansBonus", fans: -1_400 } },
    ],
  },
  {
    id: "star_engineer",
    title: "Poaching a Star Engineer",
    body: "A brilliant engineer is on the market — and so is the chance to instead promote the people who got you here.",
    minEra: 2,
    tone: "accent",
    options: [
      { id: "hire", label: "Win them over", description: "A brilliant hire supercharges the lab — research leaps ahead.", effect: { kind: "rpBonus", amount: 45 } },
      { id: "promote", label: "Promote from within", description: "Back your own people instead. The whole team feels seen.", effect: { kind: "talentWave", mood: 14 } },
    ],
  },
  {
    id: "patent_demand",
    title: "A Patent Demand",
    body: "A patent holder demands a settlement. Pay quietly and move on, or fight it out in public?",
    minEra: 2,
    tone: "negative",
    options: [
      { id: "settle", label: "Settle quietly", description: "Pay to make it disappear. Painful, but the team stays focused.", effect: { kind: "supplyCrunch", cash: 18_000 } },
      { id: "fight", label: "Fight it in public", description: "Stand your ground — a risky, drawn-out battle, but win the crowd.", effect: { kind: "fansBonus", fans: 1_500 } },
    ],
  },
  // --- Era 3: empire dilemmas ---
  {
    id: "flagship_store",
    title: "A Flagship Store",
    body: "Your team pitches a landmark flagship store. An unforgettable brand statement — or capital better kept in the bank?",
    minEra: 3,
    tone: "accent",
    options: [
      { id: "build", label: "Open the flagship", description: "A landmark retail experience — fans flock to it.", effect: { kind: "fansBonus", fans: 4_000 } },
      { id: "online", label: "Stay online-only", description: "Pocket the capital and double down on direct sales.", effect: { kind: "cashWindfall", cash: 120_000 } },
    ],
  },
  {
    id: "acquire_rival",
    title: "Acquire a Struggling Rival",
    body: "A fading competitor is up for sale. Absorb their talent and shelve their roadmap — or stay lean and bank the war chest?",
    minEra: 3,
    tone: "accent",
    options: [
      { id: "buy", label: "Acquire them", description: "Absorb a rival's talent and shelve their roadmap — the field tilts your way.", effect: { kind: "rivalScandal", factor: 0.6 } },
      { id: "pass", label: "Let them fade", description: "Stay lean and bank the war chest for your own moonshots.", effect: { kind: "cashWindfall", cash: 90_000 } },
    ],
  },
  {
    id: "antitrust",
    title: "Regulators Come Calling",
    body: "Antitrust regulators open an inquiry. Cooperate fully and emerge trusted, or lawyer up and fight every inch?",
    minEra: 3,
    tone: "negative",
    options: [
      { id: "cooperate", label: "Open the books", description: "Full cooperation. Slow and costly, but you emerge trusted.", effect: { kind: "repBoost", rep: 8 } },
      { id: "lawyer", label: "Lawyer up", description: "Fight every inch. The base loves the defiance; regulators don't forget.", effect: { kind: "fansBonus", fans: 3_000 } },
    ],
  },
  // --- More era-1 founder dilemmas (replay variety) ---
  {
    id: "public_beta",
    title: "Ship the Beta?",
    body: "Your team wants to put a rough public beta in players' hands now. Rally a community early — or wait and reveal something polished?",
    minEra: 1,
    tone: "accent",
    options: [
      { id: "beta", label: "Open the beta", description: "Let the community in early. They feel ownership — and they show up.", effect: { kind: "fansBonus", fans: 1_400 } },
      { id: "polish", label: "Wait for polish", description: "Reveal nothing until it shines. Reviewers reward the restraint.", effect: { kind: "pressFeature", reputation: 5 } },
    ],
  },
  {
    id: "founder_burnout",
    title: "Running on Fumes",
    body: "You haven't stopped in months and it shows. Take a real week off and reset — or push through to keep the momentum?",
    minEra: 1,
    tone: "neutral",
    options: [
      { id: "rest", label: "Step back a week", description: "Rest and reset. The whole team breathes easier with you.", effect: { kind: "talentWave", mood: 14 } },
      { id: "push", label: "Push through", description: "Keep the foot down. The grind ships product — and fans notice the output.", effect: { kind: "fansBonus", fans: 900 } },
    ],
  },
  {
    id: "viral_meme",
    title: "An Unexpected Meme",
    body: "A joke about your scrappy startup is going viral. Lean in and play along, or steer the conversation back to the product?",
    minEra: 1,
    tone: "positive",
    options: [
      { id: "lean", label: "Play along", description: "Embrace the joke. The internet adores a brand that doesn't take itself too seriously.", effect: { kind: "fansBonus", fans: 1_300 } },
      { id: "redirect", label: "Refocus on the work", description: "Gently steer back to substance. Serious buyers respect it.", effect: { kind: "repBoost", rep: 4 } },
    ],
  },
  // --- More era-2 scaling dilemmas ---
  {
    id: "sustainability_pledge",
    title: "A Green Pledge",
    body: "Activists are pushing you to commit to recycled materials and carbon-neutral shipping. Make the pledge — or keep costs lean for now?",
    minEra: 2,
    tone: "accent",
    options: [
      { id: "pledge", label: "Make the pledge", description: "Commit publicly to sustainability. It costs margin, but goodwill compounds.", effect: { kind: "repBoost", rep: 6 } },
      { id: "later", label: "Not yet", description: "Hold the line on cost this cycle and bank the savings.", effect: { kind: "cashWindfall", cash: 30_000 } },
    ],
  },
  {
    id: "retailer_ultimatum",
    title: "The Retailer's Ultimatum",
    body: "Your biggest retail partner demands a steeper margin cut for prime shelf space. Take the volume — or hold your price and walk?",
    minEra: 2,
    tone: "neutral",
    options: [
      { id: "accept", label: "Take the deal", description: "Swallow the margin for reach. More units, more hands holding your product.", effect: { kind: "fansBonus", fans: 1_800 } },
      { id: "hold", label: "Hold your price", description: "Refuse to be squeezed. The market reads it as confidence.", effect: { kind: "repBoost", rep: 5 } },
    ],
  },
  {
    id: "counterfeit_surge",
    title: "Counterfeits in the Wild",
    body: "Knock-offs of your hardware are flooding grey markets. Fund an aggressive legal crackdown, or focus your energy on out-innovating them?",
    minEra: 2,
    tone: "negative",
    options: [
      { id: "crackdown", label: "Crack down", description: "Lawyers and takedowns. Expensive, but it protects the brand you built.", effect: { kind: "supplyCrunch", cash: 20_000 } },
      { id: "outbuild", label: "Out-build them", description: "Ignore the fakes and race ahead. Your labs find a new gear.", effect: { kind: "rpBonus", amount: 40 } },
    ],
  },
  // --- More era-3 empire dilemmas ---
  {
    id: "data_privacy",
    title: "A Privacy Reckoning",
    body: "You could quietly monetize the usage data your devices collect. Lucrative — but a leak would be catastrophic. Or you could pledge privacy and never touch it.",
    minEra: 3,
    tone: "negative",
    options: [
      { id: "pledge", label: "Pledge privacy", description: "Promise never to sell user data. A principled stand the public remembers.", effect: { kind: "repBoost", rep: 8 } },
      { id: "monetize", label: "Monetize the data", description: "Turn telemetry into a revenue stream. The board cheers; the optics are a gamble.", effect: { kind: "cashWindfall", cash: 160_000 } },
    ],
  },
  {
    id: "moonshot_lab",
    title: "Fund the Moonshot",
    body: "A skunkworks team pitches a wild, decade-out research bet. Fund it from the war chest, or return that capital to a steadier roadmap?",
    minEra: 3,
    tone: "accent",
    options: [
      { id: "fund", label: "Fund the moonshot", description: "Bet big on the far future. The lab surges with ambition.", effect: { kind: "rpBonus", amount: 70 } },
      { id: "steady", label: "Stay the course", description: "Keep the powder dry and the roadmap grounded.", effect: { kind: "cashWindfall", cash: 110_000 } },
    ],
  },
  {
    id: "talent_exodus",
    title: "A Rival's Raid",
    body: "A deep-pocketed rival is trying to poach your senior team en masse. Counter with a costly retention package, or let the restless ones go and rebuild?",
    minEra: 3,
    tone: "negative",
    options: [
      { id: "retain", label: "Fund retention", description: "Match the offers and then some. Painful now, but you keep the brain trust.", effect: { kind: "supplyCrunch", cash: 70_000 } },
      { id: "letgo", label: "Let them walk", description: "Wish them well and promote the hungry. Morale dips before it recovers.", effect: { kind: "burnout", mood: -12 } },
    ],
  },
];

/** Pick a choice event if one is available and hasn't been resolved yet. ~30% chance per event window. */
export function pickChoiceEvent(rng: Rng, era: number, resolvedIds: readonly string[]): ChoiceEvent | null {
  const pool = CHOICE_EVENTS.filter((e) => e.minEra <= era && !resolvedIds.includes(e.id));
  if (pool.length === 0 || rng.next() > 0.30) return null;
  return pool[rng.int(pool.length)];
}

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
