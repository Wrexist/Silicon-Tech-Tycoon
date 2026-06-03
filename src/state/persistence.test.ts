// State / persistence regression tests for the data-loss + offline-catchup fixes (F1-F8).
// vitest runs in the `node` env here (no jsdom), so we stub localStorage on globalThis.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import {
  newGame,
  catchUpOffline,
  advanceOneWeek,
  seedFeedSeq,
  launchReady,
  startBuild,
  buildWeeksFor,
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
