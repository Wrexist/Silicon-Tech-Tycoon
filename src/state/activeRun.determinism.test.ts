// ACTIVE-RUN determinism pin — the companion the do-nothing pin cannot be.
//
// `gameState.test.ts` pins a 160-week run with ZERO player actions. That is the right shape for
// catching an un-gated new system, but it is silent about most of the tick: a do-nothing run never
// launches a product, never hires, never moves office, never expands abroad, never lists. Whole
// phases of `advanceOneWeek` — launch settlement, payroll, the staff streams, regional loyalty, the
// post-IPO shareholder loop — are simply not executed, so a change that breaks them passes.
//
// This drives the same engine with a fixed, scripted player policy and pins the result the same two
// ways: run it twice and compare bit-for-bit (self-consistency), then compare a fingerprint against
// frozen values (golden master). Between them, a refactor of the tick that changes behaviour on a
// path the player actually walks fails HERE.
//
// The policy is deliberately dumb and fixed. It is not meant to play well — it is meant to touch
// every phase in a way that never changes, so the numbers below mean something.
//
// KNOWN THIN SPOT: only a handful of its 39 launches land in era 1. Perturbing an era-2 band moves
// the fingerprint immediately; perturbing an ERA-1 band may not, because those few launches clear it
// either way. Era-1 tuning is covered by `engine/balanceGuards.test.ts` and by `npm run sim`, not
// here — don't read a pass as "era 1 is unchanged".
import { describe, expect, it } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import {
  newGame,
  advanceOneWeek,
  startBuild,
  launchReady,
  hireStaff,
  recommendedRun,
  placeFurniture,
  unlockRegion,
  researchedTier,
  researchNext,
  canAdvance,
  advanceEraAction,
  productStats,
  type GameState,
} from "./gameState.ts";
import { priceGuidance } from "../engine/market.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import { canPlace } from "../engine/furniture.ts";
import type { Product } from "../engine/types.ts";

const WEEKS = 120;
const SLOTS = CATEGORIES.phone.slots;

/** The best phone the company can currently build, at the guidance price. Mirrors the balance
 *  harness's policy — a fixed cheap spec never leaves era 1, which would leave the later phases of
 *  the tick just as unexercised as the do-nothing pin leaves them. */
function phone(s: GameState, id: string): Product {
  const tiers = {} as Product["tiers"];
  for (const slot of SLOTS) tiers[slot] = Math.max(1, researchedTier(s, slot));
  const p: Product = {
    id,
    name: `Aurora ${id}`,
    category: "phone",
    tiers,
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(0),
    designTier: s.era,
    camera: { count: 2, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
  };
  return { ...p, price: priceGuidance(productStats(s, p), "phone").fair };
}

const CHANNEL_COST: Record<string, number> = {
  none: 0, social: 4_000, search: 9_000, billboards: 15_000, influencer: 20_000, tv: 30_000, event: 45_000,
};
/** Costliest campaign affordable at ~12% of cash — the same rule the balance harness uses. */
function pickChannel(s: GameState): "none" | "social" | "search" | "billboards" | "influencer" | "tv" | "event" {
  const budget = toDollars(s.cash) * 0.12;
  let best: keyof typeof CHANNEL_COST = "none";
  for (const c of Object.keys(CHANNEL_COST)) if (CHANNEL_COST[c] <= budget) best = c;
  return best as ReturnType<typeof pickChannel>;
}

/** Seat a hire. Desks gate headcount, so without this the staff phases never run. */
function seat(s: GameState): GameState {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (canPlace(s.layout, "desk", c, r, 0, undefined, s.facilityTier)) return placeFurniture(s, "desk", c, r, 0);
    }
  }
  return s;
}

/** One week of a fixed player policy: settle, build, staff, expand, tick. Every branch is decided by
 *  state alone — no clock, no randomness of its own — so the whole run is a pure function of the seed. */
function playOneWeek(s: GameState, w: number): GameState {
  if (canAdvance(s)) s = advanceEraAction(s);
  // push the weakest-researched slot up a tier, so the run climbs the tech tree
  let weakest = SLOTS[0];
  for (const slot of SLOTS) if (researchedTier(s, slot) < researchedTier(s, weakest)) weakest = slot;
  s = researchNext(s, weakest);

  if (s.ready.length > 0) {
    const res = launchReady(s, s.ready[0].id);
    if (res.ok) s = res.state;
  }
  if (s.building.length === 0 && !s.bankrupt) {
    const p = phone(s, `p${w}`);
    // A campaign is not optional in this game: a policy that never runs one flops ~75% of its
    // launches and never leaves reputation 0, which would leave the whole reputation/era ladder
    // unexercised. Costliest channel affordable at a fixed fraction of cash — a rule, not a choice.
    const ch = pickChannel(s);
    const res = startBuild(s, p, Math.max(50, recommendedRun(s, p, ch)), ch);
    if (res.ok) s = res.state;
  }
  // Hire on a fixed cadence with a fixed affordability rule — enough to exercise payroll and the
  // staff-gated interrupt streams (which need staff.length >= 2).
  if (w % 12 === 0 && s.staff.length < 5 && s.cash > dollars(300_000)) {
    s = seat(s);
    s = hireStaff(s, "engineer", 4, `Dev ${s.staff.length}`);
  }
  if (w === 40) s = unlockRegion(s, "north_america"); // exercises regional loyalty + regional events
  return advanceOneWeek(s);
}

function run(start: GameState): GameState {
  let s = start;
  for (let w = 0; w < WEEKS; w++) s = playOneWeek(s, w);
  return s;
}

describe("active-run determinism — the paths a do-nothing run never touches", () => {
  it(`a ${WEEKS}-week PLAYED run is reproducible bit-for-bit from the same start`, () => {
    const start = { ...newGame(4242), cash: dollars(5_000_000), designBudgetEnabled: false };
    const clone = structuredClone(start);
    const a = run(start);
    const b = run(clone);
    // feed ids embed a module-level counter that keeps counting across the two in-process runs
    // (same normalization as the do-nothing pin) — everything else must match exactly.
    const norm = (s: GameState) => ({ ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) });
    expect(norm(b)).toEqual(norm(a));
    // …and the run actually did the things it claims to cover.
    expect(a.week).toBe(WEEKS);
    expect(a.launched.length).toBeGreaterThan(0);
    expect(a.staff.length).toBeGreaterThan(1);
    expect(a.unlockedRegions).toContain("north_america");
    expect(a.era).toBeGreaterThan(1); // climbed the ladder, so the era-scaled phases ran too
    expect(a.reputation).toBeGreaterThan(0);
  });

  it("matches its frozen golden fingerprint", () => {
    // GOLDEN MASTER. If you changed the sim on purpose, re-derive these from the run and update them
    // in the SAME commit — that is the point of the pin. If you did NOT mean to change the sim, this
    // failing is the bug report.
    const s = run({ ...newGame(4242), cash: dollars(5_000_000), designBudgetEnabled: false });
    expect(s.week).toBe(WEEKS);
    expect(s.rngState).toBe(1_250_024_367);
    expect(s.cash).toBe(4_237_590_104); // integer CENTS — no float representation risk
    expect(s.cumulativeRevenue).toBe(8_185_732_100);
    expect(s.launched.length).toBe(39);
    // Reputation is the one non-integer here (it accumulates fractional gains), so it is compared
    // with a tolerance rather than exactly — everything else is an integer by construction.
    expect(s.reputation).toBeCloseTo(99.1, 5);
    expect(s.era).toBe(4);
    expect(s.fans).toBe(13_222);
    expect(s.researchPoints).toBe(95);
    expect(s.staff.length).toBe(4);
    expect(s.feed.length).toBe(60);
    expect(s.lastInterruptWeek).toBe(104);
  });
});
