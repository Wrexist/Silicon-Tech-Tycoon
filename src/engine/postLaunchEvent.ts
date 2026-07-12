// Post-launch reactive events (item 3.6) — a product ALREADY on shelves hits a mid-lifecycle moment
// (it's selling out and hot, it's stalling on shelves, or a supply pinch threatens the run) and the
// player answers with a small business choice. Turns the sell phase from a passive wait into an
// active decision, generalising the one-off Rival Strike interrupt. PURE + deterministic.
//
// Sim-safe by construction: the cadence is a DERIVED hash of (seed, week) — never the sim RNG (salt
// 257) — and every outcome is player-CHOSEN via an opt-in reducer. A do-nothing run raises none
// (the pinned solo sim never accepts a choice), so it stays byte-identical.
import { BALANCE } from "./balance.ts";
import type { CategoryId } from "./types.ts";

/** A concrete outcome the reducer applies. All fields optional; a do-nothing "hold" option is legal. */
export interface PostLaunchEffect {
  /** Up-front cash cost in DOLLARS (a marketing push / securing parts). */
  cashCost?: number;
  /** Cash recovered in DOLLARS (a clearance markdown). */
  cashGain?: number;
  /** Reputation delta. */
  rep?: number;
  /** Fanbase delta. */
  fans?: number;
}

export interface PostLaunchOption {
  label: string;
  blurb: string;
  effect: PostLaunchEffect;
}

export type PostLaunchKind = "momentum" | "stall" | "supply";

export interface PostLaunchEvent {
  week: number;
  productId: string;
  productName: string;
  kind: PostLaunchKind;
  title: string;
  body: string;
  options: PostLaunchOption[]; // 2–3 player choices
}

/** The minimal read of a live launched product the generator needs (decoupled from LaunchedProduct). */
export interface PostLaunchTarget {
  productId: string;
  productName: string;
  category: CategoryId;
  sellThrough: number; // 0..1 — unitsSold ÷ plannedUnits so far
  weeksLive: number;   // weeks since launch
  weeksLeft: number;   // weeks remaining in the selling window
}

/** Tiny deterministic hash → [0,1), same recipe as staffMoment / eureka — never the sim RNG. */
function hash01(seed: number, week: number, salt: number): number {
  let h = (seed ^ Math.imul(week + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Should a post-launch event fire this week? ~one per cadence window (deterministic, RNG-free). */
export function postLaunchDue(seed: number, week: number): boolean {
  return hash01(seed, week, 257) < 1 / BALANCE.postLaunch.cadenceWeeks;
}

/** Is a live product a valid target — mid-lifecycle, with runway left to matter? */
export function postLaunchEligible(t: PostLaunchTarget): boolean {
  const c = BALANCE.postLaunch;
  return t.weeksLive >= c.minWeeksLive && t.weeksLeft >= c.minWeeksLeft;
}

/** Choose which live product the event is about: the one whose performance is most EXTREME (hottest
 *  seller or slowest mover), so the moment always lands on the product the player cares about. Ties
 *  break on productId for determinism. Returns null if nothing qualifies. */
export function pickPostLaunchTarget(targets: readonly PostLaunchTarget[]): PostLaunchTarget | null {
  const eligible = targets.filter(postLaunchEligible);
  if (eligible.length === 0) return null;
  // Rank by distance of sell-through from the middle (0.5) — the most notable performer wins.
  const sorted = [...eligible].sort((a, b) => {
    const da = Math.abs(a.sellThrough - 0.5), db = Math.abs(b.sellThrough - 0.5);
    return da !== db ? db - da : a.productId < b.productId ? -1 : 1;
  });
  return sorted[0];
}

/** Build the event for `target`, keyed to how it's selling. Pure + deterministic. */
export function generatePostLaunchEvent(target: PostLaunchTarget, week: number): PostLaunchEvent {
  const c = BALANCE.postLaunch;
  const base = { week, productId: target.productId, productName: target.productName };

  // Hot seller — press the advantage while attention is high.
  if (target.sellThrough >= c.momentumSellThrough) {
    return {
      ...base,
      kind: "momentum",
      title: `“${target.productName}” is flying off shelves`,
      body: `Demand for ${target.productName} is outrunning the shelf. Pour fuel on the fire while it's hot?`,
      options: [
        { label: "Fund a hype push", blurb: `Costs ${fmt(c.pushCost)} — +${c.pushFans} fans, +${c.pushRep} rep off the buzz.`, effect: { cashCost: c.pushCost, fans: c.pushFans, rep: c.pushRep } },
        { label: "Let it ride", blurb: "Bank the momentum, spend nothing.", effect: { fans: Math.round(c.pushFans * 0.15) } },
      ],
    };
  }

  // Slow mover — clear the stock or hold the price.
  if (target.sellThrough <= c.stallSellThrough) {
    return {
      ...base,
      kind: "stall",
      title: `“${target.productName}” is stalling on shelves`,
      body: `${target.productName} isn't moving. Cut the price to clear stock, or hold the line and protect the brand?`,
      options: [
        { label: "Run a clearance", blurb: `Recover ${fmt(c.clearanceGain)} in stuck stock — but −${c.clearanceRepDip} rep on the markdown.`, effect: { cashGain: c.clearanceGain, rep: -c.clearanceRepDip } },
        { label: "Hold the price", blurb: "Protect the brand and wait it out.", effect: {} },
      ],
    };
  }

  // Otherwise a supply pinch mid-run — pay to secure parts or absorb the hit.
  return {
    ...base,
    kind: "supply",
    title: `Supply pinch on “${target.productName}”`,
    body: `A parts shortage threatens ${target.productName}'s run. Secure supply at a premium, or ride it out and take the hit?`,
    options: [
      { label: "Secure the parts", blurb: `Costs ${fmt(c.supplyCost)} — keeps the line and the fans happy.`, effect: { cashCost: c.supplyCost, fans: Math.round(c.pushFans * 0.2) } },
      { label: "Ride it out", blurb: `Save the cash — but −${c.supplyRepDip} rep as units slip.`, effect: { rep: -c.supplyRepDip } },
    ],
  };
}

// Small helper so option blurbs read with a $ amount without importing the Money formatter here.
function fmt(dollars: number): string {
  return dollars >= 1000 ? `$${Math.round(dollars / 1000)}K` : `$${dollars}`;
}
