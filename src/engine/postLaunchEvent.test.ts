// Post-launch reactive events (item 3.6): deterministic cadence, eligibility, target selection keyed
// to performance, event flavour by sell-through, and the reducer's effect application (cash/rep/fans,
// incl. rejecting an unaffordable option).
import { describe, expect, it } from "vitest";
import {
  postLaunchDue, postLaunchEligible, pickPostLaunchTarget, generatePostLaunchEvent, type PostLaunchTarget,
} from "./postLaunchEvent.ts";

const target = (over: Partial<PostLaunchTarget> = {}): PostLaunchTarget => ({
  productId: "p1", productName: "Nova", category: "phone",
  sellThrough: 0.5, weeksLive: 4, weeksLeft: 6, ...over,
});

describe("post-launch events — engine", () => {
  it("the cadence is deterministic and RNG-free", () => {
    expect(postLaunchDue(12345, 40)).toBe(postLaunchDue(12345, 40));
  });

  it("eligibility needs some time live AND runway left", () => {
    expect(postLaunchEligible(target({ weeksLive: 0 }))).toBe(false); // too fresh
    expect(postLaunchEligible(target({ weeksLeft: 0 }))).toBe(false); // window closing
    expect(postLaunchEligible(target())).toBe(true);
  });

  it("picks the MOST EXTREME performer (hottest or slowest), not a middling one", () => {
    const middling = target({ productId: "mid", sellThrough: 0.5 });
    const hot = target({ productId: "hot", sellThrough: 0.95 });
    expect(pickPostLaunchTarget([middling, hot])!.productId).toBe("hot");
    const cold = target({ productId: "cold", sellThrough: 0.05 });
    expect(pickPostLaunchTarget([middling, cold])!.productId).toBe("cold");
    expect(pickPostLaunchTarget([])).toBeNull();
  });

  it("a hot seller gets a momentum beat; a slow mover a stall beat; else a supply pinch", () => {
    expect(generatePostLaunchEvent(target({ sellThrough: 0.95 }), 5).kind).toBe("momentum");
    expect(generatePostLaunchEvent(target({ sellThrough: 0.1 }), 5).kind).toBe("stall");
    expect(generatePostLaunchEvent(target({ sellThrough: 0.5 }), 5).kind).toBe("supply");
  });

  it("every event offers real choices and a free/low-risk hold", () => {
    for (const st of [0.95, 0.1, 0.5]) {
      const ev = generatePostLaunchEvent(target({ sellThrough: st }), 5);
      expect(ev.options.length).toBeGreaterThanOrEqual(2);
      // at least one option costs nothing up-front (the "hold / ride it out / clearance-gain" choice)
      expect(ev.options.some((o) => !(o.effect.cashCost ?? 0))).toBe(true);
    }
  });
});

describe("post-launch events — reducer", () => {
  it("applies cash/rep/fans and rejects an unaffordable cash option", async () => {
    const { newGame, resolvePostLaunch } = await import("../state/gameState.ts");
    const g0 = newGame(9);
    const ev = generatePostLaunchEvent(target({ sellThrough: 0.95 }), g0.week); // momentum: option 0 costs cash
    const paidIdx = ev.options.findIndex((o) => (o.effect.cashCost ?? 0) > 0);

    // Broke → the paid push is rejected, card stays up.
    const broke = { ...g0, cash: 1 as typeof g0.cash, pendingPostLaunch: ev };
    const rej = resolvePostLaunch(broke, paidIdx);
    expect(rej.result.ok).toBe(false);
    expect(rej.state.pendingPostLaunch).not.toBeNull();

    // Funded → the push applies fans + rep and clears the card.
    const funded = { ...g0, pendingPostLaunch: ev };
    const ok = resolvePostLaunch(funded, paidIdx);
    expect(ok.result.ok).toBe(true);
    expect(ok.state.pendingPostLaunch).toBeNull();
    expect(ok.state.fans).toBeGreaterThan(g0.fans);
    expect(ok.state.reputation).toBeGreaterThanOrEqual(g0.reputation);
    expect(ok.state.cash).toBeLessThan(g0.cash);
  });

  it("a clearance recovers cash for a small reputation dip", async () => {
    const { newGame, resolvePostLaunch } = await import("../state/gameState.ts");
    const g0 = newGame(9);
    const ev = generatePostLaunchEvent(target({ sellThrough: 0.1 }), g0.week); // stall: clearance gains cash
    const clearIdx = ev.options.findIndex((o) => (o.effect.cashGain ?? 0) > 0);
    const out = resolvePostLaunch({ ...g0, pendingPostLaunch: ev }, clearIdx);
    expect(out.result.ok).toBe(true);
    expect(out.state.cash).toBeGreaterThan(g0.cash);
    expect(out.state.reputation).toBeLessThanOrEqual(g0.reputation);
  });
});
