// Home-save holdout: a challenge/scenario is a side trip, not a company-wipe. The player's freeform
// company is stashed to a SEPARATE key before the challenge takes over the main slot, so it survives
// the challenge autosave and can be restored one-tap ("return to your company"). vitest runs in the
// node env here (no jsdom), so we stub localStorage on globalThis (mirrors persistence.test.ts).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dollars } from "../engine/money.ts";
import { newGame, newChallengeGame } from "./gameState.ts";

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

const KEY = "silicon.save.v1";
const HOME_KEY = `${KEY}.home`;

let mem: MemStorage;
beforeEach(() => {
  mem = new MemStorage();
  // @ts-expect-error stubbing the global for the node test env
  globalThis.localStorage = mem;
  vi.resetModules();
});

async function fresh() { return await import("./persistence.ts"); }

describe("home save — challenge preserves the freeform company", () => {
  it("stash → read round-trips the exact company", async () => {
    const { stashHomeSave, readHomeSave, hasHomeSave } = await fresh();
    const company = { ...newGame(4242), onboarded: true, companyName: "Delta Co", cash: dollars(2_670_000), week: 263 };

    expect(hasHomeSave()).toBe(false);
    stashHomeSave(company);
    expect(hasHomeSave()).toBe(true);

    const restored = readHomeSave();
    expect(restored).not.toBeNull();
    expect(restored!.companyName).toBe("Delta Co");
    expect(restored!.cash).toBe(company.cash);
    expect(restored!.week).toBe(263);
    expect(restored!.seed).toBe(company.seed);
  });

  it("the challenge overwriting the MAIN slot never touches the stashed company", async () => {
    const { stashHomeSave, readHomeSave, save } = await fresh();
    const company = { ...newGame(1), onboarded: true, companyName: "My Studio", week: 200, cash: dollars(9_999_999) };
    stashHomeSave(company);

    // Simulate the challenge run repeatedly autosaving onto the main KEY (what happens in-game).
    const challenge = newChallengeGame("daily", "2026-07-09");
    save(challenge);
    save({ ...challenge, week: 10 });
    save({ ...challenge, week: 20 });

    // The main slot is the challenge; the holdout is still the untouched freeform company.
    expect(localStorage.getItem(KEY)).not.toBeNull();
    const home = readHomeSave();
    expect(home!.companyName).toBe("My Studio");
    expect(home!.week).toBe(200);
    expect(home!.activeChallenge).toBeNull(); // it's the freeform company, not a challenge run
  });

  it("clearHomeSave removes the holdout (return-home consumed it)", async () => {
    const { stashHomeSave, clearHomeSave, hasHomeSave, readHomeSave } = await fresh();
    stashHomeSave({ ...newGame(7), onboarded: true });
    expect(hasHomeSave()).toBe(true);
    clearHomeSave();
    expect(hasHomeSave()).toBe(false);
    expect(readHomeSave()).toBeNull();
  });

  it("clearSave (challenge start) does NOT wipe the stashed company", async () => {
    const { stashHomeSave, clearSave, hasHomeSave } = await fresh();
    stashHomeSave({ ...newGame(3), onboarded: true, companyName: "Kept" });
    clearSave(); // challenge start clears the MAIN slot only
    expect(hasHomeSave()).toBe(true);
  });

  it("readHomeSave returns null for a corrupt / versionless holdout (falls back gracefully)", async () => {
    const { readHomeSave } = await fresh();
    localStorage.setItem(HOME_KEY, JSON.stringify({ not: "a real save" }));
    expect(readHomeSave()).toBeNull();
  });
});
