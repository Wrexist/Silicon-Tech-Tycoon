import { describe, it, expect, beforeEach } from "vitest";
import {
  seasonIdOf,
  seasonLabel,
  currentSeasonId,
  seasonRewards,
  SEASON_RUNGS,
  getSeasons,
  seasonCount,
  recordSeasonCompletion,
  mergeSeasons,
  unlockedCosmetics,
  unlockedColorwayNames,
  unlockedFloorIds,
  unlockedWallIds,
  earnedBadges,
} from "./seasons.ts";

// node env: stub localStorage like the other profile-store tests.
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

beforeEach(() => {
  // @ts-expect-error assigning a stub to the global for the node test env
  globalThis.localStorage = new MemStorage();
});

describe("season id derivation", () => {
  it("derives the calendar-month season from a challenge date key", () => {
    expect(seasonIdOf("2026-07-18")).toBe("2026-07");
    expect(seasonIdOf("2026-01-01")).toBe("2026-01");
    expect(seasonIdOf("2025-12-31")).toBe("2025-12");
    // A weekly's Monday anchor resolves to the month it falls in.
    expect(seasonIdOf("2026-07-13")).toBe("2026-07");
    // Already a season id is accepted.
    expect(seasonIdOf("2026-07")).toBe("2026-07");
  });

  it("returns empty for malformed keys", () => {
    expect(seasonIdOf("garbage")).toBe("");
    expect(seasonIdOf("")).toBe("");
    // @ts-expect-error deliberately wrong type
    expect(seasonIdOf(null)).toBe("");
    expect(seasonIdOf("26-7-1")).toBe("");
  });

  it("labels a season id in plain language", () => {
    expect(seasonLabel("2026-07")).toBe("July 2026");
    expect(seasonLabel("2026-01")).toBe("January 2026");
    expect(seasonLabel("2025-12")).toBe("December 2025");
    expect(seasonLabel("bad")).toBe("bad");
  });

  it("derives the current season from a UTC date", () => {
    expect(currentSeasonId(new Date(Date.UTC(2026, 6, 18)))).toBe("2026-07");
    expect(currentSeasonId(new Date(Date.UTC(2026, 0, 1)))).toBe("2026-01");
  });
});

describe("reward-set generation", () => {
  it("is deterministic — same season id yields the identical reward set", () => {
    const a = seasonRewards("2026-07");
    const b = seasonRewards("2026-07");
    expect(a).toEqual(b);
  });

  it("pins rewards to the four rungs with all four cosmetic types", () => {
    const rewards = seasonRewards("2026-07");
    expect(rewards.map((r) => r.rung)).toEqual([...SEASON_RUNGS]);
    expect(rewards.map((r) => r.type)).toEqual(["colorway", "floor", "wall", "badge"]);
    for (const r of rewards) {
      expect(typeof r.cosmeticId).toBe("string");
      expect(r.cosmeticId.length).toBeGreaterThan(0);
      expect(typeof r.name).toBe("string");
      expect(r.name.length).toBeGreaterThan(0);
    }
  });

  it("varies across different seasons (not a single fixed set)", () => {
    const ids = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
    const colorways = new Set(ids.map((id) => seasonRewards(id)[0].cosmeticId));
    // With independent hashing there should be at least a couple of distinct colourways across 6 months.
    expect(colorways.size).toBeGreaterThan(1);
  });

  it("rung thresholds are strictly ascending", () => {
    for (let i = 1; i < SEASON_RUNGS.length; i++) {
      expect(SEASON_RUNGS[i]).toBeGreaterThan(SEASON_RUNGS[i - 1]);
    }
  });
});

describe("completion counting", () => {
  it("starts empty", () => {
    expect(getSeasons()).toEqual({ completions: {} });
    expect(seasonCount("2026-07")).toBe(0);
  });

  it("counts one per unique challenge and is idempotent per key", () => {
    const r1 = recordSeasonCompletion("daily:2026-07-01");
    expect(r1.seasonId).toBe("2026-07");
    expect(r1.count).toBe(1);
    // Re-recording the SAME daily never double-counts.
    const r2 = recordSeasonCompletion("daily:2026-07-01");
    expect(r2.count).toBe(1);
    expect(r2.crossed).toEqual([]);
    // A different challenge in the same month increments.
    recordSeasonCompletion("weekly:2026-07-06");
    expect(seasonCount("2026-07")).toBe(2);
  });

  it("routes completions to the season of the challenge DATE, not the wall clock", () => {
    recordSeasonCompletion("daily:2026-07-31");
    recordSeasonCompletion("daily:2026-08-01");
    expect(seasonCount("2026-07")).toBe(1);
    expect(seasonCount("2026-08")).toBe(1);
  });

  it("reports the rung crossed by the completion that reaches it (once)", () => {
    // First two: no rung yet (first rung is 3).
    expect(recordSeasonCompletion("daily:2026-09-01").crossed).toEqual([]);
    expect(recordSeasonCompletion("daily:2026-09-02").crossed).toEqual([]);
    // Third crosses the first rung.
    const third = recordSeasonCompletion("daily:2026-09-03");
    expect(third.count).toBe(3);
    expect(third.crossed).toHaveLength(1);
    expect(third.crossed[0].rung).toBe(SEASON_RUNGS[0]);
    // A fourth crosses nothing.
    expect(recordSeasonCompletion("daily:2026-09-04").crossed).toEqual([]);
  });

  it("ignores malformed challenge keys", () => {
    expect(recordSeasonCompletion("nope").count).toBe(0);
    expect(recordSeasonCompletion("daily:garbage").seasonId).toBe("");
    expect(getSeasons()).toEqual({ completions: {} });
  });
});

describe("derived unlocked cosmetics", () => {
  it("unlocks each rung's cosmetic once the count reaches its threshold", () => {
    const season = "2026-07";
    const rewards = seasonRewards(season);
    // Reach exactly the first two rungs (7 completions).
    for (let i = 0; i < SEASON_RUNGS[1]; i++) recordSeasonCompletion(`daily:2026-07-${String(i + 1).padStart(2, "0")}`);
    expect(seasonCount(season)).toBe(SEASON_RUNGS[1]);
    const unlocked = unlockedCosmetics();
    expect(unlocked.has(rewards[0].cosmeticId)).toBe(true); // rung 3
    expect(unlocked.has(rewards[1].cosmeticId)).toBe(true); // rung 7
    expect(unlocked.has(rewards[2].cosmeticId)).toBe(false); // rung 12 not reached
    expect(unlocked.has(rewards[3].cosmeticId)).toBe(false); // rung 20 not reached
  });

  it("exposes typed unlock sets for the Design Lab / HQ gates", () => {
    const season = "2026-07";
    const rewards = seasonRewards(season);
    // Reach the top rung (20 completions across two months' worth of unique keys within July is fine —
    // use distinct day keys 01..20).
    for (let i = 1; i <= SEASON_RUNGS[SEASON_RUNGS.length - 1]; i++) {
      recordSeasonCompletion(`daily:2026-07-${String(i).padStart(2, "0")}`);
    }
    const colorName = rewards[0].cosmeticId.slice(4);
    const floorId = rewards[1].cosmeticId.slice(4);
    const wallId = rewards[2].cosmeticId.slice(4);
    expect(unlockedColorwayNames().has(colorName)).toBe(true);
    expect(unlockedFloorIds().has(floorId)).toBe(true);
    expect(unlockedWallIds().has(wallId)).toBe(true);
    const badges = earnedBadges();
    expect(badges).toHaveLength(1);
    expect(badges[0].seasonId).toBe(season);
  });
});

describe("store tolerance + merge", () => {
  it("recovers from corrupt stored data as an empty store", () => {
    localStorage.setItem("silicon.seasons.v1", "{not json");
    expect(getSeasons()).toEqual({ completions: {} });
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({ completions: "nope" }));
    expect(getSeasons()).toEqual({ completions: {} });
    localStorage.setItem("silicon.seasons.v1", JSON.stringify([1, 2, 3]));
    expect(getSeasons()).toEqual({ completions: {} });
  });

  it("drops malformed season entries and keys that don't belong to their season", () => {
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({
      completions: {
        "2026-07": ["daily:2026-07-01", "daily:2026-08-01" /* wrong season */, 42, "daily:2026-07-01" /* dup */],
        "bad-season": ["daily:2026-07-02"],
      },
    }));
    const store = getSeasons();
    expect(store.completions["2026-07"]).toEqual(["daily:2026-07-01"]);
    expect(store.completions["bad-season"]).toBeUndefined();
  });

  it("merge unions completed keys per season (restore never downgrades a count)", () => {
    recordSeasonCompletion("daily:2026-07-01");
    recordSeasonCompletion("daily:2026-07-02");
    mergeSeasons({ completions: { "2026-07": ["daily:2026-07-02", "daily:2026-07-03"], "2026-08": ["daily:2026-08-01"] } });
    expect(seasonCount("2026-07")).toBe(3); // 01,02 (local) ∪ 02,03 (incoming) = 01,02,03
    expect(seasonCount("2026-08")).toBe(1);
  });

  it("merge tolerates garbage payloads", () => {
    recordSeasonCompletion("daily:2026-07-01");
    mergeSeasons(null);
    mergeSeasons("nope");
    mergeSeasons({ completions: 5 });
    expect(seasonCount("2026-07")).toBe(1);
  });
});
