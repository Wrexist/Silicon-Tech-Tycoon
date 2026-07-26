import { describe, it, expect } from "vitest";
import {
  DECRYPT_AT,
  ELATED_MOOD,
  ELATED_TEAM,
  OMEGA_SECRET_ID,
  QUIET_GAP,
  SECRETS,
  SECRET_COUNT,
  SECRET_COUNT_EXCEPT_OMEGA,
  STAGE_DECRYPTED,
  STAGE_RUMORED,
  STAGE_SEALED,
  STAGE_UNEARTHED,
  canInvestigate,
  deriveSecretFacts,
  investigationCost,
  naturalStage,
  newlyUnearthed,
  secretById,
  secretBonuses,
  secretProgress,
  secretStage,
  secretTitle,
  vaultWhisperLine,
  type SecretFacts,
} from "./secrets.ts";
import { newGame, type GameState } from "../state/gameState.ts";
import { dollars, toDollars } from "./money.ts";
import type { LaunchedProduct, Product } from "./types.ts";

/** A neutral fact sheet — every dossier reads "nothing achieved yet" off this. */
function zeroFacts(over: Partial<SecretFacts> = {}): SecretFacts {
  return {
    week: 40,
    era: 1,
    productsShipped: 0,
    hits: 0,
    categoriesShipped: 0,
    ghostHit: false,
    budgetHit: false,
    quietComeback: false,
    fiveFlagHit: false,
    perfectPricing: false,
    soldOutRuns: 0,
    elatedTeam: 0,
    contractsCompleted: 0,
    completedProjects: 0,
    iconicLineDepth: 0,
    deepestLineDepth: 0,
    osLicensees: 0,
    osLicenseesEver: 0,
    nemesisTrophies: 0,
    bestCeremonySweep: 0,
    rivalsHeld: 0,
    lowestCash: 500_000,
    cash: 500_000,
    found: 0,
    ...over,
  };
}

function product(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Aurora",
    category: "phone",
    tiers: { chip: 2, display: 2, battery: 2, materials: 2 },
    finish: "aluminium",
    colorIndex: 0,
    price: dollars(600),
    designTier: 1,
    camera: { count: 1, layout: "vertical", position: "topLeft", module: "squircle", flash: true },
    notch: "punch",
    ...over,
  };
}

function launched(over: Partial<LaunchedProduct> = {}): LaunchedProduct {
  return {
    product: product(),
    stats: { performance: 50, quality: 50, battery: 50, design: 50, ecosystem: 50 },
    unitCost: dollars(200),
    launchScore: 60,
    launchedWeek: 20,
    totalUnits: 10_000,
    weeklyUnits: [],
    unitsSold: 10_000,
    weeksElapsed: 16,
    revenueToDate: dollars(1_000_000),
    ...over,
  };
}

describe("catalog integrity", () => {
  it("has unique ids and a codename, whisper, requirement and reward on every file", () => {
    expect(new Set(SECRETS.map((s) => s.id)).size).toBe(SECRET_COUNT);
    for (const s of SECRETS) {
      expect(s.codename.length).toBeGreaterThan(0);
      expect(s.whisper.length).toBeGreaterThan(20); // a whisper has to actually tease something
      expect(s.requirement.length).toBeGreaterThan(10);
      expect(s.reward.label.length).toBeGreaterThan(0);
      expect(s.traceNeed).toBeGreaterThan(0);
      expect(s.traceUnit.length).toBeGreaterThan(0);
      expect([1, 2, 3, 4]).toContain(s.tier);
    }
  });

  it("has exactly one Omega file, and it is the completionist one", () => {
    const omega = SECRETS.filter((s) => s.tier === 4);
    expect(omega).toHaveLength(1);
    expect(omega[0].id).toBe(OMEGA_SECRET_ID);
    expect(SECRET_COUNT_EXCEPT_OMEGA).toBe(SECRET_COUNT - 1);
    // The Omega bar counts its siblings — the literal must track the catalog size.
    expect(secretById(OMEGA_SECRET_ID)!.traceNeed).toBe(SECRET_COUNT_EXCEPT_OMEGA);
  });

  it("no file is satisfied by a company that has done nothing (the do-nothing pin can't trip it)", () => {
    // Deliberately generous idle state: lots of cash, lots of weeks, zero player action.
    const idle = zeroFacts({ week: 400, era: 1, cash: 5_000_000, lowestCash: 4_900_000 });
    expect(newlyUnearthed(idle, [])).toEqual([]);
  });

  it("keeps the total boon small — the Vault complements the main tracks, never replaces them", () => {
    const all = secretBonuses(SECRETS.map((s) => s.id));
    expect(all.hype).toBeLessThanOrEqual(0.15);
    expect(all.rpMult).toBeLessThanOrEqual(0.25);
    expect(all.buildCostMult).toBeLessThanOrEqual(0.08);
    expect(all.designCeiling).toBeLessThanOrEqual(2);
    expect(all.epBudget).toBeLessThanOrEqual(2);
    expect(all.stat.design ?? 0).toBeLessThanOrEqual(2);
  });
});

describe("staged reveal", () => {
  const ghost = secretById("ghostSignal")!;

  it("starts sealed, whispers on the natural gate, decrypts halfway, opens when met", () => {
    expect(naturalStage(ghost, zeroFacts(), [])).toBe(STAGE_SEALED);
    // rumorAt: two products shipped. trace is still 0/2 → rumored, not decrypted.
    expect(naturalStage(ghost, zeroFacts({ productsShipped: 2 }), [])).toBe(STAGE_RUMORED);
    // One hit = 1 of 2 trace signs = exactly the decrypt threshold.
    expect(DECRYPT_AT).toBe(0.5);
    expect(naturalStage(ghost, zeroFacts({ productsShipped: 2, hits: 1 }), [])).toBe(STAGE_DECRYPTED);
    expect(naturalStage(ghost, zeroFacts(), ["ghostSignal"])).toBe(STAGE_UNEARTHED);
  });

  it("never lets the progress proxy claim completion the condition hasn't earned", () => {
    // Both trace signs present (a hit, and four products shipped) but no no-campaign hit → not met.
    const close = zeroFacts({ productsShipped: 6, hits: 3, ghostHit: false });
    const p = secretProgress(ghost, close);
    expect(ghost.met(close)).toBe(false);
    expect(p.have).toBe(p.need - 1); // clamped below completion
    expect(p.frac).toBeLessThan(1);
    // …and a met condition always reads complete, even if the proxy lags.
    const met = zeroFacts({ productsShipped: 2, hits: 1, ghostHit: true });
    expect(secretProgress(ghost, met).frac).toBe(1);
  });

  it("latches a stage so a file never re-seals when its trace regresses", () => {
    const insider = secretById("theInsider")!;
    const held = zeroFacts({ rivalsHeld: 4 });
    expect(secretStage(insider, held, [], {})).toBe(STAGE_DECRYPTED);
    // Shares sold — the natural read collapses, but the latch keeps what was already learned.
    const sold = zeroFacts({ rivalsHeld: 0 });
    expect(naturalStage(insider, sold, [])).toBe(STAGE_SEALED);
    expect(secretStage(insider, sold, [], { theInsider: STAGE_DECRYPTED })).toBe(STAGE_DECRYPTED);
  });

  it("bought intel can raise the reveal but never open a file", () => {
    const facts = zeroFacts();
    expect(secretStage(ghost, facts, [], { ghostSignal: STAGE_DECRYPTED })).toBe(STAGE_DECRYPTED);
    // Even an out-of-range latch is clamped below `unearthed`.
    expect(secretStage(ghost, facts, [], { ghostSignal: 9 })).toBe(STAGE_DECRYPTED);
  });

  it("prices intel by tier, charges double to decrypt, and never sells the Omega file", () => {
    const t1 = toDollars(investigationCost(1, STAGE_RUMORED));
    const t3 = toDollars(investigationCost(3, STAGE_RUMORED));
    expect(t3).toBeGreaterThan(t1);
    expect(toDollars(investigationCost(1, STAGE_DECRYPTED))).toBe(t1 * 2);
    expect(canInvestigate(ghost, STAGE_SEALED)).toBe(true);
    expect(canInvestigate(ghost, STAGE_DECRYPTED)).toBe(false);
    expect(canInvestigate(secretById(OMEGA_SECRET_ID)!, STAGE_SEALED)).toBe(false);
  });
});

describe("conditions", () => {
  it("Ghost Signal wants a hit with NO campaign — a hit with one doesn't count", () => {
    const facts = deriveSecretFacts({
      ...newGame(1),
      launched: [launched({ verdict: "hit", product: product({ channelId: "social" }) })],
    } as GameState);
    expect(facts.ghostHit).toBe(false);
    const bare = deriveSecretFacts({
      ...newGame(1),
      launched: [launched({ verdict: "hit", product: product({ channelId: "none" }) })],
    } as GameState);
    expect(bare.ghostHit).toBe(true);
  });

  it("The Quiet Year wants a hit AFTER a long silence, measured against the previous launch", () => {
    // launched[] is newest-first: [newest, …, oldest].
    const impatient = deriveSecretFacts({
      ...newGame(1),
      launched: [
        launched({ verdict: "hit", launchedWeek: 60 }),
        launched({ verdict: "solid", launchedWeek: 60 - (QUIET_GAP - 1) }),
      ],
    } as GameState);
    expect(impatient.quietComeback).toBe(false);
    const patient = deriveSecretFacts({
      ...newGame(1),
      launched: [
        launched({ verdict: "hit", launchedWeek: 60 }),
        launched({ verdict: "solid", launchedWeek: 60 - QUIET_GAP }),
      ],
    } as GameState);
    expect(patient.quietComeback).toBe(true);
  });

  it("The Night Shift wants the WHOLE team elated, not just most of it", () => {
    const base = newGame(1);
    const team = Array.from({ length: ELATED_TEAM }, (_, i) => ({ ...base.staff[0], id: `s${i}`, mood: ELATED_MOOD }));
    const all = deriveSecretFacts({ ...base, launched: [launched()], staff: team } as GameState);
    expect(all.elatedTeam).toBe(ELATED_TEAM);
    const oneGrumpy = deriveSecretFacts({
      ...base,
      launched: [launched()],
      staff: [...team.slice(1), { ...team[0], mood: 40 }],
    } as GameState);
    // The bar still climbs (so the player can see how close they are) but stops short of the team size.
    expect(oneGrumpy.elatedTeam).toBe(ELATED_TEAM - 1);
    expect(secretById("nightShift")!.met(oneGrumpy)).toBe(false);
  });

  it("The Phoenix File needs BOTH the near-death low and the recovery", () => {
    const phoenix = secretById("phoenixFile")!;
    expect(phoenix.met(zeroFacts({ lowestCash: 10_000, cash: 1_000_000 }))).toBe(false);
    expect(phoenix.met(zeroFacts({ lowestCash: 900_000, cash: 40_000_000 }))).toBe(false);
    expect(phoenix.met(zeroFacts({ lowestCash: 10_000, cash: 40_000_000 }))).toBe(true);
  });

  it("reads the near-death low out of the recorded cash history, not just today's balance", () => {
    const facts = deriveSecretFacts({
      ...newGame(1),
      cash: dollars(30_000_000),
      cashHistory: [{ week: 0, cash: 50_000 }, { week: 12, cash: 9_000 }, { week: 40, cash: 30_000_000 }],
      launched: [launched()],
    } as GameState);
    expect(facts.lowestCash).toBe(9_000);
    expect(secretById("phoenixFile")!.met(facts)).toBe(true);
  });

  it("The Founder's File opens only once every other file is open", () => {
    const omega = secretById(OMEGA_SECRET_ID)!;
    expect(omega.met(zeroFacts({ found: SECRET_COUNT_EXCEPT_OMEGA - 1 }))).toBe(false);
    expect(omega.met(zeroFacts({ found: SECRET_COUNT_EXCEPT_OMEGA }))).toBe(true);
  });
});

describe("rewards", () => {
  it("aggregates to exactly zero when nothing is open", () => {
    expect(secretBonuses(undefined)).toEqual(secretBonuses([]));
    const zero = secretBonuses([]);
    expect(zero.hype).toBe(0);
    expect(zero.rpMult).toBe(0);
    expect(zero.buildCostMult).toBe(0);
    expect(zero.designCeiling).toBe(0);
    expect(zero.epBudget).toBe(0);
    expect(zero.stat).toEqual({});
  });

  it("sums the opened files' boons and ignores unknown ids", () => {
    const both = secretBonuses(["ghostSignal", "theQuietYear", "nope"]);
    expect(both.hype).toBeCloseTo(0.05, 10);
    expect(both.rpMult).toBe(0);
  });

  it("keeps one-time Legacy Points OUT of the persistent aggregation", () => {
    const omega = secretBonuses([OMEGA_SECRET_ID]);
    expect(omega.designCeiling).toBe(1);
    expect((omega as unknown as { legacyPoints?: number }).legacyPoints).toBeUndefined();
  });

  it("awards the Vault title only for the file that carries one", () => {
    expect(secretTitle([])).toBeNull();
    expect(secretTitle(["ghostSignal"])).toBeNull();
    expect(secretTitle([OMEGA_SECRET_ID])).toBe("Keeper of the Vault");
  });
});

describe("whisper flavour", () => {
  it("is deterministic per (seed, week) and always a real line", () => {
    expect(vaultWhisperLine(4242, 31)).toBe(vaultWhisperLine(4242, 31));
    for (let w = 0; w < 40; w++) expect(vaultWhisperLine(99, w).length).toBeGreaterThan(10);
  });
});
