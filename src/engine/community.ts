// Living fan community — promote `fans` from a lone decaying number into a community with a MOOD.
// Sentiment (−1..+1) evolves from how you treat your audience (hits/solids delight it, flops sour it,
// neglect cools it), modulates fan retention (a beloved community churns slower), and spawns SUPERFANS:
// the loyal core that pre-orders hardest. PURE + deterministic.
//
// Sim-safe by construction: every effect is neutral at sentiment 0, and the caller only evolves it once
// the player has SHIPPED — the pinned auto-player never launches, so sentiment stays 0 and fan decay /
// pre-orders are byte-identical. The community-moment flavour uses a DERIVED hash, never the sim RNG.
import { BALANCE } from "./balance.ts";

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
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
