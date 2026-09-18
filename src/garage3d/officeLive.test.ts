// Contract test for the office's cosmetic derived-hash helpers (Wave 7). Pure functions only — this
// locks the seed→value mapping so the character pose / bubble schedule can't drift silently. The
// streams are presentation-only and never read by the engine, but the same hash recipe must hold.
import { describe, expect, it } from "vitest";
import { cosmeticHash01, workTargetFor } from "./officeLive.ts";

describe("officeLive — cosmetic derived hash", () => {
  it("is deterministic and in [0,1)", () => {
    for (let salt = 400; salt < 445; salt++) {
      const a = cosmeticHash01(7, 28, salt);
      expect(a).toBe(cosmeticHash01(7, 28, salt));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it("moves with the week and the salt (no two streams collapse together)", () => {
    expect(cosmeticHash01(7, 28, 401)).not.toBe(cosmeticHash01(7, 29, 401));
    expect(cosmeticHash01(7, 28, 401)).not.toBe(cosmeticHash01(7, 28, 419));
    expect(cosmeticHash01(7, 28, 401)).not.toBe(cosmeticHash01(7, 28, 311)); // no collision with an in-use salt
  });

  it("workTargetFor is a 0/1 idle-vs-working pick, independent per character key", () => {
    // Seated character keys for the staged save (seeds i*2.1, i=0..3) rounded to integers.
    const keys = [0, 2100, 4200, 6300];
    for (const key of keys) {
      const v = workTargetFor(7, 28, key);
      expect(v === 0 || v === 1).toBe(true);
      expect(workTargetFor(7, 28, key)).toBe(v); // stable
    }
    // Locked table: two of four flip between weeks 28 and 33 (the pair the frames demonstrated).
    expect(keys.map((k) => workTargetFor(7, 28, k))).toEqual([1, 1, 0, 1]);
    expect(keys.map((k) => workTargetFor(7, 33, k))).toEqual([1, 0, 1, 1]);
  });
});
