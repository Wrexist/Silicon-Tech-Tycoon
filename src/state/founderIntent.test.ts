// The founding brief. The point of these tests is that the personalization stays HONEST: the same
// promises are shown to everyone, only the order changes, and skipping costs nothing.
import { describe, expect, it, beforeEach } from "vitest";
import {
  INTENT_BENEFIT_ORDER,
  INTENT_HEADLINE,
  INTENT_OPTIONS,
  founderIntentAsked,
  founderIntentLabel,
  getFounderIntent,
  markFounderIntentSkipped,
  orderBenefits,
  resetFounderIntent,
  setFounderIntent,
} from "./founderIntent.ts";
import { PRO_BENEFITS } from "./proGates.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

beforeEach(() => {
  // @ts-expect-error node stub
  globalThis.localStorage = new MemStorage();
  resetFounderIntent();
});

describe("the question", () => {
  it("is one question with three real answers", () => {
    // Not a ten-step funnel. If this grows, it has become the thing it was built to avoid.
    expect(INTENT_OPTIONS).toHaveLength(3);
    for (const o of INTENT_OPTIONS) {
      expect(o.label.trim().length).toBeGreaterThan(0);
      expect(o.sub.trim().length).toBeGreaterThan(0);
    }
  });

  it("is asked exactly once — answered or skipped", () => {
    expect(founderIntentAsked()).toBe(false);
    setFounderIntent("craft");
    expect(founderIntentAsked()).toBe(true);
  });

  it("counts a skip as asked, so it never comes back", () => {
    markFounderIntentSkipped();
    expect(founderIntentAsked()).toBe(true);
    expect(getFounderIntent()).toBeNull();
  });

  it("round-trips the answer and surfaces it as a label", () => {
    setFounderIntent("rivalry");
    expect(getFounderIntent()).toBe("rivalry");
    expect(founderIntentLabel()).toBe(INTENT_OPTIONS.find((o) => o.id === "rivalry")!.label);
  });

  it("ignores a forged value", () => {
    localStorage.setItem("silicon.founderIntent", "free-pro-please");
    expect(getFounderIntent()).toBeNull();
  });
});

describe("what it changes", () => {
  it("has a headline for every answer", () => {
    for (const o of INTENT_OPTIONS) {
      const h = INTENT_HEADLINE[o.id];
      expect(h.title.trim().length).toBeGreaterThan(0);
      expect(h.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("only ever REORDERS the promises — never adds, drops or edits one", () => {
    // This is the line between personalization and a bait-and-switch: every player is shown the
    // same set of things Pro contains.
    for (const o of INTENT_OPTIONS) {
      const ordered = orderBenefits(PRO_BENEFITS, o.id);
      expect(ordered).toHaveLength(PRO_BENEFITS.length);
      expect(new Set(ordered)).toEqual(new Set(PRO_BENEFITS));
    }
  });

  it("floats the matching benefits to the front", () => {
    const ordered = orderBenefits(PRO_BENEFITS, "craft");
    expect(ordered[0].title).toBe("Creative Mode");
  });

  it("leaves the authored order alone when the question was skipped", () => {
    expect(orderBenefits(PRO_BENEFITS, null)).toEqual(PRO_BENEFITS);
  });

  it("names only benefits that actually exist — a typo would silently rank nothing", () => {
    const titles = new Set(PRO_BENEFITS.map((b) => b.title));
    for (const ids of Object.values(INTENT_BENEFIT_ORDER)) {
      for (const t of ids) expect(titles.has(t)).toBe(true);
    }
  });

  it("is stable for benefits it doesn't mention", () => {
    const ordered = orderBenefits(PRO_BENEFITS, "empire");
    const tail = ordered.slice(INTENT_BENEFIT_ORDER.empire.length).map((b) => b.title);
    const expectedTail = PRO_BENEFITS
      .filter((b) => !INTENT_BENEFIT_ORDER.empire.includes(b.title))
      .map((b) => b.title);
    expect(tail).toEqual(expectedTail);
  });
});
