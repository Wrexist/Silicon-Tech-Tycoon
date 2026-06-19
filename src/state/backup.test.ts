// Complete backup: export/import carries the game save AND profile progression, with back-compat
// for bare (pre-profile) export strings. The wrapper logic is pure (base64/JSON) — no localStorage.
import { describe, it, expect } from "vitest";
import { exportSaveString, importSaveString, importProfileFromString } from "./persistence.ts";
import { newGame } from "./gameState.ts";

const profile = {
  legacy: 3,
  scenarioStars: { "first-light": 3, bootstrapped: 1 },
  challengeBests: { "daily:2026-06-19": 1_500_000 },
  museum: [{ key: "k1", product: { id: "p1", category: "phone" }, name: "Aurora One", category: "phone", era: 1, companyName: "Silicon", week: 5 }],
};

describe("complete backup round-trip", () => {
  it("restores both the save and the profile bundle", () => {
    const state = { ...newGame(123), week: 40, companyName: "Acme" };
    const str = exportSaveString(state, profile);

    const restored = importSaveString(str);
    expect(restored).not.toBe(null);
    expect(restored!.companyName).toBe("Acme");
    expect(restored!.week).toBe(40);

    expect(importProfileFromString(str)).toEqual(profile);
  });

  it("a bare export (no profile) still imports as a state, with no profile", () => {
    const state = newGame(7);
    const bare = exportSaveString(state); // no profile arg → bare state, back-compat output
    expect(importSaveString(bare)).not.toBe(null);
    expect(importProfileFromString(bare)).toBe(null);
  });

  it("tolerates garbage", () => {
    expect(importSaveString("not-a-backup")).toBe(null);
    expect(importProfileFromString("not-a-backup")).toBe(null);
  });
});
