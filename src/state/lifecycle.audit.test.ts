// Release-candidate lifecycle / offline / clock audit.
//
// The single most expensive bug this app could ship is a DOUBLE-ADVANCED week: the sim running
// twice for one unit of wall time (a resume handler catching up on top of a live interval, or a
// catch-up pass that runs once per mount). It burns rent twice, ages every product twice, and
// surfaces to the player as an unexplained bankruptcy. This build's answer is structural — the sim
// advances ONLY from the weekly interval in `useGame.tsx`, and boot/resume advance nothing at all —
// so these tests pin the structure rather than a symptom:
//
//   1. source invariants — exactly one production call site, called with no catch-up arguments,
//      and a tick that is gated on the `hidden` (backgrounded) flag.
//   2. behavioural invariants — loading a save NEVER advances the simulation, whatever the wall
//      clock says (no elapsed time, a tiny gap, a months-long gap, a clock that moved BACKWARD, an
//      absurd future clock, a NaN stamp).
//
// Plus the save/restore rows the existing suites don't cover: a truncated file, non-finite numerics,
// and a negative week.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { newGame, type GameState } from "./gameState.ts";
import { dollars } from "../engine/money.ts";

/* ───────────────────────────── 1. source invariants ───────────────────────────── */

const SRC = new URL("..", import.meta.url).pathname; // repo /src

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("no double-advance — the sim has exactly one driver", () => {
  const files = sourceFiles(SRC);

  it("finds source to scan (guards against a silently empty sweep)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("advanceOneWeek is CALLED from exactly one production file: the weekly tick", () => {
    const callers: string[] = [];
    for (const f of files) {
      // gameState.ts declares it; every other mention there is prose.
      if (f.endsWith("/state/gameState.ts")) continue;
      const src = readFileSync(f, "utf8");
      const hits = src.match(/advanceOneWeek\(/g);
      if (hits) callers.push(`${f.slice(SRC.length)} ×${hits.length}`);
    }
    // A second entry here means a second clock: a resume handler, a catch-up loop, a debug button.
    expect(callers).toEqual(["state/useGame.tsx ×1"]);
  });

  it("the one call site passes no catch-up arguments (no rate, no offline flag)", () => {
    const src = readFileSync(join(SRC, "state/useGame.tsx"), "utf8");
    // `advanceOneWeek(state, rate, offline)` — a second argument is how offline catch-up used to
    // weight a partial week. The live call must be the plain one-week form.
    expect(src).toMatch(/advanceOneWeek\(s\)/);
    expect(src.match(/advanceOneWeek\([^)]*,/)).toBeNull();
  });

  it("the tick is gated on the backgrounded flag, so a hidden app cannot keep ticking", () => {
    const src = readFileSync(join(SRC, "state/useGame.tsx"), "utf8");
    // The guard clause that returns before setInterval, and the dep array that re-arms it.
    expect(src).toMatch(/if \([^)]*\bhidden\b[^)]*\) return;/);
    expect(src).toMatch(/document\.addEventListener\("visibilitychange"/);
  });

  it("nothing on the boot/resume path derives weeks from the wall clock", () => {
    const src = readFileSync(join(SRC, "state/useGame.tsx"), "utf8");
    // `lastActive` is a "last saved at" stamp only. Any arithmetic on it (a diff, a division into
    // weeks) is the shape offline catch-up had — and the shape a clock jump could weaponise.
    expect(src.match(/lastActive\s*[-+*/]/)).toBeNull();
    // (`/` is excluded on the left — it would match the `//` of a comment mentioning the field.)
    expect(src.match(/[-+*]\s*\w*\.?lastActive/)).toBeNull();
    // Every write of it is a fresh stamp, never a computed value.
    for (const m of src.match(/lastActive: [^,}]+/g) ?? []) {
      expect(m.trim()).toBe("lastActive: Date.now()");
    }
  });

  it("the save is written on background AND on page-hide, so an OS kill cannot lose the week", () => {
    const src = readFileSync(join(SRC, "state/useGame.tsx"), "utf8");
    // iOS terminates backgrounded apps without warning; WKWebView fires visibilitychange first.
    expect(src).toMatch(/visibilityState === "hidden"[\s\S]{0,120}persistNow\(\)/);
    expect(src).toMatch(/window\.addEventListener\("pagehide", persistNow\)/);
  });
});

/* ───────────────────────────── 2. the clock cannot move the sim ───────────────────────────── */

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

let mem: MemStorage;

beforeEach(() => {
  mem = new MemStorage();
  // @ts-expect-error installing a stub for the node test env
  globalThis.localStorage = mem;
  vi.resetModules();
});

async function persistence() {
  return await import("./persistence.ts");
}

/** A mid-run company, deliberately unremarkable, so any drift is obvious. */
function played(): GameState {
  return { ...newGame(4242), week: 61, cash: dollars(750_000), fans: 40_000, cumulativeRevenue: dollars(3_000_000) };
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("offline matrix — elapsed wall time never advances the simulation", () => {
  const gaps: Array<[string, number]> = [
    ["no elapsed time at all", 0],
    ["a tiny gap (5 seconds)", 5_000],
    ["a normal session gap (6 hours)", 6 * HOUR],
    ["a long gap (30 days)", 30 * DAY],
    ["an absurd gap (10 years)", 3650 * DAY],
    ["a clock that moved BACKWARD a day", -DAY],
    ["a clock that moved BACKWARD a decade", -3650 * DAY],
    ["an absurd FUTURE stamp (year 10000)", 253_402_300_800_000 - Date.now()],
  ];

  for (const [label, delta] of gaps) {
    it(`loads byte-identical after ${label}`, async () => {
      const { save, loadResult } = await persistence();
      const before = played();
      save({ ...before, lastActive: Date.now() + delta });

      const r = loadResult();
      expect(r.status).toBe("ok");
      if (r.status !== "ok") return;
      // The company the player left is the company they come back to — no fast-forwarded weeks,
      // no back-dated ones, and nothing derived from the gap.
      expect(r.state.week).toBe(61);
      expect(r.state.cash).toBe(dollars(750_000));
      expect(r.state.fans).toBe(40_000);
      expect(r.state.cumulativeRevenue).toBe(dollars(3_000_000));
      expect(Number.isFinite(r.state.week)).toBe(true);
      expect(r.state.week).toBeGreaterThanOrEqual(0);
    });
  }

  it("a non-finite lastActive is re-stamped, and still moves nothing", async () => {
    const { save, loadResult } = await persistence();
    // NaN/Infinity don't survive JSON, so write the raw shape a hand-edited file would have.
    const raw = JSON.parse(JSON.stringify({ ...played(), lastActive: 0 })) as Record<string, unknown>;
    raw.lastActive = null; // what JSON.stringify(NaN) produces
    mem.setItem(SAVE_KEY, JSON.stringify(raw));

    const r = loadResult();
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(Number.isFinite(r.state.lastActive)).toBe(true);
    expect(r.state.week).toBe(61);
    void save;
  });

  it("loading twice in a row is idempotent — a re-mount cannot compound anything", async () => {
    const { save, loadResult } = await persistence();
    save({ ...played(), lastActive: Date.now() - 90 * DAY });
    const a = loadResult();
    const b = loadResult();
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    if (a.status !== "ok" || b.status !== "ok") return;
    expect(b.state.week).toBe(a.state.week);
    expect(b.state.cash).toBe(a.state.cash);
  });
});

/* ───────────────────────────── 3. save/restore rows not covered elsewhere ───────────────────────────── */

describe("save/restore — corruption rows", () => {
  it("a TRUNCATED save is unreadable, and its bytes are preserved before anything overwrites them", async () => {
    const { loadResult, save } = await persistence();
    const full = JSON.stringify(played());
    const cut = full.slice(0, Math.floor(full.length * 0.6)); // storage write interrupted mid-flight
    mem.setItem(SAVE_KEY, cut);

    expect(loadResult().status).toBe("unreadable");
    expect(mem.getItem(BACKUP_KEY)).toBe(cut); // recoverable, not destroyed
    save(newGame(1)); // the fresh game the caller starts must not eat the backup
    expect(mem.getItem(BACKUP_KEY)).toBe(cut);
  });

  it("empty and whitespace-only save files are unreadable rather than crashing the boot", async () => {
    for (const junk of ["", "   ", "{", "null", "[]", " "]) {
      mem = new MemStorage();
      // @ts-expect-error test stub
      globalThis.localStorage = mem;
      vi.resetModules();
      const { loadResult } = await persistence();
      mem.setItem(SAVE_KEY, junk);
      expect(loadResult().status, `junk: ${JSON.stringify(junk)}`).toBe("unreadable");
    }
  });

  it("non-finite numerics land finite (NaN/Infinity survive JSON as null)", async () => {
    const { loadResult } = await persistence();
    const raw = JSON.parse(JSON.stringify(played())) as Record<string, unknown>;
    for (const k of ["cash", "fans", "reputation", "cumulativeRevenue", "week", "era", "seed", "rngState", "researchPoints", "facilityTier"]) {
      raw[k] = null;
    }
    mem.setItem(SAVE_KEY, JSON.stringify(raw));

    const r = loadResult();
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    for (const [k, v] of Object.entries(r.state)) {
      if (typeof v === "number") expect(Number.isFinite(v), `${k} is ${v}`).toBe(true);
    }
    expect(r.state.era).toBeGreaterThanOrEqual(1);
    expect(r.state.reputation).toBeGreaterThan(0); // the era floor, never a zero-demand dead end
  });

  it("a NEGATIVE week is clamped — the calendar can never run backwards", async () => {
    const { loadResult } = await persistence();
    mem.setItem(SAVE_KEY, JSON.stringify({ ...played(), week: -40 }));
    const r = loadResult();
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.state.week).toBe(0);
  });

  it("an absent save is 'absent' — the one status that lets a fresh game overwrite the slot", async () => {
    const { loadResult } = await persistence();
    expect(loadResult().status).toBe("absent");
    expect(mem.has(BACKUP_KEY)).toBe(false);
  });

  it("a save missing every optional field still loads and stays finite", async () => {
    const { loadResult } = await persistence();
    const base = played() as unknown as Record<string, unknown>;
    // Keep only what migrate treats as load-bearing; drop the rest as an ancient build would have.
    const ancient: Record<string, unknown> = {
      version: base.version,
      week: 12,
      cash: base.cash,
      trends: base.trends,
      competitors: base.competitors,
      staff: base.staff,
    };
    mem.setItem(SAVE_KEY, JSON.stringify(ancient));
    const r = loadResult();
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.state.week).toBe(12);
    expect(Array.isArray(r.state.launched)).toBe(true);
    expect(Array.isArray(r.state.feed)).toBe(true);
    expect(Number.isFinite(r.state.seed)).toBe(true);
  });
});
