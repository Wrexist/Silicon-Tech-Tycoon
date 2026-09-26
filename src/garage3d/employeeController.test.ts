// Contract test for the office's break scheduler: the derived away plan must be deterministic,
// capped, and collision-free, and only idle characters may leave a desk. Pure functions only —
// presentation-only, never read by the engine, but the invariants keep captures stable.
import { describe, expect, it } from "vitest";
import { awayPlanFor, MAX_AWAY, officeDestinations, ROAM_BOUND, scaledObstacles, clearPose, poseFor, publishPose, type RoamAgent } from "./employeeController.ts";
import { workTargetFor } from "./officeLive.ts";

const LAYOUT = [{ iid: "f1", type: "arcade" as const, c: 5, r: 5, rot: 0 as const }];
const DESTINATIONS = officeDestinations({
  amenityTier: 2,
  showWhiteboard: true,
  dark: true,
  layout: LAYOUT,
  facilityTier: 1,
  roomScale: 1,
});

const AGENTS: RoamAgent[] = Array.from({ length: 8 }, (_, i) => ({
  key: `a${i}`,
  seed: i * 2.1,
  colorIdx: i,
  x: i * 0.5 - 2,
  z: 0,
  face: 0,
}));

const SEED = 7;
/** A week where the plan is non-empty, so the real assertions are exercised, not vacuous. */
const ACTIVE_WEEK = (() => {
  for (let week = 1; week < 80; week++) if (awayPlanFor(AGENTS, SEED, week, DESTINATIONS).size > 0) return week;
  throw new Error("no active away week found — the schedule is dead");
})();

describe("employeeController — weekly break plan", () => {
  it("is deterministic for the same (agents, seed, week)", () => {
    const a = awayPlanFor(AGENTS, SEED, ACTIVE_WEEK, DESTINATIONS);
    const b = awayPlanFor(AGENTS, SEED, ACTIVE_WEEK, DESTINATIONS);
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("caps the walkers and never sends two to the same stand point", () => {
    for (let week = 1; week < 80; week++) {
      const plan = awayPlanFor(AGENTS, SEED, week, DESTINATIONS);
      expect(plan.size).toBeLessThanOrEqual(MAX_AWAY);
      const spots = [...plan.values()].map((s) => `${s.kind}:${s.x.toFixed(4)}:${s.z.toFixed(4)}`);
      expect(new Set(spots).size).toBe(spots.length);
    }
  });

  it("only releases characters whose derived work state is idle", () => {
    const plan = awayPlanFor(AGENTS, SEED, ACTIVE_WEEK, DESTINATIONS);
    expect(plan.size).toBeGreaterThan(0);
    for (const a of AGENTS) {
      if (!plan.has(a.key)) continue;
      expect(workTargetFor(SEED, ACTIVE_WEEK, Math.round(a.seed * 1000))).toBe(0);
    }
  });

  it("plans nothing without a destination to walk to", () => {
    expect(awayPlanFor(AGENTS, SEED, ACTIVE_WEEK, []).size).toBe(0);
  });
});

describe("employeeController — destinations", () => {
  it("only lists props that exist", () => {
    expect(officeDestinations({ amenityTier: 0, showWhiteboard: false, dark: true, layout: [], facilityTier: 1, roomScale: 1 })).toEqual([]);
    const kinds = DESTINATIONS.map((d) => d.kind).sort();
    expect(kinds).toEqual(["arcade", "board", "coffee"]);
  });

  it("only emits stand points a walker can actually reach, at every room scale", () => {
    for (const roomScale of [1, 11 / 9, 13 / 9]) {
      const dests = officeDestinations({ amenityTier: 2, showWhiteboard: true, dark: true, layout: LAYOUT, facilityTier: 3, roomScale });
      const bound = ROAM_BOUND * roomScale;
      const obstacles = scaledObstacles(roomScale);
      for (const d of dests) {
        expect(d.spots.length).toBeGreaterThan(0);
        for (const s of d.spots) {
          expect(Math.abs(s.x)).toBeLessThanOrEqual(bound);
          expect(Math.abs(s.z)).toBeLessThanOrEqual(bound);
          for (const o of obstacles) expect(Math.hypot(s.x - o.x, s.z - o.z)).toBeGreaterThanOrEqual(o.r);
        }
      }
      // The coffee machine must stay reachable in a scaled room — the bug that made walkers stall.
      expect(dests.some((d) => d.kind === "coffee")).toBe(true);
    }
  });
});

describe("employeeController — live pose registry", () => {
  it("round-trips a pose and clears it", () => {
    publishPose("a0", { activity: "coffee", x: 1, z: 2, roaming: true });
    expect(poseFor("a0")).toEqual({ activity: "coffee", x: 1, z: 2, roaming: true });
    clearPose("a0");
    expect(poseFor("a0")).toBeUndefined();
  });
});
