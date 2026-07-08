// Living fan community — promote `fans` from a lone decaying number into a community with a MOOD.
// Sentiment (−1..+1) evolves from how you treat your audience (hits/solids delight it, flops sour it,
// neglect cools it), modulates fan retention (a beloved community churns slower), and spawns SUPERFANS:
// the loyal core that pre-orders hardest. PURE + deterministic.
//
// Sim-safe by construction: every effect is neutral at sentiment 0, and the caller only evolves it once
// the player has SHIPPED — the pinned auto-player never launches, so sentiment stays 0 and fan decay /
// pre-orders are byte-identical. The community-moment flavour uses a DERIVED hash, never the sim RNG.
import { BALANCE } from "./balance.ts";
import { cents, type Money } from "./money.ts";

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Tiny deterministic hash → [0,1), same recipe as eureka / license offers — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface CommunityFacts {
  hits: number;             // recent hits (in the window)
  solids: number;           // recent solids
  flops: number;            // recent flops
  weeksSinceLaunch: number; // weeks since the most recent launch (large when never/neglected)
  fans: number;
}

/** The mood the community is drifting toward this week, from recent verdicts + launch freshness. */
export function sentimentTarget(f: CommunityFacts): number {
  const c = BALANCE.fans.community;
  let t = f.hits * c.hitTarget + f.solids * c.hitTarget * 0.5 - f.flops * c.flopTarget;
  if (f.weeksSinceLaunch <= c.freshWeeks) t += c.freshBonus;
  else if (f.weeksSinceLaunch >= c.staleWeeks) t -= c.stalePenalty;
  return clamp(t, -1, 1);
}

/** Advance sentiment one week toward its target (EMA). At target 0 it decays toward neutral. */
export function evolveSentiment(prev: number, facts: CommunityFacts): number {
  const c = BALANCE.fans.community;
  const target = sentimentTarget(facts);
  return clamp((prev ?? 0) * c.inertia + target * (1 - c.inertia), -1, 1);
}

/** The loyal core sentiment creates — only positive sentiment makes superfans; capped fraction. */
export function superfansFrom(sentiment: number, fans: number): number {
  const c = BALANCE.fans.community;
  return Math.max(0, Math.round(Math.max(0, fans) * Math.max(0, clamp(sentiment, -1, 1)) * c.superfanShareAtMax));
}

/** Adjust the weekly fan-retention factor by sentiment: a happy community loses fewer, an unhappy one
 *  loses more. Returns `baseDecay` EXACTLY at sentiment 0 (so a neutral/never-shipped game is untouched). */
export function sentimentDecayFactor(baseDecay: number, sentiment: number): number {
  const swing = BALANCE.fans.community.retentionSwing;
  const loss = (1 - baseDecay) * (1 - clamp(sentiment, -1, 1) * swing);
  return 1 - Math.max(0, loss); // clamp loss ≥ 0 so a euphoric community can't turn decay into growth
}

export type MoodTier = "restless" | "cool" | "warm" | "devoted";

/** Bucket sentiment into a UI mood. */
export function moodTier(sentiment: number): MoodTier {
  if (sentiment > 0.5) return "devoted";
  if (sentiment > 0.12) return "warm";
  if (sentiment >= -0.15) return "cool";
  return "restless";
}
export const MOOD_LABEL: Record<MoodTier, string> = {
  restless: "Restless", cool: "Neutral", warm: "Warm", devoted: "Devoted",
};

// Authored community-moment lines per mood — the "alive" flavour on the HQ panel. IP-safe, fictional.
const MOMENTS: Record<MoodTier, readonly string[]> = {
  devoted: [
    "Fans are lining up for whatever you ship next.",
    "The community is making fan art of your last launch.",
    "Superfans are defending you in every comment section.",
  ],
  warm: [
    "The community is buzzing about your recent work.",
    "New members keep joining the fan forums.",
    "Word of mouth is doing your marketing for you.",
  ],
  cool: [
    "The community is quietly waiting to see your next move.",
    "Chatter has cooled — they want a reason to care again.",
    "Fans are curious, but not yet convinced.",
  ],
  restless: [
    "The community feels neglected — patience is wearing thin.",
    "Long-time fans are grumbling about the last release.",
    "The forums are restless. Win them back with a real hit.",
  ],
};

/** A deterministic community-moment line for the HQ panel — derived hash (seed, week bucket), never the
 *  sim RNG. Rotates slowly (every few weeks) so the panel feels alive without flickering. */
export function communityMoment(seed: number, week: number, sentiment: number): string {
  const tier = moodTier(sentiment);
  const pool = MOMENTS[tier];
  const bucket = Math.floor(week / 3);
  let h = ((seed >>> 0) ^ Math.imul(bucket + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return pool[(h >>> 0) % pool.length];
}

// ── Community ASKS — turn the passive mood meter into a system with agency. Periodically the fans ask
// for something (an AMA, a public beta, a merch drop, a meetup). ANSWER it for cash to grow + delight
// the base, or PASS and let them down a little. Player-claimed via an opt-in reducer + gated on having
// launched, so the pinned solo sim never raises one → byte-identical.

export type CommunityAskKind = "ama" | "beta" | "merch" | "meetup";

export interface CommunityAsk {
  week: number;
  kind: CommunityAskKind;
  cost: Money;           // cash to answer the call
  fanGain: number;       // one-time fans gained if answered
  sentimentGain: number; // mood lift if answered (then decays via the normal EMA)
  passSentiment: number; // small mood dip if you pass
}

/** Authored flavour per ask kind — an icon key (engine stays DOM-free, ships a string the screen maps
 *  to a Lucide glyph), the fans' request, and the answer verb. IP-safe, fictional. */
export const ASK_INFO: Record<CommunityAskKind, { icon: string; title: string; blurb: string; answer: string; done: string }> = {
  ama: {
    icon: "MessagesSquare",
    title: "Fans want an AMA",
    blurb: "The forums are flooded with questions. Go live and answer them — nothing builds goodwill like showing up in person.",
    answer: "Host the AMA",
    done: "You went live and answered the community's questions.",
  },
  beta: {
    icon: "FlaskConical",
    title: "Fans want early access",
    blurb: "Your most eager fans are dying to test the next thing first. Open a public beta and let them in on it.",
    answer: "Open the beta",
    done: "You opened a public beta to your most eager fans.",
  },
  merch: {
    icon: "Shirt",
    title: "Fans want merch",
    blurb: "People keep asking where to buy the hoodie. Drop an official merch line and give the community something to wear.",
    answer: "Drop the merch",
    done: "You dropped an official merch line — the community is repping you.",
  },
  meetup: {
    icon: "Users",
    title: "Fans want to meet up",
    blurb: "Local fan groups want to gather. Sponsor a round of community meetups and turn online fans into a real scene.",
    answer: "Fund the meetups",
    done: "You funded a round of community meetups.",
  },
};

const ASK_KINDS: readonly CommunityAskKind[] = ["ama", "beta", "merch", "meetup"];

/** Should the community raise an ask this week? ~one per cadence window (derived hash, never the sim
 *  RNG). Callers gate on having launched + cooldown + a fresh-launch window before consulting this. */
export function communityAskDue(seed: number, week: number): boolean {
  return hash01(seed, week, 131) < 1 / BALANCE.fans.community.asks.cadenceWeeks;
}

/** Build the ask: pick a kind (derived hash) + scale the cost / fan-gain by the current base. Pure. */
export function generateCommunityAsk(seed: number, week: number, fans: number): CommunityAsk {
  const a = BALANCE.fans.community.asks;
  const kind = ASK_KINDS[Math.floor(hash01(seed, week, 137) * ASK_KINDS.length) % ASK_KINDS.length];
  const rawCost = a.costBase + Math.round(Math.max(0, fans) * a.costPerFanCents);
  return {
    week,
    kind,
    cost: cents(Math.min(a.costMax, rawCost)),
    fanGain: Math.max(a.fanGainMin, Math.round(Math.max(0, fans) * a.fanGainShare)),
    sentimentGain: a.sentimentGain,
    passSentiment: a.passSentiment,
  };
}
