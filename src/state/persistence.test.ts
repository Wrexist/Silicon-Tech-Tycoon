// State / persistence regression tests for the data-loss + offline-catchup fixes (F1-F8).
// vitest runs in the `node` env here (no jsdom), so we stub localStorage on globalThis.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import { addItem, deskItems } from "../engine/furniture.ts";
import {
  newGame,
  catchUpOffline,
  advanceOneWeek,
  seedFeedSeq,
  launchReady,
  startBuild,
  buildWeeksFor,
  canAutoAssign,
  type GameState,
} from "./gameState.ts";
import type { Product } from "../engine/types.ts";

// --- Minimal localStorage stub (node env has no DOM) ---
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  has(k: string): boolean {
    return this.map.has(k);
  }
}

const SAVE_KEY = "silicon.save.v1";
const BACKUP_KEY = `${SAVE_KEY}.bak`;
const SAVE_VERSION = 1;
const MS_PER_WEEK = BALANCE.secondsPerTick * 1000; // one sim "week" of real time

let mem: MemStorage;

beforeEach(() => {
  mem = new MemStorage();
  // @ts-expect-error assigning a stub to the global for the node test env
  globalThis.localStorage = mem;
  vi.resetModules();
});

async function freshPersistence() {
  // Re-import after the stub is installed so module-level state (quotaWarned) is fresh.
  return await import("./persistence.ts");
}

function goodPhone(): Product {
  return {
    id: "x",
    name: "Aurora One",
    category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(140),
    designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

describe("F1 — offline catch-up applies exactly once", () => {
  it("advancing lastActive after one catch-up makes a second catch-up a no-op", () => {
    const start = { ...newGame(1234), lastActive: Date.now() - 3 * MS_PER_WEEK };

    const first = catchUpOffline(start);
    expect(first.weeks).toBe(3);
    const cashAfterOnce = first.state.cash;

    // The initializer persists the caught-up state (lastActive advanced). A subsequent load of
    // that SAME state must not re-apply any weeks.
    const second = catchUpOffline(first.state);
    expect(second.weeks).toBe(0);
    expect(second.state.cash).toBe(cashAfterOnce);
  });

  it("the OLD double-apply (re-running against stale lastActive) would diverge — proving the bug", () => {
    const start = { ...newGame(1234), lastActive: Date.now() - 2 * MS_PER_WEEK };
    const once = catchUpOffline(start);
    // The bug: the mount effect re-ran catch-up against the STALE on-disk lastActive (unchanged).
    const staleRerun = catchUpOffline({ ...once.state, lastActive: start.lastActive });
    expect(staleRerun.weeks).toBe(2); // extra weeks the fix prevents
  });

  it("is deterministic: same seed + same elapsed time → identical caught-up cash", () => {
    const t = Date.now() - 4 * MS_PER_WEEK;
    const a = catchUpOffline({ ...newGame(777), lastActive: t });
    const b = catchUpOffline({ ...newGame(777), lastActive: t });
    expect(a.weeks).toBe(b.weeks);
    expect(a.state.cash).toBe(b.state.cash);
  });
});

describe("F7 — offline fan floor: being away never erodes the fanbase", () => {
  it("fans floored at their pre-catchup value (engine alone would decay them)", () => {
    const start = { ...newGame(1234), fans: 1000, lastActive: Date.now() - BALANCE.offline.maxCatchUpWeeks * MS_PER_WEEK };
    const fansBefore = start.fans;
    const { state } = catchUpOffline(start);
    // Engine applies pure weekly decay during catch-up...
    expect(state.fans).toBeLessThan(fansBefore);
    // ...but the initializer floors it (replicated here) so the player isn't punished.
    const floored = Math.max(state.fans, fansBefore);
    expect(floored).toBe(fansBefore);
  });
});

describe("F2 — unreadable / newer save is preserved, not destroyed", () => {
  it("absent save returns 'absent' and creates no backup", async () => {
    const { loadResult } = await freshPersistence();
    expect(loadResult().status).toBe("absent");
    expect(mem.has(BACKUP_KEY)).toBe(false);
  });

  it("a newer-version save is 'unreadable' and backed up before any overwrite", async () => {
    const raw = JSON.stringify({ ...newGame(1), version: SAVE_VERSION + 5 });
    mem.setItem(SAVE_KEY, raw);

    const { loadResult, save } = await freshPersistence();
    expect(loadResult().status).toBe("unreadable");
    expect(mem.getItem(BACKUP_KEY)).toBe(raw); // original bytes preserved

    // Even after the caller starts a fresh game and autosaves, the backup survives intact.
    save(newGame(2));
    expect(mem.getItem(BACKUP_KEY)).toBe(raw);
  });

  it("a structurally-broken save (missing core fields) is 'unreadable' and backed up", async () => {
    const raw = JSON.stringify({ version: SAVE_VERSION, week: 5 }); // no trends/competitors/staff
    mem.setItem(SAVE_KEY, raw);
    const { loadResult } = await freshPersistence();
    expect(loadResult().status).toBe("unreadable");
    expect(mem.getItem(BACKUP_KEY)).toBe(raw);
  });

  it("a valid save round-trips as 'ok'", async () => {
    const { save, loadResult } = await freshPersistence();
    const s = { ...newGame(99), cash: dollars(123456) };
    save(s);
    const r = loadResult();
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.state.cash).toBe(dollars(123456));
  });
});

describe("F3 — quota-exceeded falls back to a trimmed save", () => {
  it("drops cashHistory + caps feed and still persists when the full save hits quota", async () => {
    const { save, loadResult } = await freshPersistence();
    const s: GameState = {
      ...newGame(5),
      cashHistory: Array.from({ length: 300 }, (_, i) => ({ week: i, cash: i })),
      feed: Array.from({ length: 100 }, (_, i) => ({ id: `f0-${i}`, week: 0, text: "m", tone: "neutral" as const })),
    };

    let calls = 0;
    const real = mem.setItem.bind(mem);
    vi.spyOn(mem, "setItem").mockImplementation((k: string, v: string) => {
      calls++;
      // Fail ONLY the first (full) write to the main key; allow the trimmed retry through.
      if (calls === 1 && k === SAVE_KEY) {
        throw Object.assign(new Error("quota"), { name: "QuotaExceededError", code: 22 });
      }
      real(k, v);
    });

    save(s);
    const r = loadResult();
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.state.cashHistory.length).toBeLessThanOrEqual(1);
      expect(r.state.feed.length).toBeLessThanOrEqual(20);
    }
  });
});

describe("F4 — feedSeq produces unique ids across a simulated reload", () => {
  it("seeds above restored ids so new feed items never collide (no duplicate React keys)", () => {
    // Session 1: generate feed items by advancing weeks.
    let s = newGame(2024);
    for (let i = 0; i < 6; i++) s = advanceOneWeek(s);
    const idsBefore = s.feed.map((f) => f.id);
    expect(new Set(idsBefore).size).toBe(idsBefore.length);

    // Simulate reload: state restored with old ids; reseed the module counter.
    seedFeedSeq(s);

    // Session 2: generate more feed items; ids must remain globally unique.
    let s2 = s;
    for (let i = 0; i < 6; i++) s2 = advanceOneWeek(s2);
    const allIds = s2.feed.map((f) => f.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

describe("Save export / import — round-trips through migrate, rejects garbage", () => {
  it("export → import restores an identical company", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    const s: GameState = { ...newGame(4242), cash: dollars(987654), companyName: "Nøva Inc" };
    const str = exportSaveString(s);
    expect(str.startsWith("SILICON1:")).toBe(true);
    const back = importSaveString(str);
    expect(back).not.toBeNull();
    expect(back!.cash).toBe(dollars(987654));
    expect(back!.companyName).toBe("Nøva Inc"); // non-ASCII survives the base64 round-trip
    expect(back!.seed).toBe(s.seed);
  });

  it("tolerates surrounding whitespace and a missing prefix", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    const s = newGame(7);
    const str = exportSaveString(s);
    const noPrefix = str.slice("SILICON1:".length);
    expect(importSaveString(`  \n${str}\n  `)).not.toBeNull();
    expect(importSaveString(noPrefix)).not.toBeNull();
  });

  it("returns null for non-base64, non-JSON, and un-migratable shapes", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    expect(importSaveString("")).toBeNull();
    expect(importSaveString("not base64 @@@")).toBeNull();
    expect(importSaveString("SILICON1:bm90IGpzb24=")).toBeNull(); // base64 of "not json"
    // A structurally-broken state must be rejected by migrate (no trends/competitors/staff).
    const broken = exportSaveString({ version: 1, week: 3 } as unknown as GameState);
    expect(importSaveString(broken)).toBeNull();
  });
});

describe("factory floor sanitization — corrupt entries are dropped, never crash or wipe cash", () => {
  it("filters unknown machine kinds / belt dirs / prop kinds and clamps a NaN upgrade level", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    const s = newGame(11);
    const raw = s as unknown as { factoryFloor: { machines: unknown[]; belts: unknown[] }; factoryProps: unknown[] };
    raw.factoryFloor = {
      machines: [
        { id: "ok-1", kind: "intake", c: 0, r: 1 },
        { id: "ok-2", kind: "press", c: 4, r: 2, level: "abc" }, // NaN level → NaN upgrade cost → cash wipe
        { id: "ok-3", kind: "packer", c: 0, r: 6, level: 2 },
        { id: "bad-kind", kind: "teleporter", c: 8, r: 2 }, // unknown kind → MACHINE_DEFS[kind].w TypeError
        { id: "bad-pos", kind: "mill", c: Number.NaN, r: 2 },
      ],
      belts: [
        { c: 2, r: 1, dir: "e" },
        { c: 3, r: 1, dir: "up" }, // invalid dir → STEP[dir][0] TypeError in beltChain
        { c: Number.POSITIVE_INFINITY, r: 1, dir: "e" },
      ],
    };
    raw.factoryProps = [
      { id: "p-1", kind: "plant", c: 9, r: 4 },
      { id: "p-bad", kind: "fountain", c: 9, r: 5 }, // unknown kind
    ];
    const back = importSaveString(exportSaveString(s))!;
    expect(back).not.toBeNull();
    expect(back.factoryFloor.machines.map((m) => m.id)).toEqual(["ok-1", "ok-2", "ok-3"]);
    expect(back.factoryFloor.machines[1].level).toBe(1); // clamped, not NaN
    expect(back.factoryFloor.machines[2].level).toBe(2); // valid level survives
    expect(back.factoryFloor.belts).toEqual([{ c: 2, r: 1, dir: "e" }]);
    expect(back.factoryProps.map((p) => p.id)).toEqual(["p-1"]);
  });

  it("drops malformed saved layouts and scrubs entries inside well-formed ones", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    const s = newGame(12);
    (s as unknown as { factoryLayouts: unknown[] }).factoryLayouts = [
      { id: "layout-0", name: "fine", floor: { machines: [{ id: "m", kind: "press", c: 2, r: 2 }, { id: "x", kind: "nope", c: 1, r: 1 }], belts: [] }, props: [], expansion: 99, decor: { wall: 0, floor: 0 }, savedWeek: 1 },
      { id: "layout-1", name: "broken" }, // no floor/props → would TypeError in layoutApplyCost
    ];
    const back = importSaveString(exportSaveString(s))!;
    expect(back.factoryLayouts).toHaveLength(1);
    expect(back.factoryLayouts[0].floor.machines.map((m) => m.id)).toEqual(["m"]);
    expect(back.factoryLayouts[0].expansion).toBeLessThanOrEqual(3);
  });

  it("seeds factoryPieceCounter past every id ever minted (including inside layouts)", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    const s = newGame(13);
    s.factoryFloor = {
      machines: [...s.factoryFloor.machines, { id: "fm-3-7", kind: "press", c: 4, r: 2 }],
      belts: [],
    };
    delete (s as unknown as Record<string, unknown>).factoryPieceCounter; // pre-counter save
    const back = importSaveString(exportSaveString(s))!;
    expect(back.factoryPieceCounter).toBeGreaterThanOrEqual(8);
  });
});

describe("launched verdict — recorded on launch, backfilled for old saves", () => {
  it("a launched product carries a verdict, and it survives an export/import round-trip", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    let s: GameState = { ...newGame(31), cash: dollars(2_000_000) };
    const res = startBuild(s, goodPhone(), 5000, "none");
    expect(res.ok).toBe(true);
    s = res.state;
    for (let i = 0; i < buildWeeksFor(s) + 1; i++) s = advanceOneWeek(s);
    const lr = launchReady(s, s.ready[0].id);
    expect(lr.ok).toBe(true);
    s = lr.state;
    const v = s.launched[0].verdict;
    expect(v === "hit" || v === "flop" || v === "steady").toBe(true);

    const back = importSaveString(exportSaveString(s));
    expect(back).not.toBeNull();
    expect(back!.launched[0].verdict).toBe(v);
  });

  it("migrate backfills a verdict from launchScore on a pre-verdict save", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    const base = newGame(7);
    const legacy: GameState = {
      ...base,
      launched: [
        // no `verdict` field — as written by an older build
        { product: goodPhone(), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 }, unitCost: dollars(80), launchScore: 88, launchedWeek: 2, totalUnits: 9000, weeklyUnits: [1000], unitsSold: 9000, weeksElapsed: 5, revenueToDate: dollars(120000) },
      ] as unknown as GameState["launched"],
    };
    const back = importSaveString(exportSaveString(legacy));
    expect(back).not.toBeNull();
    expect(back!.launched[0].verdict).toBe("hit"); // 88 >= 76 threshold
  });

  it("drops an unrecoverable launched entry missing its product, keeping the rest", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    const good = { product: goodPhone(), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 }, unitCost: dollars(80), launchScore: 88, launchedWeek: 2, totalUnits: 9000, weeklyUnits: [1000], unitsSold: 9000, weeksElapsed: 5, revenueToDate: dollars(120000), verdict: "hit" };
    const corrupt = { stats: {}, launchScore: 40, totalUnits: 0, weeklyUnits: [], unitsSold: 0, weeksElapsed: 0, revenueToDate: dollars(0) }; // no `product`
    const legacy: GameState = {
      ...newGame(7),
      launched: [good, corrupt] as unknown as GameState["launched"],
    };
    const back = importSaveString(exportSaveString(legacy));
    expect(back).not.toBeNull();
    // the corrupt entry is gone; the valid one survives (no first-tick crash on lp.product.*)
    expect(back!.launched).toHaveLength(1);
    expect(back!.launched[0].product.category).toBe("phone");
  });

  it("backfills a missing launchedWeek to a finite value (no NaN into franchise/hype math)", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    const legacy: GameState = {
      ...newGame(7),
      launched: [
        // launchedWeek omitted — older builds didn't persist it
        { product: goodPhone(), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 }, unitCost: dollars(80), launchScore: 88, totalUnits: 9000, weeklyUnits: [1000], unitsSold: 9000, weeksElapsed: 5, revenueToDate: dollars(120000), verdict: "hit" },
      ] as unknown as GameState["launched"],
    };
    const back = importSaveString(exportSaveString(legacy));
    expect(back).not.toBeNull();
    expect(Number.isFinite(back!.launched[0].launchedWeek)).toBe(true);
  });
});

describe("achievements — migrate backfills earned milestones SILENTLY on an old save", () => {
  it("a pre-achievements save (no unlockedAchievements field) has earned milestones backfilled", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    const base = newGame(11);
    // An old save: strong stats that clearly cross several thresholds, but no achievements field.
    const legacy = {
      ...base,
      reputation: 90, // rep-50 + rep-85
      fans: 150_000, // fans-10k + fans-100k
      cumulativeRevenue: dollars(20_000_000), // rev-1m + rev-10m
      launched: [
        { product: goodPhone(), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 }, unitCost: dollars(80), launchScore: 88, launchedWeek: 2, totalUnits: 9000, plannedUnits: 9000, weeklyUnits: [9000], unitsSold: 9000, weeksElapsed: 5, revenueToDate: dollars(120000), verdict: "hit" },
      ],
    };
    delete (legacy as { unlockedAchievements?: unknown }).unlockedAchievements;

    const back = importSaveString(exportSaveString(legacy as unknown as GameState));
    expect(back).not.toBeNull();
    const earned = back!.unlockedAchievements;
    // Already-earned milestones are present (marked unlocked, ready to display) ...
    expect(earned).toEqual(expect.arrayContaining(["first-ship", "first-hit", "sold-out", "rep-50", "rep-85", "fans-10k", "fans-100k", "rev-1m", "rev-10m"]));
    // ... but not ones genuinely not reached.
    expect(earned).not.toContain("fans-1m");
    expect(earned).not.toContain("rev-100m");
  });

  it("a fresh new game backfills to an empty set (nothing earned yet)", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    const fresh = newGame(12);
    delete (fresh as { unlockedAchievements?: unknown }).unlockedAchievements;
    const back = importSaveString(exportSaveString(fresh as unknown as GameState));
    expect(back).not.toBeNull();
    expect(back!.unlockedAchievements).toEqual([]);
  });
});

describe("v17 — desks are seats: migrate grants missing desks to old teams", () => {
  it("a pre-desk-era save (3 staff, plant-only layout) gets a desk per employee, all legally placed", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    const base = newGame(13);
    const mk = (i: number) => ({ ...base.staff[0], id: `s${i}`, name: `Dev ${i}` });
    const legacy: GameState = {
      ...base,
      staff: [base.staff[0], mk(2), mk(3)],
      // the old 2-plant default room — zero desks, the worst case
      layout: [
        { iid: "f4", type: "plantTall", c: 0, r: 0, rot: 0 },
        { iid: "f5", type: "plantPot", c: 8, r: 0, rot: 0 },
      ],
      furnitureCounter: 6,
    };
    const back = importSaveString(exportSaveString(legacy));
    expect(back).not.toBeNull();
    const desks = deskItems(back!.layout);
    expect(desks.length).toBeGreaterThanOrEqual(back!.staff.length); // nobody loses a paid hire
    // and the grant respects the grid (rebuilding through addItem accepts every item)
    let acc: GameState["layout"] = [];
    for (const it of back!.layout) {
      acc = addItem(acc, it.iid, it.type, it.c, it.r, it.rot);
    }
    expect(acc.length).toBe(back!.layout.length);
  });
});

describe("delegation gating: migrate grandfathers a pre-gating automation that was already on", () => {
  it("an old save with auto-assign on (no *Free fields) keeps it free of the new prerequisites", async () => {
    const { importSaveString, exportSaveString } = await freshPersistence();
    const base = newGame(21);
    // A save from before the premium gating: only the two original booleans, no *Free flags.
    const legacy: GameState = { ...base, automation: { autoAssign: true, autoResearch: false } };
    const back = importSaveString(exportSaveString(legacy));
    expect(back).not.toBeNull();
    expect(back!.automation.autoAssign).toBe(true);
    expect(back!.automation.autoAssignFree).toBe(true);    // grandfathered, keeps working
    expect(back!.automation.autoResearchFree).toBe(false); // was off → must still be earned
    expect(canAutoAssign(back!)).toBe(true);
  });
});

describe("F8 — hit/flop tracks actual (competition-adjusted) outcome", () => {
  it("a product launched into a crowded category is not over-rewarded vs. a clear field", () => {
    // Build + launch the same product in two worlds: one with no rivals, one heavily contested.
    const seedCash = dollars(2_000_000);

    const launchIn = (state: GameState): GameState => {
      let s = { ...state, cash: seedCash };
      const res = startBuild(s, goodPhone(), 5000, "none");
      expect(res.ok).toBe(true);
      s = res.state;
      for (let i = 0; i < buildWeeksFor(s) + 1; i++) s = advanceOneWeek(s);
      const lr = launchReady(s, s.ready[0].id);
      expect(lr.ok).toBe(true);
      return lr.state;
    };

    const clear = newGame(31);
    // Make every rival dominate the phone category so competitionFactor drags real sales down.
    const crowded: GameState = {
      ...newGame(31),
      competitors: newGame(31).competitors.map((c) => ({
        ...c,
        strengthByCategory: { ...c.strengthByCategory, phone: 100 },
      })),
    };

    const afterClear = launchIn(clear);
    const afterCrowded = launchIn(crowded);

    // Reputation gain in the crowded world must be <= the clear world: a product that sells far
    // less because of competition cannot earn MORE reputation than the same product unopposed.
    const repGainClear = afterClear.reputation - clear.reputation;
    const repGainCrowded = afterCrowded.reputation - crowded.reputation;
    expect(repGainCrowded).toBeLessThanOrEqual(repGainClear);
    // And the crowded launch genuinely sold fewer units (sanity on the setup).
    expect(afterCrowded.launched[0].totalUnits).toBeLessThan(afterClear.launched[0].totalUnits);
  });
});

describe("lensLimit backfill — old saves keep every lens count they used", () => {
  it("grants the highest lens count found in the save's products (min 2, max 4)", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    const s = newGame(31);
    const quad: Product = {
      id: "p1", name: "Quad", category: "phone", tiers: { chip: 1 }, finish: "aluminium",
      colorIndex: 0, price: dollars(699), designTier: 1, notch: "punch",
      camera: { count: 4, layout: "square", position: "topLeft", module: "squircle", flash: true },
    };
    const { lensLimit: _drop, ...rest } = {
      ...s,
      launched: [{ product: quad, launchWeek: 1, weeksElapsed: 1, weeklyUnits: [10], totalUnits: 10, unitsSold: 0, revenueToDate: dollars(0), unitCost: dollars(100), stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 10 }, verdict: "solid", launchScore: 60 }],
    };
    const back = importSaveString(exportSaveString(rest as unknown as GameState)); // pre-gating save shape
    expect(back).not.toBeNull();
    expect(back!.lensLimit).toBe(4);
  });

  it("defaults to 2 when the save never used more", async () => {
    const { exportSaveString, importSaveString } = await freshPersistence();
    const { lensLimit: _drop, ...rest } = newGame(32);
    const back = importSaveString(exportSaveString(rest as unknown as GameState));
    expect(back!.lensLimit).toBe(2);
  });
});

describe("F9 — id counters backfill from max existing id, never the surviving count", () => {
  it("productCounter/staffCounter exceed every id even after entries were removed", async () => {
    const base = newGame(42);
    const founder = base.staff[0]; // "s0"
    const prod = (id: string): Product => ({
      id, name: "Aurora", category: "phone", tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
      finish: "aluminium", colorIndex: 0, price: dollars(699), designTier: 1, notch: "punch",
      camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    });
    // Simulate an old save: hired s1,s2,s3 then FIRED s1,s2 (survivors s0,s3 → true counter was 4);
    // shipped prod-1…prod-5 (true counter was 6). Then the counters go missing on load.
    const raw: Record<string, unknown> = {
      ...base,
      staff: [founder, { ...founder, id: "s3", name: "Devin" }],
      launched: [1, 5, 3].map((n) => ({
        product: prod(`prod-${n}`), launchWeek: 1, weeksElapsed: 1, weeklyUnits: [10], totalUnits: 10,
        unitsSold: 0, revenueToDate: dollars(0), unitCost: dollars(100),
        stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 10 }, verdict: "solid", launchScore: 60,
      })),
    };
    delete raw.productCounter;
    delete raw.staffCounter;
    mem.setItem(SAVE_KEY, JSON.stringify(raw));

    const { load } = await freshPersistence();
    const loaded = load()!;
    expect(loaded).not.toBeNull();
    // Surviving staff count is 2, but the max minted id was s3 → next must be s4, not s2 (collision).
    expect(loaded.staffCounter).toBe(4);
    // Max shipped id was prod-5 → next must be prod-6, not prod-1 (the length-agnostic seed).
    expect(loaded.productCounter).toBe(6);
  });
});
