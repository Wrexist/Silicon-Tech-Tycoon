// The free ⇄ Pro line. ONE table, PURE, fully unit-tested — so "what does a free player get?" is a
// question with a single answer you can read in twenty seconds, and changing the answer is a
// one-line edit rather than an archaeology expedition across twenty screens.
//
// ── THE SHAPE OF THE FREE TIER ──────────────────────────────────────────────────────────────────
// Free is a REAL GAME, not a demo: the full design → launch → read-the-market → reinvest loop, with
// no ads, no timers, no energy, no premium currency, no loot boxes, and no nags. What free does not
// include is DEPTH — the second half of the campaign, the meta-progression that spans companies, and
// every alternate mode. That split is deliberate:
//
//   • It converts on DESIRE, not frustration. A player only meets the wall after hours of play, at a
//     moment the game is already celebrating ("you've earned the Platform Era") — not while they're
//     still deciding whether they like it.
//   • It survives App Review. Nothing purchasable alters the simulation in the player's favour mid-
//     run; Pro unlocks CONTENT and MODES. There is no pay-to-win, so there is no 3.1.1 exposure and
//     no "the game got harder until I paid" review.
//   • It keeps the brand. The repo's whole wedge is "the premium alternative to ad-spam tycoons"
//     (EXPANSION_ROADMAP.md). Free has to feel generous, and Lifetime has to exist, or the wedge is
//     gone and so is the goodwill.
//
// ── DETERMINISM ─────────────────────────────────────────────────────────────────────────────────
// Nothing in this file — or anything reading it — may reach `engine/`. Every gate below sits at a
// PLAYER ACTION or a UI surface, so the simulation is byte-identical for free and Pro players and
// the pinned 160-week reproducibility test can never see monetization.

import { isPro } from "./pro.ts";

/** Everything the free tier bounds. One member per wall the player can actually hit. */
export type ProFeature =
  | "eraAdvance"
  | "scenario"
  | "newGamePlus"
  | "ascension"
  | "creativeMode"
  | "platformDivision"
  | "vault"
  | "museum"
  | "mastery"
  | "founderLegend"
  | "challengeArchive"
  | "timeMachine";

/**
 * The free allowance. Tune here and nowhere else — the paywall copy, the lock chips, the gates and
 * the store listing all read these values.
 *
 * ⚠ `maxEra` is the single most consequential number in the business model. It is where nearly all
 * conversion happens, and moving it moves revenue and review sentiment in opposite directions:
 * lower converts harder and reads meaner; higher is more generous and converts later. Era 2 is the
 * end of the Growth Era — reached at reputation 60 AND $8M cumulative revenue (see
 * `BALANCE.eras`), i.e. a genuinely earned, multi-hour milestone with a built-in celebration beat
 * to attach the offer to. If you change it, re-read `MONETIZATION.md` first.
 */
export const FREE_TIER = {
  /** Highest era a free company may advance INTO. Era 3 (Platform) and up are Pro. */
  maxEra: 2,
  /** Scenarios playable for free — the two on-ramps. The rest are Pro. */
  scenarioIds: ["first-light", "bootstrapped"] as readonly string[],
  /** Daily challenges are free, every day, forever. Only the cross-run ARCHIVE is Pro. */
  dailyChallenge: true,
} as const;

/** Why a paywall opened. Drives the paywall's headline so the offer always answers the question the
 *  player just asked, instead of a generic "upgrade!" — the single largest lever on conversion after
 *  price itself. */
export type PaywallReason =
  | "onboarding"
  /** Offered ONLY to an existing monthly subscriber, so it needs `force` (see `openPaywall`). */
  | "upgradeYearly"
  | ProFeature;

/** True when `feature` is currently locked for this device. `pro` is injectable for tests. */
export function isLocked(feature: ProFeature, pro: boolean = isPro()): boolean {
  if (pro) return false;
  // Listed for exhaustiveness: today every feature in the union is Pro-only when not subscribed.
  // Anything that becomes free later gets an early `return false` here, not a deletion.
  switch (feature) {
    case "eraAdvance":
    case "scenario":
    case "newGamePlus":
    case "ascension":
    case "creativeMode":
    case "platformDivision":
    case "vault":
    case "museum":
    case "mastery":
    case "founderLegend":
    case "challengeArchive":
    case "timeMachine":
      return true;
  }
}

/** True when advancing OUT of `era` requires Pro. Era 1 → 2 is free; 2 → 3 is the wall.
 *  Pro players are never gated. */
export function eraAdvanceLocked(currentEra: number, pro: boolean = isPro()): boolean {
  if (pro) return false;
  return currentEra >= FREE_TIER.maxEra;
}

/** True when starting `scenarioId` requires Pro. */
export function scenarioLocked(scenarioId: string, pro: boolean = isPro()): boolean {
  if (pro) return false;
  return !FREE_TIER.scenarioIds.includes(scenarioId);
}

/* ─────────────────────────────  PAYWALL COPY  ─────────────────────────────
   Headline + subhead per reason. Kept beside the gate table so a new gate cannot ship without the
   sentence that justifies it. Every line states what the player GETS — never what they're losing,
   never a countdown, never manufactured scarcity. */

export interface PaywallCopy {
  eyebrow: string;
  title: string;
  body: string;
}

const COPY: Record<PaywallReason, PaywallCopy> = {
  onboarding: {
    eyebrow: "Silicon Pro",
    title: "Build the whole empire",
    body: "Silicon is free to play — the garage, the lab, the market, all of it. Pro opens the rest of the industry.",
  },
  eraAdvance: {
    eyebrow: "You've earned the Platform Era",
    title: "The next era is Pro",
    body: "Hardware was the warm-up. The Platform Era puts an OS, an installed base and an ecosystem under your company — then the AI Era rewrites the board again. Pro unlocks both, plus everything else below.",
  },
  scenario: {
    eyebrow: "Scenarios",
    title: "Hand-built runs",
    body: "Curated starts with their own rules, constraints and three-star targets — a bankrupt turnaround, a bootstrap with no capital, a giant to dethrone. Two are free; Pro opens the rest.",
  },
  newGamePlus: {
    eyebrow: "New Game+",
    title: "Carry your legacy forward",
    body: "Found your next company on the back of this one: inherited capital, reputation, fans and research, plus a permanent founder perk for every empire you retire. Pro unlocks the prestige loop.",
  },
  ascension: {
    eyebrow: "Ascension",
    title: "Turn up the heat",
    body: "Opt into harder runs — tougher verdict bars, a smaller head start — and climb the Founder Legend ladder for clearing them. Pro unlocks every Heat level.",
  },
  creativeMode: {
    eyebrow: "Creative Mode",
    title: "Design with no limits",
    body: "An unlimited cash floor and unlimited research, so you can never go bankrupt and never wait. Build the device you actually want to build. Included with Pro.",
  },
  platformDivision: {
    eyebrow: "Platform Division",
    title: "Own the stack",
    body: "Found your own OS, licence it to rivals, take a cut of every app sold on it, and watch your installed base become worth more than any device you ship. Included with Pro.",
  },
  vault: {
    eyebrow: "The Vault",
    title: "The files nobody filed",
    body: "Dossiers your company quietly accumulates — rival secrets, buried memos, the things you were never meant to read. Pro opens the Vault.",
  },
  museum: {
    eyebrow: "Device Museum",
    title: "Every device you ever shipped",
    body: "A permanent, cross-company gallery of your designs, with the numbers each one posted. Pro keeps the collection.",
  },
  mastery: {
    eyebrow: "Category Mastery",
    title: "Master every category",
    body: "Long-arc mastery tracks per product category, each with its own perks for the founders who go deep instead of wide. Pro unlocks all of them.",
  },
  founderLegend: {
    eyebrow: "Founder Legend",
    title: "Your career, across every company",
    body: "A lifetime record that outlives any single run — every empire, every Heat level cleared, every title earned. Pro tracks the whole career.",
  },
  challengeArchive: {
    eyebrow: "Challenge Archive",
    title: "Every challenge, forever",
    body: "Today's challenge is always free. Pro keeps the full archive — past dailies, the weekly, and your personal best on each one.",
  },
  upgradeYearly: {
    eyebrow: "Same Pro, less money",
    title: "Switch to yearly",
    body: "You're on the monthly plan. Yearly is the same Silicon Pro for a lower cost per month — the App Store credits what's left of your current period, so there's nothing to cancel first.",
  },
  timeMachine: {
    eyebrow: "The Time Machine",
    title: "Never lose a company again",
    body: "Pro quietly snapshots your company every quarter and keeps the last five. One catastrophic launch, one over-hired year, one factory bought at the wrong moment — rewind and take the other road. Campaign only: scenarios and challenges stay scored on their own terms.",
  },
};

export function paywallCopy(reason: PaywallReason): PaywallCopy {
  return COPY[reason] ?? COPY.onboarding;
}

/** What Pro includes, in the order that sells. Used verbatim by the paywall's benefit list, so the
 *  promise on the paywall and the gates in the code can never drift apart. */
export const PRO_BENEFITS: { title: string; body: string }[] = [
  { title: "The full campaign", body: "Platform, AI and Autonomy eras — the arc to IPO." },
  { title: "New Game+", body: "Retire an empire, inherit its legacy, raise the heat." },
  { title: "Every scenario", body: "Hand-built runs with their own rules and star targets." },
  { title: "The Time Machine", body: "Rewind your company to any of the last 5 quarters." },
  { title: "Platform Division", body: "Found an OS, licence it, own the ecosystem." },
  { title: "Creative Mode", body: "Unlimited funds and research. No limits." },
  { title: "The archives", body: "Vault dossiers, Museum, Mastery, Founder Legend." },
  { title: "No ads, ever", body: "No timers, no currency, no nags. As always." },
];

/**
 * Which promises LEAD when the paywall was raised by a specific gate.
 *
 * The headline already answers the wall the player just walked into — but until this table existed
 * the list underneath it still opened with "The full campaign" no matter what, so a player who
 * tapped a locked scenario read a scenario headline above an argument about something else. The
 * first two items are the only ones many players read; they should be the answer to the question
 * that was actually asked.
 *
 * Same rule as the founding brief: this REORDERS, it never adds, drops or edits a promise, and
 * `proGates.test.ts` asserts that against every reason. Anything unlisted keeps its authored order
 * behind the leaders, so a new benefit or a new gate degrades to today's behaviour rather than
 * silently vanishing.
 */
export const REASON_BENEFIT_ORDER: Partial<Record<PaywallReason, readonly string[]>> = {
  eraAdvance: ["The full campaign", "Platform Division", "New Game+"],
  scenario: ["Every scenario", "The full campaign", "New Game+"],
  newGamePlus: ["New Game+", "The archives", "The full campaign"],
  ascension: ["New Game+", "The archives", "Every scenario"],
  creativeMode: ["Creative Mode", "The archives", "The full campaign"],
  platformDivision: ["Platform Division", "The full campaign", "New Game+"],
  vault: ["The archives", "The full campaign", "Every scenario"],
  museum: ["The archives", "Creative Mode", "The full campaign"],
  mastery: ["The archives", "The full campaign", "New Game+"],
  founderLegend: ["The archives", "New Game+", "The full campaign"],
  challengeArchive: ["The archives", "Every scenario", "The full campaign"],
  timeMachine: ["The Time Machine", "The full campaign", "The archives"],
  // `onboarding` is absent on purpose: with no gate to answer, the founding brief's ambition
  // ordering takes over there instead. `upgradeYearly` is absent because that player already owns
  // every one of these — reordering their own benefits would be theatre.
};

/** Headline shown to someone who has subscribed on this device before. Returning subscribers are
 *  the cheapest revenue an app has, and the surest way to lose them is to hand them the
 *  first-time-visitor sales pitch. No discount is claimed here — any real win-back pricing comes
 *  from the App Store itself, and our UI never states a price the store didn't give us. */
export const RETURNING_COPY: PaywallCopy = {
  eyebrow: "Welcome back",
  title: "Your company is where you left it",
  body: "Your saves, your Museum, your Founder Legend and every star you've earned are all still here. Restart Pro and the locks come straight off — nothing to rebuild.",
};
