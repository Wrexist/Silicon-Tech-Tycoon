import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import type { CategoryId, LaunchedProduct, Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  buildWeeksFor,
  startBuild,
  launchReady,
  newGame,
  planProduction,
  productStats,
  type GameState,
} from "./gameState.ts";

function mkProduct(category: CategoryId, id: string, name: string, tier = 1): Product {
  return {
    id,
    name,
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

/** A qualified line: N hit entries sharing one stem, in one category — 5 hits → Iconic (equity clamps
 *  to 1). Only the fields the franchise-mastery + planProduction seams read are set. */
function qualifiedLine(stem: string, category: CategoryId, n = 5): LaunchedProduct[] {
  return Array.from({ length: n }, (_, i) => ({
    product: {
      id: `${stem}-${i}`,
      name: `${stem} ${i + 1}`,
      category,
      tiers: { chip: 3, display: 3, battery: 3, materials: 3, software: 3, camera: 3 },
      price: dollars(140),
    },
    verdict: "hit",
    unitsSold: 0,
    totalUnits: 0,
    revenueToDate: dollars(0),
    launchedWeek: 0,
    weeklyUnits: [],
    weeksElapsed: 0,
  }) as unknown as LaunchedProduct);
}

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

describe("franchise-mastery integration — determinism", () => {
  it("(a) a franchiseMasteryEnabled run with NO launches equals a franchise-off run (no-op)", () => {
    const on = { ...newGame(4242), cash: dollars(5_000_000), franchiseMasteryEnabled: true };
    const off = { ...newGame(4242), cash: dollars(5_000_000), franchiseMasteryEnabled: false };
    const run = (s0: GameState) => {
      let s = s0;
      for (let w = 0; w < 80; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run(on);
    const b = run(off);
    expect(a.rngState).toBe(b.rngState);
    expect(toDollars(a.cash)).toBe(toDollars(b.cash));
    expect(a.fans).toBe(b.fans);
    expect(a.reputation).toBe(b.reputation);
  });

  it("(b) an old save (franchiseMasteryEnabled absent) with a franchise line replays byte-identical", () => {
    const start: GameState = { ...newGame(555), cash: dollars(20_000_000) };
    delete (start as { franchiseMasteryEnabled?: boolean }).franchiseMasteryEnabled;
    delete (start as { masteryEnabled?: boolean }).masteryEnabled; // pre-feature save has neither
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      let s = s0;
      s = ship(s, mkProduct("phone", "p1", "Nova 1"));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      s = ship(s, mkProduct("phone", "p2", "Nova 2"));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a)).toEqual(norm(b));
    expect(a.launched.length).toBe(2);
    expect(a.franchiseMasteryEnabled).toBeUndefined(); // stayed off
    // An absent flag must behave EXACTLY like explicit false — the feature must never leak into old saves.
    const off = script({ ...structuredClone(start), franchiseMasteryEnabled: false });
    const stripFlag = (s: GameState) => {
      const n = norm(s) as Record<string, unknown>;
      delete n.franchiseMasteryEnabled;
      return n;
    };
    expect(stripFlag(a)).toEqual(stripFlag(off));
  });

  it("(c) a fresh run building a deep line replays deterministically twice, with the boon in-path", () => {
    const start: GameState = { ...newGame(9001), cash: dollars(40_000_000), franchiseMasteryEnabled: true };
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      let s = s0;
      for (let i = 1; i <= 6; i++) {
        s = ship(s, mkProduct("phone", `p${i}`, `Nova ${i}`, 1));
        for (let w = 0; w < 4; w++) s = advanceOneWeek(s);
      }
      return s;
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a)).toEqual(norm(b));
    expect(a.launched.length).toBe(6);
  });
});

describe("franchise-mastery integration — the boon is gated, line-scoped + applied to the next entry", () => {
  it("Signature Craft (+design) lifts a qualified line's next entry, scoped to that line", () => {
    // desktop → Signature Craft. A qualified "Titan" desktop line's next entry gains +1 design.
    const on: GameState = { ...newGame(1), franchiseMasteryEnabled: true, launched: qualifiedLine("Titan", "desktop") };
    const off: GameState = { ...on, franchiseMasteryEnabled: false };
    const nextEntry = mkProduct("desktop", "z", "Titan 6");
    const otherLine = mkProduct("desktop", "y", "Zephyr 1"); // different stem, no history
    const firstInLine = mkProduct("desktop", "w", "Titan 6"); // same as nextEntry but proves scoping via stem

    expect(productStats(on, nextEntry).design).toBeGreaterThan(productStats(off, nextEntry).design);
    // A brand-new line (no qualified history) is unchanged whether the flag is on or off.
    expect(productStats(on, otherLine).design).toBe(productStats(off, otherLine).design);
    // Exactly +1 design (never more) — at/below the mandate design-ceiling grant.
    expect(productStats(on, firstInLine).design - productStats(off, firstInLine).design).toBe(1);
  });

  it("Heritage Halo (+hype) lifts a qualified phone line's next launch (more projected sales)", () => {
    // phone → Heritage Halo. Big planned run so projected sales are demand-bound → the hype shows.
    const on: GameState = { ...newGame(2), cash: dollars(50_000_000), franchiseMasteryEnabled: true, launched: qualifiedLine("Nova", "phone") };
    const off: GameState = { ...on, franchiseMasteryEnabled: false };
    const nextEntry = mkProduct("phone", "z", "Nova 6");
    const planOn = planProduction(on, nextEntry, 5_000_000, "none");
    const planOff = planProduction(off, nextEntry, 5_000_000, "none");
    expect(planOn.projectedSales).toBeGreaterThan(planOff.projectedSales);
  });

  it("Trusted Name (+preorder) never reduces a qualified line's pre-orders (monotonic lift)", () => {
    // tablet → Trusted Name. The pre-order lift is bounded and can be capped by the pre-order ceiling,
    // so assert the seam is monotonic on + the earned-boon value is proven in the unit suite.
    const base = { ...newGame(3), cash: dollars(50_000_000), fans: 8000, franchiseMasteryEnabled: true };
    const on: GameState = { ...base, launched: qualifiedLine("Slate", "tablet") };
    const off: GameState = { ...on, franchiseMasteryEnabled: false };
    const nextEntry = mkProduct("tablet", "z", "Slate 6");
    const planOn = planProduction(on, nextEntry, 5_000_000, "none");
    const planOff = planProduction(off, nextEntry, 5_000_000, "none");
    expect(planOn.preOrders).toBeGreaterThanOrEqual(planOff.preOrders);
    expect(planOn.totalDemand).toBeGreaterThanOrEqual(planOff.totalDemand);
  });

  it("a first-in-line launch earns NO boon (no prior entries → no qualification)", () => {
    const on: GameState = { ...newGame(4), franchiseMasteryEnabled: true, launched: qualifiedLine("Nova", "desktop") };
    // A device in a DIFFERENT, empty line gets nothing even with the flag on.
    const fresh = mkProduct("desktop", "z", "Brandnew 1");
    const off: GameState = { ...on, franchiseMasteryEnabled: false };
    expect(productStats(on, fresh).design).toBe(productStats(off, fresh).design);
  });
});
