import { describe, it, expect, beforeEach } from "vitest";
import { getProfileAchievements, mergeProfileAchievements } from "./achievementsProfile.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}
beforeEach(() => {
  // @ts-expect-error node stub
  globalThis.localStorage = new MemStorage();
});

describe("profile achievements (lifetime union)", () => {
  it("starts empty and tolerates corruption", () => {
    expect(getProfileAchievements()).toEqual([]);
    localStorage.setItem("silicon.achievements.v1", "{bad");
    expect(getProfileAchievements()).toEqual([]);
  });

  it("merges as a union and reports whether anything was added", () => {
    expect(mergeProfileAchievements(["a", "b"])).toBe(true);
    expect(new Set(getProfileAchievements())).toEqual(new Set(["a", "b"]));
    // re-merging known ids changes nothing
    expect(mergeProfileAchievements(["a"])).toBe(false);
    // a new id extends the union
    expect(mergeProfileAchievements(["b", "c"])).toBe(true);
    expect(new Set(getProfileAchievements())).toEqual(new Set(["a", "b", "c"]));
  });

  it("ignores empty/undefined and non-string entries", () => {
    expect(mergeProfileAchievements(undefined)).toBe(false);
    expect(mergeProfileAchievements([])).toBe(false);
    mergeProfileAchievements(["x", 1, null] as unknown[]);
    expect(getProfileAchievements()).toEqual(["x"]);
  });
});
