import { describe, it, expect } from "vitest";
import {
  INTERRUPT_ORDER,
  higherPriorityPending,
  decisionPending,
  launchMomentActive,
  type InterruptKey,
} from "./interruptPriority.ts";
import type { GameState } from "../state/gameState.ts";

// The pending-state field each overlay key reads. Kept here so the test fails loudly if a key is
// added to INTERRUPT_ORDER without a matching predicate.
const FIELD: Record<InterruptKey, keyof GameState> = {
  strike: "pendingStrike",
  awards: "pendingAwards",
  rivalry: "pendingRivalry",
  eureka: "pendingEureka",
  communityAsk: "pendingCommunityAsk",
  earnings: "pendingEarnings",
  staffMoment: "pendingStaffMoment",
  regionalEvent: "pendingRegionalEvent",
  licenseOffer: "pendingLicenseOffer",
  staffEvent: "pendingStaffEvent",
  postLaunch: "pendingPostLaunch",
};

/** A minimal state with no launch in flight and only the named interrupt cards pending. */
function mk(...pending: InterruptKey[]): GameState {
  const s: Record<string, unknown> = { ready: [] };
  for (const key of pending) s[FIELD[key]] = { sentinel: true };
  return s as unknown as GameState;
}

describe("canonical interrupt priority", () => {
  it("lists every overlay exactly once, highest first", () => {
    expect(INTERRUPT_ORDER[0]).toBe("strike");
    expect(INTERRUPT_ORDER[INTERRUPT_ORDER.length - 1]).toBe("postLaunch");
    expect(new Set(INTERRUPT_ORDER).size).toBe(INTERRUPT_ORDER.length); // no dupes
    expect(Object.keys(FIELD).sort()).toEqual([...INTERRUPT_ORDER].sort()); // predicate for each
  });

  it("a quiet state hides nothing", () => {
    const quiet = mk();
    for (const key of INTERRUPT_ORDER) expect(higherPriorityPending(quiet, key)).toBe(false);
    expect(launchMomentActive(quiet)).toBe(false);
    expect(decisionPending(quiet)).toBe(false);
  });

  it("each overlay yields to every STRICTLY higher card and to none at or below it", () => {
    for (let self = 0; self < INTERRUPT_ORDER.length; self++) {
      const selfKey = INTERRUPT_ORDER[self];
      for (let other = 0; other < INTERRUPT_ORDER.length; other++) {
        const otherKey = INTERRUPT_ORDER[other];
        const state = mk(otherKey);
        const yields = higherPriorityPending(state, selfKey);
        // Yields iff the single pending card outranks self (strictly higher = lower index).
        expect(yields).toBe(other < self);
      }
    }
  });

  it("the launch moment (unclaimed ready build) outranks every card", () => {
    const launching = { ready: [{ id: "p1" }], pendingPostLaunch: { sentinel: true } } as unknown as GameState;
    expect(launchMomentActive(launching)).toBe(true);
    for (const key of INTERRUPT_ORDER) expect(higherPriorityPending(launching, key)).toBe(true);
  });

  it("decisionPending flags a pending HQ choice or poach (for the low overlays that yield to them)", () => {
    expect(decisionPending({ ready: [], pendingChoice: { sentinel: true } } as unknown as GameState)).toBe(true);
    expect(decisionPending({ ready: [], pendingPoach: { sentinel: true } } as unknown as GameState)).toBe(true);
    expect(decisionPending({ ready: [] } as unknown as GameState)).toBe(false);
  });
});
