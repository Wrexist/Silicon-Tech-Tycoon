import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import { BALANCE } from "../engine/balance.ts";
import type { CategoryId, Product } from "../engine/types.ts";
import {
  advanceOneWeek,
  startBuild,
  launchReady,
  announceKeynote,
  keynoteFor,
  keynotesThisYear,
  newGame,
  type GameState,
} from "./gameState.ts";

function mkProduct(category: CategoryId, id: string, tier = 3): Product {
  return {
    id,
    name: `Dev ${id}`,
    category,
    tiers: { chip: tier, display: tier, battery: tier, materials: tier, software: tier, camera: tier },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(400),
    designTier: 2,
    camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
}

// feed ids embed a climbing module-level counter (same trick the 160-week pin uses) — compare the rest.
function norm(s: GameState) {
  return { ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) };
}

/** A well-funded fresh company with the Design-Budget EP cap OFF, so tier-3 builds commit freely and the
 *  keynote mechanic is exercised in isolation (the EP cap is an orthogonal feature with its own tests). */
function fresh(seed: number, cash = 50_000_000): GameState {
  return { ...newGame(seed), cash: dollars(cash), designBudgetEnabled: false };
}

/** Start a build and return { state, id } — the id startBuild assigned (prod-N). */
function begin(s: GameState, product: Product): { state: GameState; id: string } {
  const before = new Set(s.building.map((j) => j.product.id));
  const b = startBuild(s, product, 400, "none");
  expect(b.ok).toBe(true);
  const job = b.state.building.find((j) => !before.has(j.product.id))!;
  return { state: b.state, id: job.product.id };
}

/** Advance until the build id is on the `ready` shelf, then return the state (does NOT launch). */
function advanceUntilReady(s: GameState, id: string, cap = 20): GameState {
  let cur = s;
  for (let i = 0; i < cap && !cur.ready.some((p) => p.id === id); i++) cur = advanceOneWeek(cur);
  expect(cur.ready.some((p) => p.id === id)).toBe(true);
  return cur;
}

describe("keynote integration — determinism", () => {
  it("(a) a build run that never announces is byte-identical with the field present vs absent (do-nothing no-op)", () => {
    const withField: GameState = fresh(4242);
    const oldSave = structuredClone(withField);
    delete (oldSave as { pendingKeynote?: unknown }).pendingKeynote;
    delete (oldSave as { keynoteAnnounceWeeks?: unknown }).keynoteAnnounceWeeks;

    const script = (s0: GameState) => {
      let s = s0;
      const { state, id } = begin(s, mkProduct("phone", "p1"));
      s = advanceUntilReady(state, id);
      const r = launchReady(s, id);
      expect(r.ok).toBe(true);
      s = r.state;
      for (let w = 0; w < 8; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(withField);
    const b = script(oldSave);
    // Ignore only the two backfilled keys themselves; everything the sim produced must match.
    const strip = (s: GameState) => {
      const n = norm(s) as Partial<GameState>;
      delete n.pendingKeynote;
      delete n.keynoteAnnounceWeeks;
      return n;
    };
    expect(strip(a)).toEqual(strip(b));
    expect(a.launched.length).toBe(1);
  });

  it("(b) announce → ship in window: replays byte-identical twice AND the launch gets the hype bonus", () => {
    const start: GameState = fresh(9001);
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      const { state, id } = begin(s0, mkProduct("phone", "kept"));
      const announced = announceKeynote(state, id);
      expect(keynoteFor(announced, id)).toBeTruthy();
      const ready = advanceUntilReady(announced, id); // finishes inside the window
      const r = launchReady(ready, id);
      expect(r.ok).toBe(true);
      return { state: r.state, launchScore: r.launchScore!, deadline: keynoteFor(announced, id)!.deadlineWeek, readyWeek: ready.week };
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a.state)).toEqual(norm(b.state));
    expect(a.readyWeek).toBeLessThanOrEqual(a.deadline); // shipped inside the promise window
    expect(a.state.pendingKeynote).toEqual([]); // consumed at launch

    // Baseline: the SAME build + ship with no keynote → strictly lower recorded launch score.
    const base = (() => {
      const { state, id } = begin(start, mkProduct("phone", "kept"));
      const ready = advanceUntilReady(state, id);
      return launchReady(ready, id).launchScore!;
    })();
    expect(a.launchScore).toBeGreaterThan(base);
    // The bonus is bounded (kept ≤ maxHype), so it never more than ~15% above the baseline.
    expect(a.launchScore).toBeLessThanOrEqual(base * (1 + BALANCE.keynote.maxHype) + 1e-6);
  });

  it("(c) announce → let the window pass: the rep sting lands ONCE, replays identical, launch is penalised", () => {
    const start: GameState = fresh(2024);
    const clone = structuredClone(start);
    const script = (s0: GameState) => {
      const { state, id } = begin(s0, mkProduct("phone", "slip"));
      const announced = announceKeynote(state, id);
      const deadline = keynoteFor(announced, id)!.deadlineWeek;
      // Advance WELL past the deadline without ever launching (product just sits on the ready shelf).
      let s = announced;
      while (s.week <= deadline + 4) s = advanceOneWeek(s);
      return { state: s, deadline, id };
    };
    const a = script(start);
    const b = script(clone);
    expect(norm(a.state)).toEqual(norm(b.state));

    const kn = keynoteFor(a.state, a.id)!;
    expect(kn.slipped).toBe(true);

    // Rep sting is applied exactly once (a quiet solo run has otherwise-stable reputation): compare to a
    // no-announce baseline advanced the same number of weeks.
    const baseline = (() => {
      const { state, id } = begin(start, mkProduct("phone", "slip"));
      let s = state;
      const target = a.state.week;
      while (s.week < target) s = advanceOneWeek(s);
      void id;
      return s.reputation;
    })();
    expect(baseline - a.state.reputation).toBeCloseTo(BALANCE.keynote.slipRepPenalty, 6);

    // Advancing several more weeks must NOT sting again (once, at expiry).
    let more = a.state;
    for (let w = 0; w < 6; w++) more = advanceOneWeek(more);
    expect(a.state.reputation - more.reputation).toBeCloseTo(0, 6);

    // The eventual launch of the slipped product is penalised vs a clean baseline launch.
    const slippedScore = launchReady(a.state, a.id).launchScore!;
    const cleanScore = (() => {
      const { state, id } = begin(start, mkProduct("phone", "clean"));
      const ready = advanceUntilReady(state, id);
      return launchReady(ready, id).launchScore!;
    })();
    expect(slippedScore).toBeLessThan(cleanScore);
  });
});

describe("keynote reducer — guard rails", () => {
  it("only announces while the product is in the build queue", () => {
    const s: GameState = fresh(1);
    expect(announceKeynote(s, "nope")).toBe(s); // no such build → no-op (same ref)
  });

  it("one keynote per product (a second announce is a no-op)", () => {
    const start: GameState = fresh(2);
    const { state, id } = begin(start, mkProduct("phone", "p"));
    const once = announceKeynote(state, id);
    expect(once).not.toBe(state);
    const twice = announceKeynote(once, id);
    expect(twice).toBe(once); // rejected → same ref
    expect((twice.pendingKeynote ?? []).filter((k) => k.productId === id).length).toBe(1);
  });

  it("caps announces per 52-week year (anti-spam)", () => {
    let s: GameState = fresh(3, 200_000_000);
    const cap = BALANCE.keynote.maxPerYear;
    // Announce up to the cap across distinct builds in the same year.
    for (let i = 0; i < cap; i++) {
      const { state, id } = begin(s, mkProduct("phone", `y${i}`));
      s = announceKeynote(state, id);
      expect(keynotesThisYear(s)).toBe(i + 1);
    }
    // One more in the same year is refused.
    const { state, id } = begin(s, mkProduct("phone", "over"));
    const refused = announceKeynote(state, id);
    expect(refused).toBe(state);
    expect(keynoteFor(refused, id)).toBeUndefined();

    // Roll into the next 52-week year → the cap resets (the ledger self-prunes on announce).
    let next = state;
    while (next.week < 52) next = advanceOneWeek(next);
    // The over build may have finished; start a new one in the new year.
    const nextYearBuild = begin(next, mkProduct("phone", "newyear"));
    const ok = announceKeynote(nextYearBuild.state, nextYearBuild.id);
    expect(ok).not.toBe(nextYearBuild.state);
    expect(keynotesThisYear(ok)).toBe(1);
  });

  it("announce grants a small one-time fan bump", () => {
    const start: GameState = fresh(5);
    const { state, id } = begin(start, mkProduct("phone", "fan"));
    const after = announceKeynote(state, id);
    const expected = Math.round(state.fans * BALANCE.keynote.announceFanFrac) + BALANCE.keynote.announceFanFlat;
    expect(after.fans - state.fans).toBe(expected);
    expect(toDollars(after.cash)).toBe(toDollars(state.cash)); // free — the gamble is reputational, not cash
  });
});
