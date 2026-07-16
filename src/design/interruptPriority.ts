// One canonical priority order for every full-screen interrupt overlay — replacing the dozen
// hand-maintained "yield to these other pendings" lists that used to live inside each overlay and
// drift apart (PostLaunchEvent listed 11 siblings, RegionalEvent 7, CommunityAsk 5, each subtly
// different). Divergent lists are a latent modal-stacking bug: add a new interrupt and every existing
// list silently forgets to yield to it. Here the order is declared once; each overlay just asks
// "is anything higher-priority up?" and the answer is always consistent.
//
// The order below is the SAME hierarchy the old per-overlay lists already implied (reverse-engineered
// from every `higherUp` guard so no overlay loses a yield it had) — only now it's a single source of
// truth. The tick's interrupt budget already ensures at most one opportunistic card is RAISED per
// week; this is the presentation-layer backstop for the cases that can still coexist (a launch reveal,
// a scheduled awards ceremony, a persisted card waiting behind another).
import type { GameState } from "../state/gameState.ts";
import { readyLaunchClaimed } from "./overlayGuard.ts";
import { isLaunchRevealActive } from "./launchReveal.ts";

/** Every full-screen interrupt overlay, highest priority first. */
export const INTERRUPT_ORDER = [
  "strike",
  "awards",
  "rivalry",
  "eureka",
  "communityAsk",
  "earnings",
  "staffMoment",
  "regionalEvent",
  "licenseOffer",
  "staffEvent",
  "postLaunch",
] as const;

export type InterruptKey = (typeof INTERRUPT_ORDER)[number];

/** Predicate per interrupt: is its pending card currently set on the state? */
const IS_PENDING: Record<InterruptKey, (s: GameState) => boolean> = {
  strike: (s) => s.pendingStrike != null,
  awards: (s) => s.pendingAwards != null,
  rivalry: (s) => s.pendingRivalry != null,
  eureka: (s) => s.pendingEureka != null,
  communityAsk: (s) => s.pendingCommunityAsk != null,
  earnings: (s) => s.pendingEarnings != null,
  staffMoment: (s) => s.pendingStaffMoment != null,
  regionalEvent: (s) => s.pendingRegionalEvent != null,
  licenseOffer: (s) => s.pendingLicenseOffer != null,
  staffEvent: (s) => s.pendingStaffEvent != null,
  postLaunch: (s) => s.pendingPostLaunch != null,
};

/** The player's own launch payoff — the reveal animation running, or a finished build waiting to be
 *  claimed. It always outranks every opportunistic interrupt, so they all yield to it. */
export function launchMomentActive(state: GameState): boolean {
  return isLaunchRevealActive() || state.ready.some((p) => !readyLaunchClaimed(p.id));
}

/** A pending HQ "decision required" card (a market choice or a rival poaching attempt). The three
 *  lowest-priority overlays yield to these so the player can clear the required decision first. */
export function decisionPending(state: GameState): boolean {
  return state.pendingChoice != null || state.pendingPoach != null;
}

/** True when something STRICTLY higher priority than `self` is on the table, so `self`'s overlay
 *  should render nothing this frame. Covers the launch moment and every higher-ranked interrupt — the
 *  one check that replaces each overlay's bespoke sibling list. (HQ decision cards are handled by the
 *  three lowest overlays via `decisionPending`, matching prior behavior.) */
export function higherPriorityPending(state: GameState, self: InterruptKey): boolean {
  if (launchMomentActive(state)) return true;
  const selfRank = INTERRUPT_ORDER.indexOf(self);
  for (let i = 0; i < selfRank; i++) {
    if (IS_PENDING[INTERRUPT_ORDER[i]](state)) return true;
  }
  return false;
}

// --- Decision Inbox tier ---------------------------------------------------------------------------
// The LOW-STAKES streams: they carry small RP/mood/fan stakes, so instead of seizing the whole screen
// they wait in a non-blocking banner (the Decision Inbox) the player opens on their own schedule. The
// weightier moments (strike / rivalry / eureka / earnings / license / awards) stay full-screen. This
// is presentation only — the engine still raises the same pending* fields; the budget rule guarantees
// at most one is pending at a time, so the "inbox" holds 0 or 1.
export const INBOX_INTERRUPTS: readonly InterruptKey[] = [
  "communityAsk",
  "regionalEvent",
  "staffMoment",
  "staffEvent",
  "postLaunch",
];

export function isInboxInterrupt(key: InterruptKey): boolean {
  return INBOX_INTERRUPTS.includes(key);
}

/** Which low-stakes interrupt is currently pending (at most one, by the budget rule), or null. */
export function inboxPendingKey(state: GameState): InterruptKey | null {
  for (const key of INBOX_INTERRUPTS) {
    if (IS_PENDING[key](state)) return key;
  }
  return null;
}

/** Banner copy for each inbox-tier decision — a calm one-liner naming what's waiting. */
export const INBOX_LABEL: Record<string, { eyebrow: string; title: string }> = {
  communityAsk: { eyebrow: "Community", title: "Your community is asking for something" },
  regionalEvent: { eyebrow: "Markets", title: "An overseas market needs a response" },
  staffMoment: { eyebrow: "Team", title: "A teammate is ready to grow" },
  staffEvent: { eyebrow: "Team", title: "A teammate hit a turning point" },
  postLaunch: { eyebrow: "On shelves", title: "A product on shelves needs a decision" },
};
