// Paywall timing + routing. The rules under test are the difference between an offer that converts
// and one that gets the app a one-star "it nags you constantly" review.
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  firstLaunchAt,
  markOnboardingPaywallSeen,
  onPaywall,
  onboardingPaywallSeen,
  openPaywall,
  resetPaywallFlags,
  shouldShowOnboardingPaywall,
  stampFirstLaunch,
} from "./paywall.ts";
import { clearProRecord, grantFounding } from "./pro.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

beforeEach(() => {
  // @ts-expect-error node stub
  globalThis.localStorage = new MemStorage();
  resetPaywallFlags();
  clearProRecord();
});

describe("the founding offer", () => {
  it("is shown to a new free player", () => {
    expect(shouldShowOnboardingPaywall(false)).toBe(true);
  });

  it("is shown exactly ONCE per device", () => {
    expect(onboardingPaywallSeen()).toBe(false);
    markOnboardingPaywallSeen();
    expect(onboardingPaywallSeen()).toBe(true);
    expect(shouldShowOnboardingPaywall(false)).toBe(false);
  });

  it("is never shown to someone who already pays", () => {
    expect(shouldShowOnboardingPaywall(true)).toBe(false);
  });

  it("is never shown to a Founding Owner from the paid era", () => {
    grantFounding();
    // No `pro` argument — this reads the real entitlement, which is what the app does.
    expect(shouldShowOnboardingPaywall()).toBe(false);
  });
});

describe("first-launch stamp", () => {
  it("records the first launch and never moves afterwards", () => {
    stampFirstLaunch(1000);
    expect(firstLaunchAt()).toBe(1000);
    stampFirstLaunch(9999);
    expect(firstLaunchAt()).toBe(1000);
  });

  it("reads as absent before anything is stamped", () => {
    expect(firstLaunchAt()).toBe(0);
  });
});

describe("openPaywall", () => {
  it("raises the offer for a free player", () => {
    const seen = vi.fn();
    const off = onPaywall(seen);
    openPaywall({ reason: "vault" });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0].reason).toBe("vault");
    off();
  });

  it("short-circuits for a subscriber and runs the gated action instead", () => {
    // This is what lets every call site read as "gate the action, then do it" with no entitlement
    // branching — and it means a subscriber never sees a paywall for something they already own.
    grantFounding();
    const seen = vi.fn();
    const unlocked = vi.fn();
    const off = onPaywall(seen);
    openPaywall({ reason: "newGamePlus", onUnlocked: unlocked });
    expect(seen).not.toHaveBeenCalled();
    expect(unlocked).toHaveBeenCalledTimes(1);
    off();
  });

  it("stops delivering once the listener unsubscribes", () => {
    const seen = vi.fn();
    onPaywall(seen)();
    openPaywall({ reason: "museum" });
    expect(seen).not.toHaveBeenCalled();
  });
});
