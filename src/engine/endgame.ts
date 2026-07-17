// Legacy Era (item 4.1) — the post-IPO endgame. Once a company has "gone public" (reached the
// pinnacle), instead of only offering the New Game+ reset, the board keeps setting the bar: recurring
// MANDATES (quarterly directives with a cash/reputation payoff) and moonshot MEGAPROJECTS (huge
// cash+RP sinks that pay off in permanent prestige). Gives the richest phase of the game real things
// to chase. PURE + sim-safe: everything is gated behind wentPublic (the pinned solo sim never IPOs),
// and mandates use a DERIVED hash of (seed, quarter) — never the main sim RNG (salt 263).
import { BALANCE } from "./balance.ts";
import { dollars, scale, toDollars, type Money } from "./money.ts";

// ---- Megaprojects: moonshot investments with prestige-tier payoffs -------------------------------

export interface MegaprojectReward {
  /** Permanent reputation added on completion. */
  reputation?: number;
  /** Permanent fan multiplier (1.1 = +10% of current fans, kept). */
  fansMult?: number;
  /** Legacy Points banked toward the prestige meta (item 4.3 will spend them; here we just accrue). */
  legacyPoints?: number;
  blurb: string;
}

export interface Megaproject {
  id: string;
  name: string;
  blurb: string;
  cashCost: Money;
  rpCost: number;
  reward: MegaprojectReward;
}

// A small, ordered slate of moonshots — each a bigger bet than the last. Costs scale hard so the
// Legacy Era is a genuine long-horizon sink, not a shopping trip. IP-clean fictional names.
export const MEGAPROJECTS: readonly Megaproject[] = [
  {
    id: "quantumFab",
    name: "Quantum Fab",
    blurb: "A next-generation fabrication plant that redefines what a device can be.",
    cashCost: dollars(250_000_000) as Money,
    rpCost: 800,
    reward: { reputation: 3, legacyPoints: 2, blurb: "+3 reputation · +2 Legacy Points" },
  },
  {
    id: "neuralOs",
    name: "Neural OS Initiative",
    blurb: "A self-improving operating system that learns each user — the industry follows.",
    cashCost: dollars(600_000_000) as Money,
    rpCost: 1400,
    reward: { reputation: 4, fansMult: 1.15, legacyPoints: 3, blurb: "+4 reputation · +15% fans · +3 Legacy Points" },
  },
  {
    id: "orbitalGrid",
    name: "Orbital Compute Grid",
    blurb: "Datacenters in orbit — limitless compute, and a story no rival can match.",
    cashCost: dollars(1_500_000_000) as Money,
    rpCost: 2200,
    reward: { reputation: 5, fansMult: 1.2, legacyPoints: 5, blurb: "+5 reputation · +20% fans · +5 Legacy Points" },
  },
  {
    id: "fusionCampus",
    name: "Fusion Research Campus",
    blurb: "Power the whole company — and the region — on a private fusion reactor.",
    cashCost: dollars(4_000_000_000) as Money,
    rpCost: 3200,
    reward: { reputation: 6, fansMult: 1.25, legacyPoints: 8, blurb: "+6 reputation · +25% fans · +8 Legacy Points" },
  },
];

// Repeatable "Moonshot Program" tier — once the four authored megaprojects are funded, the Legacy Era
// keeps offering a procedurally-scaling moonshot (rising cost, rising Legacy-Point reward) so the sink
// never fully empties and the endgame always has a next big-ticket goal. IP-clean, deterministic.
const MEGAPROJECT_REPEAT = { growthPerTier: 1.6, cashMult: 1.4, rpMult: 1.35, legacyPointsBase: 6 } as const;

// Authored moonshot names/blurbs (feature #10) so a repeatable Moonshot stops reading "Program 7,
// Program 8". Cycled deterministically by tier; a second lap appends a roman numeral (Project Helios II).
// IP-clean, fictional frontiers. Purely cosmetic — the id/cost/reward are unchanged, so it's sim-safe.
const MOONSHOT_NAMES: readonly { name: string; blurb: string }[] = [
  { name: "Project Helios", blurb: "A grid-scale fusion prototype — power an entire industry." },
  { name: "Project Odyssey", blurb: "An orbital research station for zero-gravity fabrication." },
  { name: "Project Prometheus", blurb: "Chase a room-temperature superconductor, at last." },
  { name: "Project Lumen", blurb: "A photonic computing substrate that leaves silicon behind." },
  { name: "Project Gaia", blurb: "A planet-scale climate-modelling supercomputer." },
  { name: "Project Atlas", blurb: "A continent-spanning autonomous logistics mesh." },
  { name: "Project Nova", blurb: "A direct, safe brain-to-device neural interface." },
  { name: "Project Aegis", blurb: "Self-healing materials that outlast every rival." },
  { name: "Project Chronos", blurb: "Atomic-clock timing for a faster, truer internet." },
  { name: "Project Elysium", blurb: "A fully synthetic-biology fabrication platform." },
];

const ROMAN = ["", "", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
/** A small roman numeral for cycle labels beyond the first lap of the moonshot pool. */
function romanCycle(cycle: number): string {
  return ROMAN[cycle + 1] ?? String(cycle + 1);
}

/** The procedurally-scaling repeatable megaproject at `index` (index ≥ MEGAPROJECTS.length). Cost climbs
 *  each tier off the last authored moonshot; the reward is a rising Legacy-Point + reputation payout. */
export function repeatableMegaproject(index: number): Megaproject {
  const tier = index - MEGAPROJECTS.length + 1; // 1, 2, 3, …
  const last = MEGAPROJECTS[MEGAPROJECTS.length - 1];
  const scaleUp = MEGAPROJECT_REPEAT.cashMult * Math.pow(MEGAPROJECT_REPEAT.growthPerTier, tier - 1);
  const rpScaleUp = MEGAPROJECT_REPEAT.rpMult * Math.pow(MEGAPROJECT_REPEAT.growthPerTier, tier - 1);
  const legacyPoints = MEGAPROJECT_REPEAT.legacyPointsBase + tier;
  // Cycle the authored name pool so each repeatable moonshot has a distinct identity; a second lap
  // through the pool appends a roman numeral rather than resetting to the same names.
  const slot = (tier - 1) % MOONSHOT_NAMES.length;
  const cycle = Math.floor((tier - 1) / MOONSHOT_NAMES.length);
  const picked = MOONSHOT_NAMES[slot];
  const name = cycle === 0 ? picked.name : `${picked.name} ${romanCycle(cycle)}`;
  return {
    id: `moonshot-${index}`,
    name,
    blurb: picked.blurb,
    cashCost: scale(last.cashCost, scaleUp),
    rpCost: Math.round(last.rpCost * rpScaleUp),
    reward: { reputation: 3, legacyPoints, blurb: `+3 reputation · +${legacyPoints} Legacy Points` },
  };
}

export function megaprojectById(id: string): Megaproject | undefined {
  const authored = MEGAPROJECTS.find((m) => m.id === id);
  if (authored) return authored;
  const m = /^moonshot-(\d+)$/.exec(id);
  if (m) {
    const index = Number(m[1]);
    return index >= MEGAPROJECTS.length ? repeatableMegaproject(index) : undefined;
  }
  return undefined;
}

/** The megaprojects on offer: the authored slate not yet funded, and — once those are all funded — the
 *  single next repeatable Moonshot Program, so the endgame slate is never empty. */
export function availableMegaprojects(funded: readonly string[]): Megaproject[] {
  const done = new Set(funded);
  const out = MEGAPROJECTS.filter((m) => !done.has(m.id));
  if (out.length === 0) out.push(repeatableMegaproject(funded.length));
  return out;
}

/** Can the company afford this moonshot right now (cash AND research points)? */
export function canFundMegaproject(mp: Megaproject, cash: Money, researchPoints: number): boolean {
  return cash >= mp.cashCost && researchPoints >= mp.rpCost;
}

// ---- Board mandates: recurring quarterly directives with a payoff --------------------------------

export type MandateMetric = "revenue" | "hits" | "fans" | "rank";

export interface BoardMandate {
  id: string;
  quarter: number;
  metric: MandateMetric;
  target: number;   // revenue in DOLLARS · hits count · fans count · rank (≤ target)
  title: string;
  reward: { cash: Money; rep: number };
  issuedWeek: number;
  dueWeek: number;
}

/** The facts a mandate is judged against — a small read of the live company. */
export interface MandateFacts {
  quarterRevenue: number; // DOLLARS earned since the mandate was issued
  quarterHits: number;    // hit launches since issued
  fans: number;
  rank: number;           // industry rank (1 = best)
}

/** Tiny deterministic hash → [0,1), keyed off (seed, quarter, salt 263) — never the sim RNG. */
function hash01(seed: number, quarter: number, salt: number): number {
  let h = (seed ^ Math.imul(quarter + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const MANDATE_METRICS: readonly MandateMetric[] = ["revenue", "hits", "fans", "rank"];

/** Generate the board's directive for a quarter — a metric + target scaled to the era, the company's
 *  own scale, and a matching reward. Deterministic (derived hash), so the same seed+quarter+inputs
 *  always issues the same mandate.
 *
 *  `trailingRevenue` is the DOLLARS the company earned in the just-completed quarter; a revenue mandate
 *  targets the greater of the escalating floor and that trailing quarter grown by `revenueStretch`, so
 *  it stays a genuine stretch for a giant company instead of a capped rubber-stamp. Defaults to 0 —
 *  the very first mandate (no history) and any legacy caller get exactly the old floor-only behavior. */
export function generateBoardMandate(seed: number, quarter: number, week: number, currentFans: number, trailingRevenue = 0): BoardMandate {
  const c = BALANCE.legacyEra.mandate;
  const metric = MANDATE_METRICS[Math.floor(hash01(seed, quarter, 263) * MANDATE_METRICS.length) % MANDATE_METRICS.length];
  // The FLOOR rises each quarter but PLATEAUS at escalationCapQuarters, so an early company always has
  // a reachable base; the scaling below keeps it a stretch for a large one.
  const eq = Math.min(quarter, c.escalationCapQuarters);
  const rung = 1 + eq * c.escalationPerQuarter;
  let target: number;
  let title: string;
  switch (metric) {
    case "revenue": {
      const floor = Math.round(c.baseRevenue * rung / 1e6) * 1e6;
      const stretch = Math.round(Math.max(0, trailingRevenue) * (1 + c.revenueStretch) / 1e6) * 1e6;
      target = Math.max(floor, stretch);
      title = `Post $${Math.round(target / 1e6)}M in revenue this quarter`;
      break;
    }
    case "hits":
      target = Math.min(c.maxHits, 1 + Math.floor(eq / 2));
      title = `Land ${target} hit launch${target > 1 ? "es" : ""} this quarter`;
      break;
    case "fans":
      target = Math.round((currentFans * (1 + c.fansGrowthTarget) + c.fansFloor) / 1000) * 1000;
      title = `Grow the fanbase to ${target.toLocaleString()}`;
      break;
    default: // rank
      target = 1;
      title = "Hold the #1 spot in the industry";
      break;
  }
  // Reward tracks the escalating floor as before, but a scaled-up revenue mandate pays a matching
  // cut of its (larger) target — so chasing a giant bar is worth it, not the same capped pittance.
  const floorReward = scale(dollars(c.baseReward), rung) as Money;
  const cash = metric === "revenue"
    ? (dollars(Math.max(toDollars(floorReward), Math.round(target * c.rewardRevenueFrac))) as Money)
    : floorReward;
  const reward = { cash, rep: c.repReward };
  return { id: `mandate-q${quarter}`, quarter, metric, target, title, reward, issuedWeek: week, dueWeek: week + c.windowWeeks };
}

/** 0..1 progress toward a mandate (rank is met/not-met, so 0 or 1). */
export function mandateProgress(m: BoardMandate, f: MandateFacts): number {
  switch (m.metric) {
    case "revenue": return Math.max(0, Math.min(1, f.quarterRevenue / m.target));
    case "hits": return Math.max(0, Math.min(1, f.quarterHits / m.target));
    case "fans": return Math.max(0, Math.min(1, f.fans / m.target));
    default: return f.rank <= m.target ? 1 : 0;
  }
}

/** Whether the mandate's target is met. */
export function mandateComplete(m: BoardMandate, f: MandateFacts): boolean {
  switch (m.metric) {
    case "revenue": return f.quarterRevenue >= m.target;
    case "hits": return f.quarterHits >= m.target;
    case "fans": return f.fans >= m.target;
    default: return f.rank <= m.target;
  }
}

/** A short human summary of a mandate reward (for the feed / HQ card). */
export function mandateRewardSummary(m: BoardMandate): string {
  return `$${Math.round(toDollars(m.reward.cash) / 1e6)}M + ${m.reward.rep} reputation`;
}

// ---- Board confidence & directive tiers (feature #5) ---------------------------------------------
// A memory on the mandate loop: met mandates raise the board's confidence + your streak, lapses drop
// it. The confidence TIER multiplies mandate payouts; the streak compounds a bonus on top. All pure,
// gated on wentPublic (the pinned solo sim never IPOs), no RNG.

export interface BoardTier {
  index: number;
  name: string;
  minConfidence: number;   // the tier applies for confidence ≥ this
  rewardMult: number;      // multiplier on the mandate payout at this tier
  note: string;            // one-line flavour for the card
}

/** The escalating board-confidence ladder. Neutral start (50) lands in "Steady Board" (×1.0), so an
 *  existing save keeps today's payout until confidence moves. Below is a penalty, above is a bonus. */
export const BOARD_TIERS: readonly BoardTier[] = [
  { index: 0, name: "Doubtful Board", minConfidence: 0, rewardMult: 0.8, note: "The board is uneasy — payouts run lean until you rebuild trust." },
  { index: 1, name: "Watchful Board", minConfidence: 20, rewardMult: 0.9, note: "The board is watching closely. Deliver and they'll loosen up." },
  { index: 2, name: "Steady Board", minConfidence: 45, rewardMult: 1.0, note: "A steady, business-as-usual board. Standard mandate payouts." },
  { index: 3, name: "Confident Board", minConfidence: 65, rewardMult: 1.25, note: "The board believes in you — mandates pay 25% more." },
  { index: 4, name: "Emboldened Board", minConfidence: 85, rewardMult: 1.5, note: "An emboldened board backs bigger swings — 50% richer payouts." },
  { index: 5, name: "Visionary Board", minConfidence: 100, rewardMult: 2.0, note: "A visionary board writes blank checks — mandate payouts doubled." },
] as const;

function clampConfidence(confidence: number): number {
  const n = BALANCE.legacyEra.boardConfidence;
  return Math.max(n.min, Math.min(n.max, confidence));
}

/** The board tier for a confidence value (0..100). */
export function boardTier(confidence: number): BoardTier {
  const c = clampConfidence(confidence);
  let t = BOARD_TIERS[0];
  for (const tier of BOARD_TIERS) if (c >= tier.minConfidence) t = tier;
  return t;
}

/** The next tier up (for the "reach X to unlock" line), or null at the top. */
export function nextBoardTier(confidence: number): BoardTier | null {
  const cur = boardTier(confidence);
  return BOARD_TIERS[cur.index + 1] ?? null;
}

/** The compounding streak bonus for N consecutive met mandates (0 at streak 0, capped). */
export function mandateStreakBonus(streak: number): number {
  const n = BALANCE.legacyEra.boardConfidence;
  return Math.min(n.maxStreakBonus, Math.max(0, streak) * n.streakBonusPerLevel);
}

/** The payout multiplier actually applied to a met mandate: tier × (1 + streak bonus). */
export function mandatePayoutMult(confidence: number, streak: number): number {
  return boardTier(confidence).rewardMult * (1 + mandateStreakBonus(streak));
}

/** The reward actually paid for meeting a mandate at a given confidence + streak. */
export function effectiveMandateReward(
  base: { cash: Money; rep: number },
  confidence: number,
  streak: number,
): { cash: Money; rep: number; mult: number } {
  const mult = mandatePayoutMult(confidence, streak);
  return { cash: scale(base.cash, mult) as Money, rep: Math.round(base.rep * mult), mult };
}
