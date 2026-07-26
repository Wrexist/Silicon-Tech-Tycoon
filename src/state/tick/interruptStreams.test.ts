// The registry's own invariants. The point of lifting these blocks out of `advanceOneWeek` was that
// a sixth stream should be an entry in a list rather than a copy of a neighbour's shape — these pin
// the properties that make the list trustworthy.
import { describe, expect, it } from "vitest";
import { dollars } from "../../engine/money.ts";
import { INTERRUPT_STREAMS, runInterruptStreams, type InterruptCtx } from "./interruptStreams.ts";
import { newGame, noPendingInterrupt, type FeedItem, type FeedTone } from "../gameState.ts";

let seq = 0;
const feed = (week: number, text: string, tone: FeedTone): FeedItem => ({ id: `t${seq++}`, week, text, tone });

function ctx(over: Partial<InterruptCtx> = {}): InterruptCtx {
  const prev = { ...newGame(5), cash: dollars(1_000_000) };
  return { prev, week: prev.week, offline: false, bankrupt: false, interruptQuiet: true, screenFree: noPendingInterrupt, feed, ...over };
}

describe("interrupt stream registry", () => {
  it("keys are unique and the order is the one the tick ran inline", () => {
    const keys = INTERRUPT_STREAMS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    // Order is behaviour, not presentation: these share one weekly budget, so whoever asks first
    // gets it. Changing this list reorders who wins a contested week.
    expect(keys).toEqual(["poaching", "eureka", "communityAsk", "staffGrowth", "staffLifeEvent"]);
  });

  it("every stream is a no-op on an offline (catch-up) tick", () => {
    // Replaying missed weeks must never raise a card the player wasn't there to see.
    const c = ctx({ offline: true });
    const base = structuredClone(c.prev);
    runInterruptStreams(base, c);
    expect(base).toEqual(c.prev);
  });

  it("every stream is a no-op for a bankrupt company", () => {
    const c = ctx({ bankrupt: true });
    const base = structuredClone(c.prev);
    runInterruptStreams(base, c);
    expect(base).toEqual(c.prev);
  });

  it("every BUDGETED stream is a no-op when the screen is already occupied", () => {
    // Poaching is deliberately exempt (it predates the shared budget and gates on its own pair), so
    // it is excluded here rather than silently allowed to fail the rule.
    const c = ctx({ screenFree: () => false });
    for (const s of INTERRUPT_STREAMS) {
      if (s.key === "poaching") continue;
      const base = structuredClone(c.prev);
      s.run(base, c);
      expect(base, `${s.key} fired with the screen occupied`).toEqual(c.prev);
    }
  });

  it("every BUDGETED stream is a no-op on a week that isn't quiet", () => {
    const c = ctx({ interruptQuiet: false });
    for (const s of INTERRUPT_STREAMS) {
      if (s.key === "poaching") continue;
      const base = structuredClone(c.prev);
      s.run(base, c);
      expect(base, `${s.key} ignored the interrupt budget`).toEqual(c.prev);
    }
  });

  it("a fresh solo company raises nothing — the pinned do-nothing run's invariant", () => {
    const c = ctx();
    const base = structuredClone(c.prev);
    runInterruptStreams(base, c);
    expect(base).toEqual(c.prev);
  });
});
