// Side Orders — client commissions on the player's factory line. Deterministic offer stream,
// hard accept gates (wired line + required machines), +1wk to own builds while running, payout
// on completion. Everything player-opt-in: the pinned sim never accepts, baseline untouched.
import { describe, it, expect } from "vitest";
import { dollars, toDollars } from "../engine/money.ts";
import { demoFloor, starterFloor } from "../engine/factoryFloor.ts";
import { generateSideOrder, sideOrderDue, sideOrderPayout, SIDE_ORDER_CANCEL_PCT } from "../engine/sideOrders.ts";
import {
  acceptSideOrder, advanceOneWeek, buildWeeksFor, cancelSideOrder, declineSideOrder, newGame,
  skipInterrupt, type GameState,
} from "./gameState.ts";

/** First week ≥ 16 where seed's offer stream fires. */
function firstDueWeek(seed: number): number {
  for (let w = 16; w < 200; w++) if (sideOrderDue(seed, w)) return w;
  throw new Error("no due week in 200 — hash broken");
}

describe("side order engine", () => {
  it("offers are deterministic and sanely bounded", () => {
    const a = generateSideOrder(7, 30, 2);
    expect(generateSideOrder(7, 30, 2)).toEqual(a);
    expect(a.units).toBeGreaterThanOrEqual(300);
    expect(a.units).toBeLessThanOrEqual(4000);
    expect(toDollars(a.feePerUnit)).toBeGreaterThanOrEqual(9);
    expect(a.weeksNeeded).toBeGreaterThanOrEqual(3);
    expect(a.weeksNeeded).toBeLessThanOrEqual(5);
    expect(a.requiredKinds.length).toBeGreaterThan(0);
    expect(a.expiresWeek).toBe(32);
  });
});

describe("side orders in the tick", () => {
  it("an offer appears on its due week, interrupts skipping, and lapses after expiry", () => {
    const seed = 5;
    const due = firstDueWeek(seed);
    const s: GameState = { ...newGame(seed), week: due - 1, nextEventWeek: 9_999 };
    const next = advanceOneWeek(s);
    const offer = next.pendingSideOrder!;
    expect(offer).toBeTruthy();
    expect(skipInterrupt(s, next)).toBe("A client wants your factory line");
    // Let it lapse: after expiresWeek passes, the offer clears quietly.
    let cur = next;
    for (let i = 0; i < 4 && cur.pendingSideOrder; i++) cur = advanceOneWeek(cur);
    expect(cur.pendingSideOrder ?? null).toBeNull();
    expect(cur.activeSideOrder ?? null).toBeNull(); // never self-accepts
  });

  it("accept gates: wired line and required machines; demo floor qualifies", () => {
    const seed = 5;
    const due = firstDueWeek(seed);
    const withOffer = advanceOneWeek({ ...newGame(seed), week: due - 1, nextEventWeek: 9_999 });
    expect(withOffer.pendingSideOrder).toBeTruthy();

    // Bare starter floor (no belts) → refused for the line.
    expect(withOffer.factoryFloor.belts.length).toBe(0);
    const noLine = acceptSideOrder(withOffer);
    expect(noLine.ok).toBe(false);
    expect(noLine.reason).toMatch(/wire/i);

    // Full demo floor has every machine kind → accepted.
    const rigged: GameState = { ...withOffer, factoryFloor: demoFloor() };
    const res = acceptSideOrder(rigged);
    expect(res.ok).toBe(true);
    expect(res.state.activeSideOrder?.startedWeek).toBe(rigged.week);
    expect(res.state.pendingSideOrder ?? null).toBeNull();

    // Accepting twice refuses.
    expect(acceptSideOrder({ ...res.state, pendingSideOrder: withOffer.pendingSideOrder }).ok).toBe(false);
  });

  it("a running order adds +1 week to the player's own builds", () => {
    const s: GameState = { ...newGame(9), legacy: 1 }; // legacy>0 → firstEver fast path off
    const withOrder: GameState = {
      ...s,
      activeSideOrder: { ...generateSideOrder(9, 30, 1), startedWeek: s.week },
    };
    expect(buildWeeksFor(withOrder)).toBe(buildWeeksFor(s) + 1);
  });

  it("completion pays units × fee and counts the delivery", () => {
    const seed = 9;
    const order = { ...generateSideOrder(seed, 30, 1), startedWeek: 0 };
    const s: GameState = { ...newGame(seed), week: order.startedWeek + order.weeksNeeded - 1, nextEventWeek: 9_999, activeSideOrder: order, factoryFloor: demoFloor() };
    const next = advanceOneWeek(s);
    expect(next.activeSideOrder ?? null).toBeNull();
    expect(next.sideOrdersCompleted).toBe(1);
    const gained = toDollars(next.cash) - toDollars(s.cash);
    // payout minus the week's burn — the payout must dominate.
    expect(gained).toBeGreaterThan(toDollars(sideOrderPayout(order)) * 0.5);
  });

  it("cancelling bills the fee and frees the line", () => {
    const order = { ...generateSideOrder(3, 30, 1), startedWeek: 5 };
    const s: GameState = { ...newGame(3), week: 6, cash: dollars(50_000), activeSideOrder: order };
    const res = cancelSideOrder(s);
    expect(res.ok).toBe(true);
    expect(res.state.activeSideOrder ?? null).toBeNull();
    const fee = Math.round(sideOrderPayout(order) * SIDE_ORDER_CANCEL_PCT);
    expect(toDollars(s.cash) - toDollars(res.state.cash)).toBeCloseTo(fee / 100, 2);
    // Decline is free.
    const withOffer: GameState = { ...s, activeSideOrder: null, pendingSideOrder: generateSideOrder(3, 40, 1) };
    const declined = declineSideOrder(withOffer);
    expect(declined.pendingSideOrder ?? null).toBeNull();
    expect(declined.cash).toBe(withOffer.cash);
  });

  it("starterFloor lacks the machines every client asks for (the tease works)", () => {
    // Every client requires at least one processing machine the bare floor doesn't have.
    for (let w = 16; w < 60; w++) {
      const offer = generateSideOrder(1, w, 1);
      const present = new Set(starterFloor().machines.map((m) => m.kind));
      expect(offer.requiredKinds.some((k) => !present.has(k))).toBe(true);
    }
  });
});
