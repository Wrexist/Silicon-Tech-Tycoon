import { describe, it, expect, beforeEach } from "vitest";
import { hasSeenIntro, markIntroSeen, INTRO_COPY } from "./interruptIntros.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

beforeEach(() => {
  // @ts-expect-error stub for the node test env
  globalThis.localStorage = new MemStorage();
});

describe("first-time interrupt intros", () => {
  it("an unmet system reports unseen, then seen once marked", () => {
    expect(hasSeenIntro("communityAsk")).toBe(false);
    markIntroSeen("communityAsk");
    expect(hasSeenIntro("communityAsk")).toBe(true);
  });

  it("marking is idempotent and per-key", () => {
    markIntroSeen("earnings");
    markIntroSeen("earnings"); // no throw, no duplicate
    expect(hasSeenIntro("earnings")).toBe(true);
    expect(hasSeenIntro("regionalEvent")).toBe(false); // unrelated key untouched
  });

  it("survives corrupt storage without throwing", () => {
    localStorage.setItem("silicon.introsSeen.v1", "{bad json");
    expect(hasSeenIntro("earnings")).toBe(false);
    markIntroSeen("earnings");
    expect(hasSeenIntro("earnings")).toBe(true);
  });

  it("every intro key has non-empty copy", () => {
    for (const [key, text] of Object.entries(INTRO_COPY)) {
      expect(text.length, `copy for ${key}`).toBeGreaterThan(10);
    }
  });
});
