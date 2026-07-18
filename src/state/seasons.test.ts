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

  it("rejects out-of-range months and impossible calendar days (no phantom seasons)", () => {
    expect(seasonIdOf("2026-00")).toBe("");     // month 0
    expect(seasonIdOf("2026-13")).toBe("");     // month 13
    expect(seasonIdOf("2026-13-99")).toBe("");  // month + day both invalid
    expect(seasonIdOf("2026-02-30")).toBe("");  // Feb never has 30 days
    expect(seasonIdOf("2025-02-29")).toBe("");  // 2025 is not a leap year
    expect(seasonIdOf("2026-07-00")).toBe("");  // day 0
    // ...but real dates (incl. a leap day) still resolve.
    expect(seasonIdOf("2024-02-29")).toBe("2024-02"); // 2024 is a leap year
    expect(seasonIdOf("2026-12-31")).toBe("2026-12");
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
    // An unknown kind prefix can't seed a track (only daily / weekly are real).
    expect(recordSeasonCompletion("foo:2026-07-01").seasonId).toBe("");
    expect(recordSeasonCompletion("weekly:2026-13-01").seasonId).toBe(""); // invalid month
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

describe("persisted earned cosmetics", () => {
  it("stores the earned cosmetic ids when a rung is crossed", () => {
    for (let i = 1; i <= SEASON_RUNGS[0]; i++) {
      recordSeasonCompletion(`daily:2026-07-${String(i).padStart(2, "0")}`);
    }
    const store = getSeasons();
    const rewards = seasonRewards("2026-07");
    expect(store.earned?.["2026-07"]).toContain(rewards[0].cosmeticId);
  });

  it("prefers the STORED earned ids over derivation (a pool reorder can't rewrite history)", () => {
    // Count clears the first rung, but the stored earned id is one the current pool would NOT derive.
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({
      completions: { "2026-07": ["daily:2026-07-01", "daily:2026-07-02", "daily:2026-07-03"] },
      earned: { "2026-07": ["col:legacy-swatch"] },
    }));
    const unlocked = unlockedCosmetics();
    expect(unlocked.has("col:legacy-swatch")).toBe(true);
    // The derived rung-0 cosmetic is NOT re-added — stored ids are authoritative for the season.
    expect(unlocked.has(seasonRewards("2026-07")[0].cosmeticId)).toBe(false);
  });

  it("falls back to derivation for legacy seasons with no stored earned ids", () => {
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({
      completions: { "2026-07": ["daily:2026-07-01", "daily:2026-07-02", "daily:2026-07-03"] },
    }));
    expect(unlockedCosmetics().has(seasonRewards("2026-07")[0].cosmeticId)).toBe(true);
  });

  it("merge unions earned cosmetic ids per season (never a downgrade)", () => {
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({
      completions: { "2026-07": ["daily:2026-07-01"] },
      earned: { "2026-07": ["col:a"] },
    }));
    mergeSeasons({
      completions: { "2026-07": ["daily:2026-07-02"] },
      earned: { "2026-07": ["flr:b"], "2026-08": ["wal:c"] },
    });
    const store = getSeasons();
    expect(new Set(store.earned?.["2026-07"])).toEqual(new Set(["col:a", "flr:b"]));
    expect(store.earned?.["2026-08"]).toEqual(["wal:c"]);
  });

  it("surfaces rewards recorded in `earned` for a season with NO completions (union iteration)", () => {
    // A partial restore can leave earned ids under a season whose completion keys never synced.
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({
      completions: {},
      earned: { "2026-07": ["bdg:champion", "col:foo"] },
    }));
    const unlocked = unlockedCosmetics();
    expect(unlocked.has("bdg:champion")).toBe(true);
    expect(unlocked.has("col:foo")).toBe(true);
    expect(earnedBadges().map((b) => b.id)).toContain("champion");
  });

  it("first crossing on a legacy season keeps the already-derived lower rungs (backfill)", () => {
    // Legacy season sitting AT the first rung (3 completions), no stored earned yet.
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({
      completions: { "2026-07": ["daily:2026-07-01", "daily:2026-07-02", "daily:2026-07-03"] },
    }));
    const rewards = seasonRewards("2026-07");
    // Completions 4..7 cross the SECOND rung (7); the crossing write must not wipe the rung-0 reward.
    for (let i = 4; i <= SEASON_RUNGS[1]; i++) recordSeasonCompletion(`daily:2026-07-${String(i).padStart(2, "0")}`);
    const unlocked = unlockedCosmetics();
    expect(unlocked.has(rewards[0].cosmeticId)).toBe(true); // rung 0 — preserved via backfill, not dropped
    expect(unlocked.has(rewards[1].cosmeticId)).toBe(true); // rung 1 — newly crossed
  });

  it("merge captures a rung neither device reached alone (evaluate newly crossed rungs)", () => {
    const rewards = seasonRewards("2026-07");
    // Device A: 6 completions (rung 0 crossed, earned stored → derivation suppressed).
    localStorage.setItem("silicon.seasons.v1", JSON.stringify({
      completions: { "2026-07": Array.from({ length: 6 }, (_, i) => `daily:2026-07-${String(i + 1).padStart(2, "0")}`) },
      earned: { "2026-07": [rewards[0].cosmeticId] },
    }));
    // Device B: a disjoint 6 completions (also only rung 0), earned stored.
    mergeSeasons({
      completions: { "2026-07": Array.from({ length: 6 }, (_, i) => `daily:2026-07-${String(i + 7).padStart(2, "0")}`) },
      earned: { "2026-07": [rewards[0].cosmeticId] },
    });
    // Union = 12 completions → crosses rung 1 (7) AND rung 2 (12), which neither device reached alone.
    const unlocked = unlockedCosmetics();
    expect(unlocked.has(rewards[1].cosmeticId)).toBe(true);  // rung 1 — captured by the merge
    expect(unlocked.has(rewards[2].cosmeticId)).toBe(true);  // rung 2 — captured by the merge
    expect(unlocked.has(rewards[3].cosmeticId)).toBe(false); // rung 3 (20) not reached
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
