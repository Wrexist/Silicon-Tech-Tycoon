// The free ⇄ Pro line, pinned. These tests are the contract between the business model and the
// code: if someone widens or narrows the free tier, a test here has to change with it, deliberately.
import { describe, expect, it } from "vitest";
import {
  FREE_TIER,
  PRO_BENEFITS,
  eraAdvanceLocked,
  isLocked,
  paywallCopy,
  scenarioLocked,
  type ProFeature,
} from "./proGates.ts";
import { SCENARIOS } from "../engine/scenarios.ts";
import { BALANCE } from "../engine/balance.ts";

const ALL_FEATURES: ProFeature[] = [
  "eraAdvance",
  "scenario",
  "newGamePlus",
  "ascension",
  "creativeMode",
  "platformDivision",
  "vault",
  "museum",
  "mastery",
  "founderLegend",
  "challengeArchive",
];

describe("Pro unlocks everything", () => {
  it("locks nothing for a subscriber", () => {
    for (const f of ALL_FEATURES) expect(isLocked(f, true)).toBe(false);
    expect(eraAdvanceLocked(1, true)).toBe(false);
    expect(eraAdvanceLocked(4, true)).toBe(false);
    for (const s of SCENARIOS) expect(scenarioLocked(s.id, true)).toBe(false);
  });

  it("locks every gated feature for a free player", () => {
    for (const f of ALL_FEATURES) expect(isLocked(f, false)).toBe(true);
  });
});

describe("the era wall", () => {
  it("lets a free player play the Garage Era through to the end of the Growth Era", () => {
    // Era 1 → 2 is free: the free tier is a real game, not a one-era trial.
    expect(eraAdvanceLocked(1, false)).toBe(false);
  });

  it("stops a free player at the Platform Era", () => {
    expect(eraAdvanceLocked(FREE_TIER.maxEra, false)).toBe(true);
    expect(eraAdvanceLocked(FREE_TIER.maxEra + 1, false)).toBe(true);
  });

  it("puts the wall at an era that actually exists and is genuinely earned", () => {
    const gate = BALANCE.eras.find((e) => e.era === FREE_TIER.maxEra);
    expect(gate).toBeDefined();
    // Reaching it takes real reputation AND real revenue — hours of play, not minutes. If this
    // assertion ever fails, the free tier has quietly become a demo.
    expect(gate!.repToAdvance).toBeGreaterThanOrEqual(50);
    expect(FREE_TIER.maxEra).toBeGreaterThanOrEqual(2);
    expect(FREE_TIER.maxEra).toBeLessThan(BALANCE.eras.length);
  });
});

describe("scenarios", () => {
  it("gives free players real on-ramps, not zero", () => {
    expect(FREE_TIER.scenarioIds.length).toBeGreaterThanOrEqual(2);
    for (const id of FREE_TIER.scenarioIds) expect(scenarioLocked(id, false)).toBe(false);
  });

  it("only names scenarios that exist — a typo here would silently paywall a free scenario", () => {
    const known = new Set(SCENARIOS.map((s) => s.id));
    for (const id of FREE_TIER.scenarioIds) expect(known.has(id)).toBe(true);
  });

  it("locks the rest for free players", () => {
    const free = new Set(FREE_TIER.scenarioIds);
    const paid = SCENARIOS.filter((s) => !free.has(s.id));
    expect(paid.length).toBeGreaterThan(0);
    for (const s of paid) expect(scenarioLocked(s.id, false)).toBe(true);
  });

  it("keeps the free scenarios the gentlest ones — the on-ramp must not be the hard mode", () => {
    for (const id of FREE_TIER.scenarioIds) {
      const s = SCENARIOS.find((x) => x.id === id)!;
      expect(["intro", "standard"]).toContain(s.difficulty);
    }
  });
});

describe("daily challenges stay free", () => {
  it("keeps today's challenge outside the paywall", () => {
    // The daily is the retention loop and the notification payload. Gating it would make the one
    // reason to open the app tomorrow a thing you can't do.
    expect(FREE_TIER.dailyChallenge).toBe(true);
  });
});

describe("paywall copy", () => {
  it("has a headline for every reason a gate can raise", () => {
    for (const f of [...ALL_FEATURES, "onboarding" as const]) {
      const c = paywallCopy(f);
      expect(c.title.trim().length).toBeGreaterThan(0);
      expect(c.body.trim().length).toBeGreaterThan(0);
      expect(c.eyebrow.trim().length).toBeGreaterThan(0);
    }
  });

  it("never manufactures urgency", () => {
    // No countdowns, no "limited time", no fake scarcity. The same products are always available at
    // the same price, so any urgency framing would be a lie — and a dark pattern this project has
    // explicitly promised not to ship.
    const banned = /limited time|hurry|expires in|only today|last chance|\d+ hours left|act now/i;
    for (const f of [...ALL_FEATURES, "onboarding" as const]) {
      const c = paywallCopy(f);
      expect(`${c.eyebrow} ${c.title} ${c.body}`).not.toMatch(banned);
    }
  });

  it("lists benefits that are all real, non-empty promises", () => {
    expect(PRO_BENEFITS.length).toBeGreaterThanOrEqual(6);
    for (const b of PRO_BENEFITS) {
      expect(b.title.trim().length).toBeGreaterThan(0);
      expect(b.body.trim().length).toBeGreaterThan(0);
    }
  });

  it("still promises no ads — the brand's whole wedge survives the move to free", () => {
    const all = PRO_BENEFITS.map((b) => `${b.title} ${b.body}`).join(" ").toLowerCase();
    expect(all).toContain("no ads");
  });
});
