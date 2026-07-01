import { describe, it, expect } from "vitest";
import { makeRng } from "./rng.ts";

// Determinism is the load-bearing property of the whole engine: replays, scenarios, and the balance
// sim all depend on the exact mulberry32 stream. These tests pin the sequence for a known seed so an
// accidental algorithm change fails loudly instead of silently reshuffling every save.
describe("rng: mulberry32 determinism", () => {
  it("produces a fixed sequence for a known seed (pins the algorithm)", () => {
    const r = makeRng(12345);
    const seq = [r.next(), r.next(), r.next(), r.next()];
    expect(seq.map((x) => x.toFixed(15))).toEqual([
      "0.979728267760947",
      "0.306752264499664",
      "0.484205421525985",
      "0.817934412509203",
    ]);
  });

  it("is reproducible: two rngs with the same seed yield identical streams", () => {
    const a = makeRng(999);
    const b = makeRng(999);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it("diverges for different seeds", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    const sa = Array.from({ length: 10 }, () => a.next());
    const sb = Array.from({ length: 10 }, () => b.next());
    expect(sa).not.toEqual(sb);
  });

  it("next() stays in [0, 1)", () => {
    const r = makeRng(42);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(m) stays in [0, m) and range(min, max) in [min, max)", () => {
    const r = makeRng(7);
    for (let i = 0; i < 2000; i++) {
      const n = r.int(6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
      const f = r.range(10, 20);
      expect(f).toBeGreaterThanOrEqual(10);
      expect(f).toBeLessThan(20);
    }
  });

  // The save-continuity contract: persisting state() and re-seeding from it must resume the SAME
  // stream. This is what lets a game reload mid-run without the sim diverging from its seed path.
  it("state() round-trips: reseeding from a captured state continues the same stream", () => {
    const live = makeRng(12345);
    live.next();
    live.next();
    const snapshot = live.state();
    const restored = makeRng(snapshot);
    for (let i = 0; i < 100; i++) expect(restored.next()).toBe(live.next());
  });

  // rngState of 0 is a VALID mulberry32 state. gameState.rngFrom uses `?? seed` (not `|| seed`) so a
  // legitimately-zero state is preserved rather than being treated as falsy and reset to the seed.
  // Guard that a zero seed produces a real, non-degenerate stream and a well-formed uint state.
  it("seed 0 is valid and non-degenerate", () => {
    const r = makeRng(0);
    expect([r.next(), r.next(), r.next()].map((x) => x.toFixed(6))).toEqual([
      "0.266429",
      "0.000330",
      "0.223272",
    ]);
  });

  it("state() is always an unsigned 32-bit integer", () => {
    const r = makeRng(-1);
    for (let i = 0; i < 100; i++) {
      const s = r.state();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(0xffffffff);
      r.next();
    }
  });
});
