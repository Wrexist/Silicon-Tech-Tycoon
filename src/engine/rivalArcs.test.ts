// Rival story arcs (Track B): rivals drift through ascending/peaking/declining/stable phases, their
// reputation rising and falling WITHIN a bounded envelope around their calibrated base. These tests
// pin the envelope (so the stock market stays zero-EV), the mean-reversion, and the feed beats.
import { describe, expect, it } from "vitest";
import { advanceCompetitors, initCompetitors, rivalDef, type ArcBeat } from "./competitors.ts";
import { makeRng } from "./rng.ts";
import { BALANCE } from "./balance.ts";
import type { CompetitorState } from "./types.ts";

/** Run the weekly competitor sim for `weeks`, collecting every arc beat emitted along the way. */
function run(weeks: number, seed: number): { end: CompetitorState[]; beats: ArcBeat[]; series: Map<string, number[]> } {
  const rng = makeRng(seed);
  let cur = initCompetitors(rng);
  const beats: ArcBeat[] = [];
  const series = new Map<string, number[]>(cur.map((c) => [c.id, []]));
  for (let w = 1; w <= weeks; w++) {
    const r = advanceCompetitors(cur, w, 1, rng);
    cur = r.competitors;
    beats.push(...r.arcBeats);
    for (const c of cur) series.get(c.id)!.push(c.reputation);
  }
  return { end: cur, beats, series };
}

describe("rival story arcs (Track B)", () => {
  it("reputation never escapes the bounded envelope around the rival's base", () => {
    const arc = BALANCE.competitors.arc;
    const { series } = run(600, 11);
    for (const c of initCompetitors(makeRng(11))) {
      const base = rivalDef(c.id)!.reputation;
      const lo = Math.max(arc.repFloor, base - arc.repBand) - 1; // -1 slack for the single-step drift
      const hi = Math.min(arc.repCeil, base + arc.repBand) + 1;
      for (const rep of series.get(c.id)!) {
        expect(rep).toBeGreaterThanOrEqual(lo);
        expect(rep).toBeLessThanOrEqual(hi);
      }
    }
  });

  it("the arc actually MOVES reputation (rivals are not static stat-bags)", () => {
    const { series } = run(400, 7);
    for (const [, reps] of series) {
      const spread = Math.max(...reps) - Math.min(...reps);
      expect(spread).toBeGreaterThan(4); // a real rise-and-fall, not noise
    }
  });

  it("long-run reputation mean-reverts to ~the calibrated base", () => {
    const { series } = run(800, 99);
    for (const c of initCompetitors(makeRng(99))) {
      const reps = series.get(c.id)!;
      const mean = reps.reduce((a, b) => a + b, 0) / reps.length;
      const base = rivalDef(c.id)!.reputation;
      expect(Math.abs(mean - base)).toBeLessThan(BALANCE.competitors.arc.repBand); // stays inside the band, centred near base
    }
  });

  it("emits feed beats at real transitions, never the silent bootstrap, never on 'stable'", () => {
    const { beats } = run(400, 3);
    expect(beats.length).toBeGreaterThan(0);
    // Week-1 is the bootstrap roll for all rivals → it must be silent.
    expect(beats.filter((b) => b.week === 1)).toHaveLength(0);
    // Beat wording is tied to the dramatic phases only (ascending/peaking/declining), so the tone set
    // is exactly {negative, positive} — a "stable" transition produces no beat.
    for (const b of beats) expect(["negative", "positive"]).toContain(b.tone);
  });

  it("is deterministic: same seed → identical reputations and beats", () => {
    const a = run(300, 21);
    const b = run(300, 21);
    expect(b.end.map((c) => c.reputation)).toEqual(a.end.map((c) => c.reputation));
    expect(b.beats).toEqual(a.beats);
  });
});
