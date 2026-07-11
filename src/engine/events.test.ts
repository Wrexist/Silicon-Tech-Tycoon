import { describe, it, expect } from "vitest";
import { CHOICE_EVENTS, MARKET_EVENTS, pickChoiceEvent } from "./events.ts";
import { makeRng } from "./rng.ts";

const TONES = new Set(["positive", "negative", "neutral", "accent"]);

describe("choice events catalog", () => {
  it("has unique ids", () => {
    const ids = CHOICE_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every event is well-formed (two distinct options, valid tone, sane era)", () => {
    for (const e of CHOICE_EVENTS) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.body.length).toBeGreaterThan(0);
      expect(TONES.has(e.tone)).toBe(true);
      expect(e.minEra).toBeGreaterThanOrEqual(1);
      expect(e.options.length).toBe(2);
      expect(e.options[0].id).not.toBe(e.options[1].id);
      for (const opt of e.options) {
        expect(opt.label.length).toBeGreaterThan(0);
        expect(opt.description.length).toBeGreaterThan(0);
        expect(opt.effect.kind.length).toBeGreaterThan(0);
      }
    }
  });

  it("never re-offers a resolved choice, and dries up once all are resolved", () => {
    const era = 3;
    // Flag-gated events (item 5.9) can't be offered without their flag, so they're not in the drainable
    // pool when no flags are supplied.
    const eligible = CHOICE_EVENTS.filter((e) => e.minEra <= era && !e.requiresFlag).map((e) => e.id);
    const rng = makeRng(123);
    const resolved: string[] = [];
    // Drain the pool: each pick must be a fresh, era-eligible event.
    for (let i = 0; i < 400 && resolved.length < eligible.length; i++) {
      const ev = pickChoiceEvent(rng, era, resolved);
      if (!ev) continue;
      expect(resolved).not.toContain(ev.id);
      expect(eligible).toContain(ev.id);
      resolved.push(ev.id);
    }
    expect(resolved.sort()).toEqual([...eligible].sort());
    // Pool exhausted → always null thereafter.
    for (let i = 0; i < 50; i++) {
      expect(pickChoiceEvent(rng, era, resolved)).toBeNull();
    }
  });

  it("prefers never-seen dilemmas, then falls back to the full pool once all are seen", () => {
    const era = 4;
    const eligible = CHOICE_EVENTS.filter((e) => e.minEra <= era).map((e) => e.id);
    // Mark all but two dilemmas as seen across past companies; resolved-this-run is empty.
    const fresh = eligible.slice(0, 2);
    const seen = eligible.slice(2);
    const rng = makeRng(99);
    let sawFresh = 0;
    for (let i = 0; i < 500; i++) {
      const ev = pickChoiceEvent(rng, era, [], seen);
      if (ev) {
        // While unseen dilemmas remain, only those are offered.
        expect(fresh).toContain(ev.id);
        sawFresh++;
      }
    }
    expect(sawFresh).toBeGreaterThan(0);
    // Once EVERY eligible dilemma is seen, the full pool is used again (events never dry up).
    const rng2 = makeRng(99);
    let sawAnyWhenAllSeen = 0;
    for (let i = 0; i < 500; i++) {
      if (pickChoiceEvent(rng2, era, [], eligible)) sawAnyWhenAllSeen++;
    }
    expect(sawAnyWhenAllSeen).toBeGreaterThan(0);
  });

  it("still excludes resolved-this-run dilemmas even when they are unseen", () => {
    const era = 1;
    const eligible = CHOICE_EVENTS.filter((e) => e.minEra <= era).map((e) => e.id);
    const resolved = [eligible[0]];
    const rng = makeRng(5);
    for (let i = 0; i < 500; i++) {
      const ev = pickChoiceEvent(rng, era, resolved, []);
      if (ev) expect(ev.id).not.toBe(eligible[0]);
    }
  });

  it("respects era gating (era-1 player never sees an era-3 dilemma)", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const ev = pickChoiceEvent(rng, 1, []);
      if (ev) expect(ev.minEra).toBeLessThanOrEqual(1);
    }
  });

  it("market events are all well-formed", () => {
    for (const e of MARKET_EVENTS) {
      expect(e.weight).toBeGreaterThan(0);
      expect(TONES.has(e.tone)).toBe(true);
      expect(e.minEra).toBeGreaterThanOrEqual(1);
    }
  });
});
