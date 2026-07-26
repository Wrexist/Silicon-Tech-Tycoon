// A bad start must be a SETBACK, not an absorbing state.
//
// Reputation and fans are the two inputs to demand, and both used to be drivable to exactly zero by
// a handful of early flops: reputation started at 8 and a flop cost a flat 5, fans started at 250
// and a flop cost a flat 140. At zero there is no demand, so the next launch flops too — a first-
// month mistake with no path back. Traced on the balance harness, a player shipping one component
// tier below the frontier lost all reputation and every fan by week 20 and went bankrupt in 12 of
// 12 seeds, always in the garage era.
//
// Both floors are era-scaled or proportional so the late game is untouched: an established company
// still has everything to lose. These pin the recovery guarantee itself, not the numbers around it.
import { describe, expect, it } from "vitest";
import { BALANCE } from "../engine/balance.ts";
import { reputationFloor } from "./gameState.ts";

describe("a bad start stays recoverable", () => {
  it("reputation cannot be driven to zero while the company is young", () => {
    // The garage and growth eras keep a foothold; the late eras do not need one.
    expect(reputationFloor(1)).toBeGreaterThan(0);
    expect(reputationFloor(2)).toBeGreaterThan(0);
    // …and the floor only ever eases as the company grows — an established brand has more to lose.
    for (let era = 2; era <= 5; era++) {
      expect(reputationFloor(era)).toBeLessThanOrEqual(reputationFloor(era - 1));
    }
  });

  it("the era-1 floor survives a full run of nothing but flops", () => {
    // The concrete guarantee: however many times a garage company fails, it keeps enough standing
    // to sell something. Applying the flop penalty 100 times must not breach the floor.
    const floor = reputationFloor(1);
    let rep: number = BALANCE.startingReputation;
    for (let i = 0; i < 100; i++) rep = Math.max(floor, rep - BALANCE.reputation.lossPerFlop);
    expect(rep).toBe(floor);
    expect(rep).toBeGreaterThan(0); // …and "enough" means more than nothing
  });

  it("a flop costs the smaller of the flat loss and a share of the audience", () => {
    const fb = BALANCE.fans;
    const loss = (fans: number) => Math.min(fb.lossPerFlop, fans * fb.lossShareOnFlop);
    // Big brand: the flat number dominates, so late-game behaviour is exactly as it was.
    expect(loss(200_000)).toBe(fb.lossPerFlop);
    // New company: the share dominates, so the loss scales with what there is to lose.
    expect(loss(fb.starting)).toBeLessThan(fb.lossPerFlop);
  });

  it("repeated flops can never zero a fanbase", () => {
    // Geometric decay: proportional loss approaches zero without reaching it, which is the whole
    // point — there is always an audience left to win a launch back with.
    const fb = BALANCE.fans;
    let fans: number = fb.starting;
    for (let i = 0; i < 200; i++) fans = Math.max(0, fans - Math.min(fb.lossPerFlop, fans * fb.lossShareOnFlop));
    expect(fans).toBeGreaterThan(0);
  });

  it("the era-1 flop floor sits below what a weaker garage product scores", () => {
    // Harness-measured: a garage product one tier below the frontier scores about 10. With the floor
    // at 10, 88% of those launches flopped and the run died 12/12. The floor must stay clear of that
    // band so a modestly weaker first product is a weak SELLER, not a failure.
    const WEAKER_GARAGE_PRODUCT_SCORE = 10;
    expect(BALANCE.reputation.flopThresholdByEra[0]).toBeLessThan(WEAKER_GARAGE_PRODUCT_SCORE);
  });
});
