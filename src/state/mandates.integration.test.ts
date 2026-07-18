import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import type { CategoryId, Product } from "../engine/types.ts";
import {
  advanceEraAction,
  advanceOneWeek,
  buildWeeksFor,
  chooseMandate,
  startBuild,
  launchReady,
  newGame,
  toolingCost,
  effectiveUnitCost,
  prestigeBonuses,
  mandateBonuses,
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

// Feed ids embed a module-level counter that climbs across in-process runs (same trick the 160-week
// pin uses), so compare everything else and normalise the feed to its content.
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

/** An era-1 company that clears the 1→2 rep bar so advanceEraAction fires + rolls a mandate offer. */
function readyToAdvance(seed: number): GameState {
  return { ...newGame(seed), cash: dollars(20_000_000), reputation: 60 };
}

describe("era mandate — the draft flow", () => {
  it("advancing an era rolls a deterministic 3-option offer for the entered era", () => {
    const s = advanceEraAction(readyToAdvance(4242));
    expect(s.era).toBe(2);
    expect(s.pendingMandateOffer).toBeTruthy();
    expect(s.pendingMandateOffer!.eraTo).toBe(2);
    expect(s.pendingMandateOffer!.options.length).toBe(3);
    // Deterministic: the same start rolls the same hand.
    const again = advanceEraAction(readyToAdvance(4242));
    expect(again.pendingMandateOffer!.options).toEqual(s.pendingMandateOffer!.options);
  });

  it("adopting a mandate holds it + clears the offer; declining clears with nothing held", () => {
    const offered = advanceEraAction(readyToAdvance(7));
    const pick = offered.pendingMandateOffer!.options[0];

    const adopted = chooseMandate(offered, pick);
    expect(adopted.eraMandates).toEqual([pick]);
    expect(adopted.pendingMandateOffer).toBeNull();

    const declined = chooseMandate(offered, null);
    expect(declined.eraMandates).toEqual([]);
    expect(declined.pendingMandateOffer).toBeNull();
  });

  it("rejects an id that is not one of the three offered (no forged mandate)", () => {
    const offered = advanceEraAction(readyToAdvance(9));
    const notOffered = ["cult", "press", "lean", "skunkworks", "massmarket", "prestige", "grassroots"]
      .find((id) => !offered.pendingMandateOffer!.options.includes(id))!;
    const after = chooseMandate(offered, notOffered);
    expect(after.eraMandates ?? []).toEqual([]);
    expect(after.pendingMandateOffer).toBeTruthy(); // untouched — offer still open
  });
});

describe("era mandate — determinism", () => {
  it("(a) a no-mandate run with launches replays byte-identical (empty held = no-op)", () => {
    const start: GameState = { ...newGame(555), cash: dollars(20_000_000), eraMandates: [] };
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
    expect(a.eraMandates).toEqual([]);
  });

  it("(b) a run that advances an era + drafts a mandate replays byte-identical twice", () => {
    const start = readyToAdvance(2024);
    const script = (s0: GameState) => {
      let s = advanceEraAction(s0); // era 2 + offer
      s = chooseMandate(s, s.pendingMandateOffer!.options[0]); // adopt the first
      s = ship(s, mkProduct("phone", "p1"));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = script(start);
    const b = script(structuredClone(start));
    expect(norm(a)).toEqual(norm(b));
    expect(a.eraMandates!.length).toBe(1);
    expect(a.pendingMandateOffer).toBeNull();
  });

  it("(c) declining leaves state equivalent to a no-mandate run (only the offer is cleared)", () => {
    const advanced = advanceEraAction(readyToAdvance(88));
    const declined = chooseMandate(advanced, null);
    // A hand-cleared baseline: the same era-2 state with the offer removed and nothing held.
    const baseline: GameState = { ...advanced, pendingMandateOffer: null, eraMandates: [] };
    expect(norm(declined)).toEqual(norm(baseline));
    // ...and the two play forward identically.
    const run = (s0: GameState) => {
      let s = s0;
      s = ship(s, mkProduct("phone", "p1"));
      for (let w = 0; w < 6; w++) s = advanceOneWeek(s);
      return s;
    };
    expect(norm(run(declined))).toEqual(norm(run(structuredClone(baseline))));
  });
});

describe("era mandate — the held bonus reaches real seams", () => {
  it("build-cost mandates shift tooling + per-unit cost the right way", () => {
    const base: GameState = { ...newGame(1), eraMandates: [] };
    const lean: GameState = { ...base, eraMandates: ["lean"] }; // −8% build cost
    const skunk: GameState = { ...base, eraMandates: ["skunkworks"] }; // +6% build cost
    const phone = mkProduct("phone", "z", 5); // tier 5 clears the tooling floor

    expect(toDollars(toolingCost(lean, phone))).toBeLessThan(toDollars(toolingCost(base, phone)));
    expect(toDollars(toolingCost(skunk, phone))).toBeGreaterThan(toDollars(toolingCost(base, phone)));
    expect(toDollars(effectiveUnitCost(lean, phone))).toBeLessThan(toDollars(effectiveUnitCost(base, phone)));
    expect(toDollars(effectiveUnitCost(skunk, phone))).toBeGreaterThan(toDollars(effectiveUnitCost(base, phone)));
    // Small: never a game-warping swing (well under 12%).
    expect(toDollars(effectiveUnitCost(lean, phone))).toBeGreaterThanOrEqual(Math.floor(toDollars(effectiveUnitCost(base, phone)) * 0.88));
  });

  it("prestige-style axes (hype / RP / design ceiling) fold through prestigeBonuses", () => {
    const base: GameState = { ...newGame(2), eraMandates: [] };
    const press: GameState = { ...base, eraMandates: ["press"] }; // +9% hype, −5% RP
    expect(prestigeBonuses(press).hype).toBeCloseTo(prestigeBonuses(base).hype + 0.09, 10);
    expect(prestigeBonuses(press).rpMult).toBeCloseTo(prestigeBonuses(base).rpMult - 0.05, 10);

    const boutique: GameState = { ...base, eraMandates: ["boutique"] }; // +1 design ceiling
    expect(prestigeBonuses(boutique).designCeiling).toBe(prestigeBonuses(base).designCeiling + 1);
  });

  it("the mandateBonuses selector reads the held demand / fan axes", () => {
    const mass: GameState = { ...newGame(3), eraMandates: ["massmarket"] }; // +8% demand, −7% fan
    expect(mandateBonuses(mass).demandMult).toBeCloseTo(0.08, 10);
    expect(mandateBonuses(mass).fanGainMult).toBeCloseTo(-0.07, 10);
    // Empty → all-zero.
    expect(mandateBonuses({ ...newGame(3), eraMandates: [] }).demandMult).toBe(0);
  });
});
