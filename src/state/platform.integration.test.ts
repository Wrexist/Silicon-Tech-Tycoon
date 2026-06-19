// State-layer Platform division: entitlement gate, OS naming, version-release reward + gating.
import { describe, it, expect } from "vitest";
import {
  newGame,
  unlockPlatform,
  setOsName,
  releaseOsVersion,
  osDisplayName,
  osTierInfo,
  canReleaseOsVersion,
} from "./gameState.ts";
import { BALANCE } from "../engine/balance.ts";

describe("platform entitlement + naming", () => {
  it("defaults locked, with a derived OS name", () => {
    const g = newGame(1);
    expect(g.platformUnlocked).toBe(false);
    expect(g.osName).toBe("");
    expect(osDisplayName(g)).toBe("Silicon OS"); // default company name
  });

  it("unlock toggles the entitlement; setOsName overrides the display name", () => {
    let g = unlockPlatform(newGame(1), true);
    expect(g.platformUnlocked).toBe(true);
    g = setOsName(g, "Nucleus");
    expect(g.osName).toBe("Nucleus");
    expect(osDisplayName(g)).toBe("Nucleus");
    g = setOsName(g, "   ");
    expect(osDisplayName(g)).toBe("Silicon OS"); // blank falls back
  });
});

describe("releaseOsVersion", () => {
  it("is a no-op while locked, or when research hasn't moved ahead", () => {
    const locked = { ...newGame(1), researched: { software: 3 } };
    expect(releaseOsVersion(locked)).toBe(locked); // platform locked

    const unlockedUpToDate = unlockPlatform({ ...newGame(1), researched: { software: 1 }, osVersion: 1 }, true);
    expect(canReleaseOsVersion(unlockedUpToDate)).toBe(false);
    expect(releaseOsVersion(unlockedUpToDate)).toBe(unlockedUpToDate);
  });

  it("catches the version up to research and grants the bounded rep/fan reward", () => {
    const g = unlockPlatform({ ...newGame(1), researched: { software: 3 }, osVersion: 1, reputation: 40, fans: 1000 }, true);
    expect(osTierInfo(g).tier).toBe(3);
    expect(canReleaseOsVersion(g)).toBe(true);

    const after = releaseOsVersion(g);
    expect(after.osVersion).toBe(3);
    expect(after.reputation).toBe(40 + BALANCE.platform.releaseRepBonus);
    expect(after.fans).toBe(1000 + BALANCE.platform.releaseFanBaseBonus); // 0 installed base → base bonus
    expect(canReleaseOsVersion(after)).toBe(false); // now up to date
  });

  it("clamps reputation at 100", () => {
    const g = unlockPlatform({ ...newGame(1), researched: { software: 2 }, osVersion: 1, reputation: 99 }, true);
    expect(releaseOsVersion(g).reputation).toBe(100);
  });
});
