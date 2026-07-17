import { describe, it, expect } from "vitest";
import { newGame, advanceOneWeek, setTeamFocus, researchWeeksLeft, startBuild, type GameState } from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { dollars, toDollars } from "../engine/money.ts";
import type { Staff, Product } from "../engine/types.ts";

/** A minimal valid designed product (mirrors the gameState test's fixture) so a real build job exists. */
function goodPhone(): Product {
  return {
    id: "x", name: "Aurora One", category: "phone",
    tiers: { chip: 1, display: 1, battery: 1, materials: 1, software: 1, camera: 1 },
    finish: "aluminium", colorIndex: 0, price: dollars(140), designTier: 1,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true }, notch: "punch",
  };
}

// A small helper: clone the founder into an N-person roster so a run has a real team to crunch.
function withTeam(state: GameState, n: number): GameState {
  const extra: Staff[] = [];
  for (let i = 1; i < n; i++) extra.push({ ...state.staff[0], id: `s${i}`, name: `Teammate ${i}`, mood: 75 });
  return { ...state, staff: [state.staff[0], ...extra] };
}

/** Start a research tier so there's a live lab timer to crunch. Seed cash so the team survives the run
 *  under both paces (crunch's overtime + morale drain must not bankrupt a cash-poor newGame, which would
 *  freeze the timer and confound the comparison). */
function withResearch(state: GameState, totalWeeks = 8): GameState {
  return {
    ...state,
    cash: dollars(5_000_000),
    activeResearch: { kind: "tier", ref: "chip", tierLevel: 2, name: "Faster chip", blurb: "", rpCost: 10, totalWeeks, startWeek: state.week },
  };
}

describe("team focus / crunch (feature #4)", () => {
  it("setTeamFocus toggles the field; null is the default no-op", () => {
    const g = newGame(1);
    expect(g.teamFocus ?? null).toBeNull();
    expect(setTeamFocus(g, "research").teamFocus).toBe("research");
    // Setting the same value is a no-op (returns the same reference).
    const r = setTeamFocus(g, "research");
    expect(setTeamFocus(r, "research")).toBe(r);
    expect(setTeamFocus(r, null).teamFocus).toBeNull();
  });

  it("crunching research finishes the lab sooner than the normal pace", () => {
    const base = withResearch(withTeam(newGame(2), 4), 8);
    const runToDone = (s0: GameState) => {
      let s = s0, weeks = 0;
      while (s.activeResearch && weeks < 40) { s = advanceOneWeek(s); weeks++; }
      return weeks;
    };
    const normalWeeks = runToDone(base);
    const crunchWeeks = runToDone(setTeamFocus(base, "research"));
    expect(crunchWeeks).toBeLessThan(normalWeeks);
  });

  it("crunching build ships the product sooner than the normal pace", () => {
    const seeded = { ...withTeam(newGame(3), 3), cash: dollars(5_000_000) };
    const built = startBuild(seeded, goodPhone(), 800, "none");
    expect(built.ok).toBe(true);
    // Lengthen the run so the 0.4-week/tick crunch has room to show a gap (a minWeeks phone is too short).
    const base = { ...built.state, building: built.state.building.map((j) => ({ ...j, totalWeeks: 8, weeksElapsed: 0 })) };
    expect(base.building.length).toBe(1);
    const runToReady = (s0: GameState) => {
      let s = s0, weeks = 0;
      while (s.building.length > 0 && weeks < 60) { s = advanceOneWeek(s); weeks++; }
      return weeks;
    };
    expect(runToReady(setTeamFocus(base, "build"))).toBeLessThan(runToReady(base));
  });

  it("crunching costs overtime cash and drains morale versus the normal pace", () => {
    const base = withResearch(withTeam(newGame(4), 4), 12);
    const tick = (s: GameState) => advanceOneWeek(s);
    const normal = tick(base);
    const crunch = tick(setTeamFocus(base, "research"));
    // Overtime: the crunching run spends strictly more cash this week.
    expect(toDollars(crunch.cash)).toBeLessThan(toDollars(normal.cash));
    // Morale: the crunching team trends unhappier than the resting one.
    const avgMood = (s: GameState) => s.staff.reduce((a, m) => a + m.mood, 0) / s.staff.length;
    expect(avgMood(crunch)).toBeLessThan(avgMood(normal));
  });

  it("a solo founder can't crunch (needs a real team) — the toggle is a no-op on the sim", () => {
    // newGame has one founder; below the minTeam gate, so crunch has no effect.
    const solo = withResearch(newGame(5), 8); // just the founder
    expect(solo.staff.length).toBeLessThan(BALANCE.teamFocus.minTeam);
    const normal = advanceOneWeek(solo);
    const crunched = advanceOneWeek(setTeamFocus(solo, "research"));
    // Same lab progress, same cash — the focus flag did nothing without a team.
    expect(researchWeeksLeft(crunched)).toBe(researchWeeksLeft(normal));
    expect(toDollars(crunched.cash)).toBe(toDollars(normal.cash));
  });

  it("offline catch-up never crunches (no irreversible morale hit the player couldn't react to)", () => {
    const base = setTeamFocus(withResearch(withTeam(newGame(6), 4), 12), "research");
    const online = advanceOneWeek(base, 1, false);
    const offline = advanceOneWeek(base, 1, true);
    // Offline ignores the crunch: it spends less cash (no overtime) and keeps more morale than online.
    expect(toDollars(offline.cash)).toBeGreaterThan(toDollars(online.cash));
  });

  it("the field is never written on a never-crunched run (byte-identical no-op)", () => {
    const base = withResearch(withTeam(newGame(7), 4), 8);
    const t = advanceOneWeek(base); // teamFocus unset
    expect(t.researchSurgeWeeks).toBeUndefined();
    expect(t.teamFocus ?? null).toBeNull();
  });
});
