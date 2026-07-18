// Design Budget (feature #1) — integration coverage. Mirrors the mastery integration harness:
//  (a) a budget-ON run that never builds == a budget-OFF run (the opt-in flag alone is a no-op);
//  (b) an old save (flag absent) with launches replays byte-identical (feature present, flag off);
//  (c) a fresh run: an over-budget build is rejected, an at-budget build proceeds, and a run of
//      budget-fitting builds replays deterministically twice.
import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import type { CategoryId, Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  buildWeeksFor,
  designBudget,
  startBuild,
  launchReady,
  newGame,
  type GameState,
} from "./gameState.ts";

function mkProduct(category: CategoryId, id: string, tier = 1): Product {
  return {
    id,
    name: `Dev ${id}`,
    category,
    tiers: { chip: tier, display: tier, battery: tier, materials: tier, software: tier, camera: tier },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(140),
    designTier: 1,
    camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

// feed ids embed a module-level counter that climbs across in-process runs; compare everything else.
function norm(s: GameState) {
  return { ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) };
}

function ship(s: GameState, product: Product): GameState {
  const before = new Set(s.ready.map((p) => p.id));
  const b = startBuild(s, product, 400, "none");
  expect(b.ok).toBe(true);
  let cur = b.state;
  const weeks = buildWeeksFor(cur, product) + 1;
  for (let i = 0; i < weeks; i++) cur = advanceOneWeek(cur);
  const ready = cur.ready.find((p) => !before.has(p.id));
  expect(ready).toBeTruthy();
  const r = launchReady(cur, ready!.id);
  expect(r.ok).toBe(true);
  return r.state;
}

describe("design budget integration — determinism", () => {
  it("(a) a budget-ON run with NO builds equals a budget-OFF run (no-op flag)", () => {
    const on = { ...newGame(4242), cash: dollars(5_000_000), designBudgetEnabled: true };
    const off = { ...newGame(4242), cash: dollars(5_000_000), designBudgetEnabled: false };
    const run = (s0: GameState) => {
      let s = s0;
      for (let w = 0; w < 80; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run(on);
    const b = run(off);
    expect(a.rngState).toBe(b.rngState);
    expect(toDollars(a.cash)).toBe(toDollars(b.cash));
    expect(a.researchPoints).toBe(b.researchPoints);
    expect(a.reputation).toBe(b.reputation);
  });

  it("(b) an old save (designBudgetEnabled absent) with launches replays byte-identical", () => {
    const start: GameState = { ...newGame(555), cash: dollars(20_000_000) };
    delete (start as { designBudgetEnabled?: boolean }).designBudgetEnabled; // pre-feature save
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      let s = s0;
      // Deliberately a rich, over-what-a-budget-would-allow phone (all T4 = 24 EP): with the flag OFF
      // it builds fine, exactly as an old save must.
      s = ship(s, mkProduct("phone", "p1", 4));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      s = ship(s, mkProduct("phone", "p2", 4));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a)).toEqual(norm(b));
    expect(a.launched.length).toBe(2);
    expect(a.designBudgetEnabled).toBeUndefined(); // stayed off
  });

  it("(c) a fresh run: over-budget rejected, at-budget proceeds, replays deterministically twice", () => {
    const start: GameState = { ...newGame(9001), cash: dollars(20_000_000), designBudgetEnabled: true };
    // Era-1 budget is 8 EP. An all-T4 phone (24 EP) is over budget → rejected at the commit action.
    const over = startBuild(start, mkProduct("phone", "x", 4), 400, "none");
    expect(over.ok).toBe(false);
    expect(over.reason).toMatch(/design budget/i);
    expect(over.state).toBe(start); // rejection leaves state untouched
    // An all-T1 phone (6 EP ≤ 8) is at/under budget → it builds.
    const ok = startBuild(start, mkProduct("phone", "y", 1), 400, "none");
    expect(ok.ok).toBe(true);

    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      let s = s0;
      s = ship(s, mkProduct("phone", "p1", 1));
      for (let w = 0; w < 5; w++) s = advanceOneWeek(s);
      s = ship(s, mkProduct("phone", "p2", 1));
      for (let w = 0; w < 5; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a)).toEqual(norm(b));
    expect(a.launched.length).toBe(2);
  });
});

describe("design budget integration — the selector grows with era + research", () => {
  it("designBudget rises with era and with a completed raise project", () => {
    const e1: GameState = { ...newGame(1), era: 1 };
    const e3: GameState = { ...newGame(1), era: 3 };
    expect(designBudget(e3)).toBeGreaterThan(designBudget(e1));

    const raised: GameState = { ...e1, completedProjects: ["prototypeBench", "componentStandards"] };
    expect(designBudget(raised)).toBe(designBudget(e1) + 4);
  });

  it("a raise lets a fresh run build something it previously couldn't", () => {
    const base: GameState = { ...newGame(2), cash: dollars(20_000_000), designBudgetEnabled: true };
    // 9-EP phone (chip4 + 5×T1 = 4 + 5) is over the era-1 base of 8 …
    const build = { ...mkProduct("phone", "z", 1), tiers: { chip: 4, display: 1, battery: 1, materials: 1, software: 1, camera: 1 } };
    expect(startBuild(base, build, 400, "none").ok).toBe(false);
    // … but completing prototypeBench (+2 → 10) makes it fit.
    const raised: GameState = { ...base, completedProjects: ["prototypeBench"] };
    expect(startBuild(raised, build, 400, "none").ok).toBe(true);
  });
});
