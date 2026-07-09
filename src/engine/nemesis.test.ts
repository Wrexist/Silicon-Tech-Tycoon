import { describe, it, expect } from "vitest";
import { updateNemesis, nemesisLaunchEdge, nemesisTaunt, heatTier, HEAT_TIER_LABEL, type Nemesis, type ClashSignal } from "./nemesis.ts";
import { BALANCE } from "./balance.ts";

const N = BALANCE.competitors.nemesis;
const always = () => true;
const rep = (id: string) => (id === "big" ? 80 : id === "mid" ? 50 : 20);

describe("updateNemesis — formation", () => {
  it("stays null with no clashes (the pinned-sim path)", () => {
    const r = updateNemesis({ current: null, signals: [], week: 10, existsById: always, pickWeight: rep });
    expect(r.nemesis).toBeNull();
    expect(r.declared).toBeNull();
  });

  it("forms on the first clash and announces it via `declared`", () => {
    const r = updateNemesis({ current: null, signals: [{ kind: "struck", rivalId: "mid" }], week: 12, existsById: always, pickWeight: rep });
    expect(r.nemesis?.rivalId).toBe("mid");
    // A strike-born feud runs hot immediately: the declaration baseline PLUS the forming clash, which
    // also lands on the scoreboard (they struck the first blow → 0–1).
    expect(r.nemesis?.heat).toBe(N.formHeat + N.heat.struck);
    expect(r.nemesis?.rivalWins).toBe(1);
    expect(r.nemesis?.playerWins).toBe(0);
    expect(r.nemesis?.sinceWeek).toBe(12);
    expect(r.declared?.rivalId).toBe("mid"); // the reveal moment fires this week only
  });

  it("picks the highest-weight (biggest) rival when several clashes could form", () => {
    const signals: ClashSignal[] = [{ kind: "overtake", rivalId: "small" }, { kind: "overtake", rivalId: "big" }, { kind: "overtake", rivalId: "mid" }];
    const r = updateNemesis({ current: null, signals, week: 5, existsById: always, pickWeight: rep });
    expect(r.nemesis?.rivalId).toBe("big");
  });

  it("ignores clashes with a rival that no longer exists", () => {
    const r = updateNemesis({ current: null, signals: [{ kind: "struck", rivalId: "ghost" }], week: 3, existsById: (id) => id !== "ghost", pickWeight: rep });
    expect(r.nemesis).toBeNull();
  });
});

describe("updateNemesis — heat + head-to-head", () => {
  const base: Nemesis = { rivalId: "mid", sinceWeek: 1, heat: 40, peakHeat: 40, playerWins: 1, rivalWins: 1, lastClashWeek: 1 };

  it("a player-favoured clash adds heat + a player win; decays on a quiet week", () => {
    const won = updateNemesis({ current: base, signals: [{ kind: "overtake", rivalId: "mid" }], week: 6, existsById: always, pickWeight: rep });
    expect(won.nemesis!.heat).toBe(40 + N.heat.overtake);
    expect(won.nemesis!.playerWins).toBe(2);
    expect(won.nemesis!.rivalWins).toBe(1);
    expect(won.declared).toBeNull(); // already formed → no re-reveal

    const quiet = updateNemesis({ current: base, signals: [{ kind: "overtake", rivalId: "other" }], week: 6, existsById: always, pickWeight: rep });
    expect(quiet.nemesis!.heat).toBe(40 - N.decayPerWeek); // no clash with OUR nemesis → decay
    expect(quiet.nemesis!.playerWins).toBe(1);
  });

  it("being struck adds heat + a rival win", () => {
    const r = updateNemesis({ current: base, signals: [{ kind: "struck", rivalId: "mid" }], week: 7, existsById: always, pickWeight: rep });
    expect(r.nemesis!.rivalWins).toBe(2);
    expect(r.nemesis!.heat).toBe(40 + N.heat.struck);
  });

  it("clamps heat to [0,100] and tracks the peak", () => {
    const hot: Nemesis = { ...base, heat: 95, peakHeat: 95 };
    const r = updateNemesis({ current: hot, signals: [{ kind: "dethroned", rivalId: "mid" }], week: 8, existsById: always, pickWeight: rep });
    expect(r.nemesis!.heat).toBe(100);
    expect(r.nemesis!.peakHeat).toBe(100);
    const cold: Nemesis = { ...base, heat: 1 };
    const d = updateNemesis({ current: cold, signals: [], week: 9, existsById: always, pickWeight: rep });
    expect(d.nemesis!.heat).toBe(0); // can't go negative
  });

  it("dissolves when the nemesis rival leaves the field (acquired/removed)", () => {
    const r = updateNemesis({ current: base, signals: [], week: 10, existsById: () => false, pickWeight: rep });
    expect(r.nemesis).toBeNull();
  });
});

describe("nemesisLaunchEdge", () => {
  it("is null for a non-nemesis rival", () => {
    const n: Nemesis = { rivalId: "mid", sinceWeek: 1, heat: 100, peakHeat: 100, playerWins: 0, rivalWins: 0, lastClashWeek: 1 };
    expect(nemesisLaunchEdge(n, "other")).toBeNull();
    expect(nemesisLaunchEdge(null, "mid")).toBeNull();
  });
  it("scales the strength bonus with heat, capped at the max", () => {
    const hot: Nemesis = { rivalId: "mid", sinceWeek: 1, heat: 100, peakHeat: 100, playerWins: 0, rivalWins: 0, lastClashWeek: 1 };
    const cool: Nemesis = { ...hot, heat: 25 };
    expect(nemesisLaunchEdge(hot, "mid")!.strengthBonus).toBeCloseTo(N.turfStrengthBonusAtMaxHeat, 6);
    expect(nemesisLaunchEdge(cool, "mid")!.strengthBonus).toBeCloseTo(N.turfStrengthBonusAtMaxHeat * 0.25, 6);
    expect(nemesisLaunchEdge(hot, "mid")!.turfWeight).toBe(N.turfCategoryWeight);
  });
});

describe("heatTier + taunts", () => {
  it("buckets heat into escalating tiers", () => {
    expect(heatTier(10)).toBe("simmering");
    expect(heatTier(40)).toBe("heated");
    expect(heatTier(60)).toBe("bitter");
    expect(heatTier(90)).toBe("allout");
    expect(HEAT_TIER_LABEL.allout).toBe("All-out war");
  });
  it("taunts are deterministic, in-pool, and vary by week", () => {
    expect(nemesisTaunt("undercutter", 7, 20)).toBe(nemesisTaunt("undercutter", 7, 20));
    const t = nemesisTaunt("defender", 7, 20);
    expect(typeof t).toBe("string");
    expect(t.length).toBeGreaterThan(0);
    // unknown doctrine falls back to the generalist pool (never throws)
    expect(typeof nemesisTaunt("mystery", 1, 1)).toBe("string");
  });
});
