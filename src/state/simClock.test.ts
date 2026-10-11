import { beforeEach, describe, expect, it } from "vitest";
import { armSimClock, markSimTick, resetSimClockForTests, simWeekPhase, stopSimClock } from "./simClock.ts";

beforeEach(() => resetSimClockForTests());

describe("sim clock (the one source of where the live tick is inside the week)", () => {
  it("knows nothing before the sim has run", () => {
    expect(simWeekPhase(0)).toBeNull();
  });

  it("reports the live phase of the running week; a landed week restarts it", () => {
    armSimClock(8000, 1000);
    expect(simWeekPhase(1000)).toEqual({ phase: 0, running: true });
    expect(simWeekPhase(5000)?.phase).toBe(0.5);
    expect(simWeekPhase(99_000)?.phase).toBe(1); // clamped: a late tick never reads past the week
    markSimTick(9000);
    expect(simWeekPhase(11_000)?.phase).toBe(0.25);
  });

  it("freezes on stop, and every reader sees the frozen phase (a ring opened while paused agrees)", () => {
    armSimClock(8000, 0);
    stopSimClock(7200); // paused 90% into the week
    expect(simWeekPhase(50_000)).toEqual({ phase: 0.9, running: false });
  });

  it("on resume, carries the frozen phase and spreads the rest over one fresh full tick", () => {
    armSimClock(8000, 0);
    stopSimClock(4800);               // 60% in
    armSimClock(8000, 100_000);       // the sim restarts its interval from scratch
    expect(simWeekPhase(100_000)?.phase).toBeCloseTo(0.6, 10); // never jumps back
    expect(simWeekPhase(104_000)?.phase).toBeCloseTo(0.8, 10); // halfway through the fresh tick
    expect(simWeekPhase(108_000)?.phase).toBe(1);              // reaches the end as the tick lands
  });

  it("a Fast toggle (stop + re-arm at the new speed) keeps the position and speeds the rest up", () => {
    armSimClock(8000, 0);
    stopSimClock(2000);               // 25% in
    armSimClock(1000, 2000);          // Fast: 1 s weeks
    expect(simWeekPhase(2000)?.phase).toBeCloseTo(0.25, 10);
    expect(simWeekPhase(2500)?.phase).toBeCloseTo(0.625, 10);
  });

  it("a landed week clears the carry, and repeated stops are harmless", () => {
    armSimClock(8000, 0);
    stopSimClock(4000);
    stopSimClock(7000);               // already stopped: no change
    expect(simWeekPhase(7000)?.phase).toBe(0.5);
    armSimClock(8000, 10_000);
    markSimTick(14_000);              // the week lands
    expect(simWeekPhase(14_000)?.phase).toBe(0);
    expect(simWeekPhase(18_000)?.phase).toBe(0.5);
  });

  it("ignores a non-positive interval", () => {
    armSimClock(0, 0);
    expect(simWeekPhase(0)).toBeNull();
  });
});
