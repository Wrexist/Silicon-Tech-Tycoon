import { describe, it, expect, beforeEach, vi } from "vitest";
import { maybePromptFirstLaunchReview, maybePromptReview, markReviewRated, requestAppStoreReview, onReviewPrompt, MIN_GAP_MS } from "./review.ts";

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

describe("later review moments (first hit, new era)", () => {
  const STATE = "silicon.review.v2";
  const DAY = 24 * 60 * 60 * 1000;

  it("asks at each moment once, spaced at least MIN_GAP_MS apart", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const off = onReviewPrompt((m) => { seen.push(m); });
    const t0 = 1_000_000_000_000;
    maybePromptReview("first-launch", t0);
    maybePromptReview("first-hit", t0 + DAY); // too soon after the first ask
    maybePromptReview("first-hit", t0 + MIN_GAP_MS); // now allowed
    maybePromptReview("first-hit", t0 + 10 * MIN_GAP_MS); // already asked
    maybePromptReview("new-era", t0 + 2 * MIN_GAP_MS);
    vi.runAllTimers();
    expect(seen).toEqual(["first-launch", "first-hit", "new-era"]);
    off();
    vi.useRealTimers();
  });

  it("never asks again once the player tapped Rate", () => {
    vi.useFakeTimers();
    let fired = 0;
    const off = onReviewPrompt(() => { fired += 1; });
    maybePromptReview("first-launch", 1);
    markReviewRated();
    maybePromptReview("first-hit", 1 + 5 * MIN_GAP_MS);
    maybePromptReview("new-era", 1 + 9 * MIN_GAP_MS);
    vi.runAllTimers();
    expect(fired).toBe(1);
    expect(JSON.parse(localStorage.getItem(STATE)!).rated).toBe(true);
    off();
    vi.useRealTimers();
  });

  it("an install that saw the original v1 prompt still gets the later moments, but not the first again", () => {
    vi.useFakeTimers();
    localStorage.setItem(FLAG, "1");
    const seen: string[] = [];
    const off = onReviewPrompt((m) => { seen.push(m); });
    maybePromptFirstLaunchReview();
    maybePromptReview("new-era");
    vi.runAllTimers();
    expect(seen).toEqual(["new-era"]);
    off();
    vi.useRealTimers();
  });

  it("survives a corrupt stored state", () => {
    localStorage.setItem(STATE, "{not json");
    expect(() => maybePromptReview("first-hit", 5)).not.toThrow();
  });
});
