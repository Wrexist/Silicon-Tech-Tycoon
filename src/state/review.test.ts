import { describe, it, expect, beforeEach, vi } from "vitest";
import { maybePromptFirstLaunchReview, requestAppStoreReview, onReviewPrompt } from "./review.ts";

// node env has no DOM — stub localStorage so the once-flag persists within a test.
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
}

const FLAG = "silicon.reviewPrompted.v1";

beforeEach(() => {
  // @ts-expect-error assigning a stub to the global for the node test env
  globalThis.localStorage = new MemStorage();
});

describe("first-launch App Store review prompt", () => {
  it("sets the once-flag and schedules exactly one (delayed) request", () => {
    vi.useFakeTimers();
    expect(localStorage.getItem(FLAG)).toBeNull();
    maybePromptFirstLaunchReview();
    expect(localStorage.getItem(FLAG)).toBe("1");
    expect(vi.getTimerCount()).toBe(1);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("is idempotent — a second launch never re-prompts", () => {
    vi.useFakeTimers();
    maybePromptFirstLaunchReview();
    maybePromptFirstLaunchReview();
    maybePromptFirstLaunchReview();
    expect(vi.getTimerCount()).toBe(1); // only the first call scheduled anything
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("fires the review-moment event to subscribers when the delay elapses (once)", () => {
    vi.useFakeTimers();
    let fired = 0;
    const off = onReviewPrompt(() => { fired += 1; });
    maybePromptFirstLaunchReview();
    expect(fired).toBe(0); // delayed, not immediate — the launch keynote plays first
    vi.runAllTimers();
    expect(fired).toBe(1);
    off();
    vi.useRealTimers();
  });

  it("does not fire the event again on a repeat call (flag already spent)", () => {
    vi.useFakeTimers();
    let fired = 0;
    const off = onReviewPrompt(() => { fired += 1; });
    maybePromptFirstLaunchReview();
    vi.runAllTimers();
    maybePromptFirstLaunchReview(); // second product / prestige
    vi.runAllTimers();
    expect(fired).toBe(1);
    off();
    vi.useRealTimers();
  });

  it("skips entirely when the flag is already set (e.g. a returning prestige player)", () => {
    vi.useFakeTimers();
    localStorage.setItem(FLAG, "1");
    maybePromptFirstLaunchReview();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("requestAppStoreReview is a safe no-op on web (resolves, never throws)", async () => {
    await expect(requestAppStoreReview()).resolves.toBeUndefined();
  });
});
