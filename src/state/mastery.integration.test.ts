import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import type { CategoryId, LaunchedProduct, Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  buildWeeksFor,
  startBuild,
  launchReady,
  newGame,
  toolingCost,
  effectiveUnitCost,
  productStats,
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

/** 5 hit launches in a category → level 5 (15 pts). Only the fields mastery reads are set. */
function masteredLaunched(category: CategoryId): LaunchedProduct[] {
  return Array.from({ length: 5 }, (_, i) =>
    ({ product: { category, id: `${category}-${i}` }, verdict: "hit" }) as unknown as LaunchedProduct,
  );
}

// Normalise a state for byte-equality comparison: feed ids embed a module-level counter that keeps
// climbing across in-process runs (same trick the 160-week pin uses), so compare everything else.
function norm(s: GameState) {
  return { ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) };
}

/** Build a product, advance until it's ready, then launch it — returns the post-launch state.
 *  startBuild reassigns the product id (prod-N), so the newly-ready product is found by set-diff. */
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

describe("mastery integration — determinism", () => {
  it("(a) a masteryEnabled run with NO launches equals a mastery-off run (zero-mastery no-op)", () => {
    // No launches → no mastery → every seam must be a byte-exact no-op, so the opt-in flag alone
    // changes nothing about a do-nothing run.
    const on = { ...newGame(4242), cash: dollars(5_000_000), masteryEnabled: true };
    const off = { ...newGame(4242), cash: dollars(5_000_000), masteryEnabled: false };
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
    expect(a.fans).toBe(b.fans);
    expect(a.reputation).toBe(b.reputation);
  });

  it("(b) an old save (masteryEnabled absent) with launches replays byte-identical", () => {
    // The feature code is present, but with the flag absent (old save) the launches accrue NO mastery
    // bonus — and the run must be perfectly reproducible from the same start.
    const start: GameState = { ...newGame(555), cash: dollars(20_000_000) };
    delete (start as { masteryEnabled?: boolean }).masteryEnabled; // simulate a pre-feature save
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      let s = s0;
      s = ship(s, mkProduct("phone", "p1"));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      s = ship(s, mkProduct("phone", "p2"));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a)).toEqual(norm(b));
    expect(a.launched.length).toBe(2);
    expect(a.masteryEnabled).toBeUndefined(); // stayed off
    // An absent flag must behave EXACTLY like an explicit masteryEnabled: false — otherwise the feature
    // would be leaking into old saves. Compare the whole state minus the flag field itself.
    const off = script({ ...structuredClone(start), masteryEnabled: false });
    const stripFlag = (s: GameState) => { const n = norm(s) as Record<string, unknown>; delete n.masteryEnabled; return n; };
    expect(stripFlag(a)).toEqual(stripFlag(off));
  });

  it("(c) a fresh run (masteryEnabled) with launches replays deterministically twice", () => {
    const start: GameState = { ...newGame(9001), cash: dollars(20_000_000), masteryEnabled: true };
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      let s = s0;
      s = ship(s, mkProduct("phone", "p1"));
      for (let w = 0; w < 5; w++) s = advanceOneWeek(s);
      s = ship(s, mkProduct("phone", "p2"));
      for (let w = 0; w < 5; w++) s = advanceOneWeek(s);
      s = ship(s, mkProduct("phone", "p3"));
      for (let w = 0; w < 5; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a)).toEqual(norm(b));
    expect(a.launched.length).toBe(3);
  });
});

describe("mastery integration — the bonus is gated + category-scoped", () => {
  it("a mastered category builds cheaper, an unmastered one is unchanged", () => {
    const on: GameState = { ...newGame(1), masteryEnabled: true, launched: masteredLaunched("phone") };
    const off: GameState = { ...on, masteryEnabled: false };

    // High-tier build so tooling clears the minimum-tooling floor (a tier-1 build floors out, hiding
    // the discount). The cost functions are pure over the product, so no research gating applies here.
    const phone = mkProduct("phone", "z", 5);
    const tablet = mkProduct("tablet", "y", 5);

    // Phone is mastered (level 5) → tooling + per-unit cost are strictly cheaper with the flag ON.
    expect(toDollars(toolingCost(on, phone))).toBeLessThan(toDollars(toolingCost(off, phone)));
    expect(toDollars(effectiveUnitCost(on, phone))).toBeLessThan(toDollars(effectiveUnitCost(off, phone)));

    // Tablet has NO mastery → identical whether the flag is on or off (scoping proof).
    expect(toDollars(toolingCost(on, tablet))).toBe(toDollars(toolingCost(off, tablet)));
    expect(toDollars(effectiveUnitCost(on, tablet))).toBe(toDollars(effectiveUnitCost(off, tablet)));
  });

  it("a mastered category gains design appeal, an unmastered one does not", () => {
    const on: GameState = { ...newGame(2), masteryEnabled: true, launched: masteredLaunched("phone") };
    const off: GameState = { ...on, masteryEnabled: false };
    const phone = mkProduct("phone", "z");
    const tablet = mkProduct("tablet", "y");
    // +2 design at L5 for the mastered category (unless already clamped at statMax — tier-1 build is well below).
    expect(productStats(on, phone).design).toBeGreaterThan(productStats(off, phone).design);
    expect(productStats(on, tablet).design).toBe(productStats(off, tablet).design);
  });

  it("the mastery cost edge is small — well under the perk/legacy ceiling", () => {
    const on: GameState = { ...newGame(3), masteryEnabled: true, launched: masteredLaunched("phone") };
    const off: GameState = { ...on, masteryEnabled: false };
    const phone = mkProduct("phone", "z", 5);
    const onCost = toDollars(effectiveUnitCost(on, phone));
    const offCost = toDollars(effectiveUnitCost(off, phone));
    // ≤ 5% reduction (rounding can nudge it a hair) — never a game-warping discount.
    expect(onCost).toBeGreaterThanOrEqual(Math.floor(offCost * 0.94));
  });
});
