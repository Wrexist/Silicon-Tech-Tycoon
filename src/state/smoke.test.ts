// Full-stack smoke test — drives a deterministic multi-era playthrough exercising EVERY system added
// this expansion (segments, style→demand, living rivals, era modifiers, forecast, delegation, M&A) and
// asserts invariants on every tick. Catches crashes / NaN / blowups + integration gaps the focused
// unit tests can't see when the features interact.
import { describe, it, expect } from "vitest";
import {
  newGame,
  advanceOneWeek,
  startBuild,
  launchReady,
  buildWeeksFor,
  recommendedRun,
  planProduction,
  acquireRival,
  canAcquire,
  setAutomation,
  autoAssignIdle,
  type GameState,
} from "./gameState.ts";
import { postMortem, type Verdict } from "../engine/postmortem.ts";
import { dollars, toDollars } from "../engine/money.ts";
import type { Product, Staff } from "../engine/types.ts";

function phone(price = 220): Product {
  return {
    id: "x", name: "Aurora", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(price), designTier: 1,
    camera: { count: 3, layout: "square", module: "squircle", flash: true, position: "topLeft" },
    notch: "island",
  };
}

function checkInvariants(s: GameState, ctx: string) {
  expect(Number.isFinite(toDollars(s.cash)), `${ctx}: cash finite`).toBe(true);
  expect(s.reputation, `${ctx}: rep lo`).toBeGreaterThanOrEqual(0);
  expect(s.reputation, `${ctx}: rep hi`).toBeLessThanOrEqual(100);
  expect(s.fans, `${ctx}: fans`).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(s.fans) && Number.isFinite(s.researchPoints), `${ctx}: finite fans/rp`).toBe(true);
  expect(s.competitors.length, `${ctx}: rivals present`).toBeGreaterThan(0);
  for (const lp of s.launched) {
    expect(["hit", "solid", "steady", "flop", undefined], `${ctx}: verdict`).toContain(lp.verdict);
    for (const u of lp.weeklyUnits) expect(Number.isFinite(u) && u >= 0, `${ctx}: weekly units`).toBe(true);
    expect(lp.unitsSold, `${ctx}: sold<=total`).toBeLessThanOrEqual(lp.totalUnits + 1);
  }
  for (const r of s.rivalReleases) {
    expect(r.product.name.length, `${ctx}: rival name`).toBeGreaterThan(0);
    expect(toDollars(r.product.price), `${ctx}: rival price`).toBeGreaterThan(0);
  }
}

/** A senior engineer + designer + marketer roster spread from the founder, so delegation is capable. */
function staffedTeam(base: GameState): Staff[] {
  const proto = base.staff[0];
  return [
    { ...proto, id: "e1", role: "engineer", skill: 7, assignment: "idle" },
    { ...proto, id: "d1", role: "designer", skill: 6, assignment: "idle" },
    { ...proto, id: "m1", role: "marketer", skill: 6, assignment: "idle" },
  ];
}

describe("full-stack smoke (all expansion systems together)", () => {
  it("planProduction is finite + bounded for a product in every era", () => {
    for (let era = 1; era <= 4; era++) {
      const s: GameState = { ...newGame(3), era, cash: dollars(500_000_000) };
      for (const price of [80, 220, 600, 1800]) {
        const plan = planProduction(s, phone(price), 5000, "event");
        const tag = `era ${era} @$${price}`;
        expect(plan.segments.perSegment.length, `${tag} segs`).toBe(5);
        expect(plan.demandFit, `${tag} fit lo`).toBeGreaterThanOrEqual(0);
        expect(plan.demandFit, `${tag} fit hi`).toBeLessThanOrEqual(100);
        expect(plan.competitionFactor, `${tag} comp lo`).toBeGreaterThan(0);
        expect(plan.competitionFactor, `${tag} comp hi`).toBeLessThanOrEqual(1);
        expect(plan.priceFit, `${tag} priceFit`).toBeGreaterThanOrEqual(0);
        for (const v of [plan.totalDemand, plan.projectedSales, plan.hype, plan.launchScore, toDollars(plan.projectedRevenue), toDollars(plan.projectedProfit)]) {
          expect(Number.isFinite(v), `${tag} finite ${v}`).toBe(true);
        }
        expect(plan.totalDemand, `${tag} demand>=0`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("a multi-era playthrough with delegation, launches and an acquisition stays sane", () => {
    let s: GameState = {
      ...newGame(11),
      cash: dollars(800_000_000),
      cumulativeRevenue: dollars(3_000_000), // established → acquisitions unlocked
      staff: undefined as unknown as Staff[],
    };
    s = { ...s, staff: staffedTeam(newGame(11)) };
    s = setAutomation(s, { autoAssign: true, autoResearch: true });
    s = autoAssignIdle(s); // delegation puts the idle team to work immediately
    expect(s.staff.every((m) => m.assignment !== "idle")).toBe(true);

    let acquired = false;
    for (let era = 1; era <= 4; era++) {
      s = { ...s, era };
      // design → build → launch
      const res = startBuild(s, phone(180 + era * 60), recommendedRun(s, phone(180 + era * 60), "none"), "none");
      expect(res.ok, `era ${era} build ok`).toBe(true);
      s = res.state;
      const weeks = buildWeeksFor(s) + 1;
      for (let i = 0; i < weeks; i++) { s = advanceOneWeek(s); checkInvariants(s, `era ${era} build wk${i}`); }
      if (s.ready.length) { s = launchReady(s, s.ready[0].id).state; checkInvariants(s, `era ${era} launch`); }
      // sell + let rivals act
      for (let i = 0; i < 8; i++) { s = advanceOneWeek(s); checkInvariants(s, `era ${era} sell wk${i}`); }
      // acquire the scrappiest rival once (exercises M&A + field refill)
      if (!acquired && canAcquire(s, "quantyx")) {
        const before = s.competitors.length;
        s = acquireRival(s, "quantyx");
        expect(s.competitors.length).toBe(before - 1);
        expect(s.acquiredRivals).toContain("quantyx");
        acquired = true;
        for (let i = 0; i < 20; i++) { s = advanceOneWeek(s); checkInvariants(s, `post-acq wk${i}`); }
      }
    }

    expect(s.launched.length, "shipped products").toBeGreaterThan(0);
    expect(s.rivalReleases.length, "rivals shipped products").toBeGreaterThan(0);
    expect(acquired, "an acquisition happened").toBe(true);
    // every recorded launch can produce a readable post-mortem
    for (const lp of s.launched) {
      if (lp.insight) {
        const pm = postMortem(lp.insight, (lp.verdict ?? "steady") as Verdict);
        expect(pm.headline.length).toBeGreaterThan(0);
        expect(pm.dominant.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
