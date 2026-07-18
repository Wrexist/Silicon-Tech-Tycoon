import { describe, it, expect } from "vitest";
import {
  advanceOneWeek,
  attemptMoonshot,
  designBudget,
  designTierCeiling,
  moonshotAttemptable,
  newGame,
  prestigeBonuses,
  weeklyRpGen,
  type GameState,
} from "./gameState.ts";
import {
  MOONSHOT_COOLDOWN_WEEKS,
  moonshotById,
  moonshotRefund,
  resolveMoonshot,
} from "../engine/moonshots.ts";

// feed ids embed a climbing module-level counter (same trick the 160-week pin uses) — compare the rest.
function norm(s: GameState) {
  return { ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) };
}

/** A late-game company with plenty of RP, parked at a given week, ready to attempt any moonshot. */
function lab(seed: number, week: number, era = 4): GameState {
  return { ...newGame(seed), era, week, researchPoints: 6000 };
}

/** First week ≥ `from` where `id` rolls to the wanted success/failure at this seed. */
function findWeek(seed: number, id: string, want: boolean, from = 30): number {
  for (let w = from; w < from + 500; w++) if (resolveMoonshot(seed, w, id) === want) return w;
  throw new Error(`no ${want ? "success" : "failure"} week found for ${id}`);
}

describe("moonshots integration — determinism + rewards", () => {
  it("(a) a run that never attempts is byte-identical with the fields present vs absent (do-nothing no-op)", () => {
    const withField = newGame(31337);
    const oldSave = structuredClone(withField);
    delete (oldSave as { moonshotsWon?: unknown }).moonshotsWon;
    delete (oldSave as { moonshotAttempts?: unknown }).moonshotAttempts;

    const run = (s0: GameState) => {
      let s = s0;
      for (let w = 0; w < 12; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run(withField);
    const b = run(oldSave);
    const strip = (s: GameState) => {
      const n = norm(s) as Partial<GameState>;
      delete n.moonshotsWon;
      delete n.moonshotAttempts;
      return n;
    };
    expect(strip(a)).toEqual(strip(b));
  });

  it("(b) a SUCCESS replays byte-identical twice and banks the reward once-per-run", () => {
    const seed = 8080;
    const id = "neuralLattice"; // reward: design ceiling +1
    const week = findWeek(seed, id, true);
    const start = lab(seed, week);
    const clone = structuredClone(start);

    const before = designTierCeiling(start);
    const res = attemptMoonshot(start, id);
    expect(res.ok).toBe(true);
    expect(res.moonshotOutcome).toBe("success");
    expect(res.state.moonshotsWon).toContain(id);
    // Full RP cost spent on a win.
    expect(res.state.researchPoints).toBe(start.researchPoints - moonshotById(id)!.rpCost);
    // The reward folds through the live selector: design ceiling is +1.
    expect(designTierCeiling(res.state)).toBe(before + 1);
    expect(prestigeBonuses(res.state).designCeiling).toBe(prestigeBonuses(start).designCeiling + 1);

    // Deterministic replay from an identical clone.
    const res2 = attemptMoonshot(clone, id);
    expect(norm(res2.state)).toEqual(norm(res.state));

    // Once-per-run: a second attempt after winning is refused (not re-rolled).
    const again = attemptMoonshot(res.state, id);
    expect(again.ok).toBe(false);
    expect(again.moonshotOutcome).toBeUndefined();
    expect(again.state).toBe(res.state);
  });

  it("(b2) a windfall SUCCESS applies its one-time fan + reputation surge", () => {
    const seed = 246813;
    const id = "culturalMoment";
    const m = moonshotById(id)!;
    const week = findWeek(seed, id, true);
    const start = { ...lab(seed, week, 3), reputation: 40 };
    const res = attemptMoonshot(start, id);
    expect(res.moonshotOutcome).toBe("success");
    expect(res.state.fans).toBe(start.fans + (m.reward.fans ?? 0));
    expect(res.state.reputation).toBe(start.reputation + (m.reward.reputation ?? 0));
  });

  it("(c) a FAILURE replays identically, refunds the pity RP, and the cooldown gates the retry", () => {
    const seed = 5150;
    const id = "zeroWaste";
    const cost = moonshotById(id)!.rpCost;
    const refund = moonshotRefund(cost);
    const week = findWeek(seed, id, false);
    const start = lab(seed, week);
    const clone = structuredClone(start);

    const res = attemptMoonshot(start, id);
    expect(res.ok).toBe(true);
    expect(res.moonshotOutcome).toBe("failure");
    expect(res.state.moonshotsWon).not.toContain(id);
    // Most of the RP burns; only the pity refund comes back.
    expect(res.state.researchPoints).toBe(start.researchPoints - (cost - refund));
    expect(res.state.moonshotAttempts?.[id]).toBe(week);

    // Replays byte-identical from the clone.
    const res2 = attemptMoonshot(clone, id);
    expect(norm(res2.state)).toEqual(norm(res.state));

    // Immediate retry is blocked by the cooldown.
    expect(moonshotAttemptable(res.state, id)).toBe(false);
    const blocked = attemptMoonshot(res.state, id);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toMatch(/cooldown/i);
    expect(blocked.state).toBe(res.state);

    // After the cooldown elapses the moonshot can be attempted (and rolled) again.
    const retryWeek = week + MOONSHOT_COOLDOWN_WEEKS;
    const cooled: GameState = { ...res.state, week: retryWeek };
    expect(moonshotAttemptable(cooled, id)).toBe(true);
    const retry = attemptMoonshot(cooled, id);
    expect(retry.ok).toBe(true);
    expect(retry.moonshotOutcome).toBe(resolveMoonshot(seed, retryWeek, id) ? "success" : "failure");
  });

  it("(d) an old save (fields absent) attempts correctly and reads as neutral in the selectors", () => {
    const seed = 1234;
    const id = "genFoundry"; // reward: +3 EP design budget
    const week = findWeek(seed, id, true);
    const start = lab(seed, week);
    // Simulate a pre-feature save: strip the optional fields entirely.
    const old = structuredClone(start) as Partial<GameState>;
    delete old.moonshotsWon;
    delete old.moonshotAttempts;
    const oldState = old as GameState;

    // Selectors treat absent fields as the neutral bonus.
    expect(designBudget(oldState)).toBe(designBudget({ ...oldState, moonshotsWon: [] }));

    const res = attemptMoonshot(oldState, id);
    expect(res.ok).toBe(true);
    expect(res.moonshotOutcome).toBe("success");
    expect(res.state.moonshotsWon).toEqual([id]);
    // The EP-budget reward folds through the design-budget selector.
    expect(designBudget(res.state)).toBe(designBudget(oldState) + 3);
  });

  it("guards: era gate, affordability, and unknown ids are refused (unrolled)", () => {
    const seed = 42;
    const id = "quantumCluster"; // era 4
    const week = findWeek(seed, id, true);
    // Era too low.
    const early = attemptMoonshot(lab(seed, week, 3), id);
    expect(early.ok).toBe(false);
    expect(early.moonshotOutcome).toBeUndefined();
    // Can't afford.
    const broke = attemptMoonshot({ ...lab(seed, week, 4), researchPoints: 10 }, id);
    expect(broke.ok).toBe(false);
    expect(broke.reason).toMatch(/RP/);
    // Unknown id.
    expect(attemptMoonshot(lab(seed, week), "nope").ok).toBe(false);
  });

  it("a won RP-multiplier moonshot raises weekly RP income", () => {
    const seed = 71071;
    const id = "quantumCluster";
    const week = findWeek(seed, id, true);
    const start = lab(seed, week);
    const before = weeklyRpGen(start);
    const res = attemptMoonshot(start, id);
    expect(res.moonshotOutcome).toBe("success");
    expect(weeklyRpGen(res.state)).toBeGreaterThan(before);
  });
});
