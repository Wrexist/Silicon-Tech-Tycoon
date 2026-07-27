import { describe, it, expect } from "vitest";
import {
  advanceOneWeek,
  designBudget,
  dismissSecretReveal,
  investigateSecret,
  markVaultSeen,
  newGame,
  noPendingInterrupt,
  prestigeBonuses,
  vaultBonuses,
  vaultCards,
  vaultSummary,
  type GameState,
} from "./gameState.ts";
import { dollars, toDollars } from "../engine/money.ts";
import {
  OMEGA_SECRET_ID,
  SECRET_COUNT,
  STAGE_DECRYPTED,
  STAGE_RUMORED,
  STAGE_SEALED,
  investigationCost,
  secretById,
} from "../engine/secrets.ts";
import type { LaunchedProduct, Product } from "../engine/types.ts";

// feed ids embed a climbing module-level counter (same trick the 160-week pin uses) — compare the rest.
function norm(s: GameState) {
  return { ...s, feed: s.feed.map((f) => ({ week: f.week, text: f.text, tone: f.tone })) };
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
    launchedWeek: 10,
    totalUnits: 10_000,
    weeklyUnits: [],
    unitsSold: 10_000,
    weeksElapsed: 40, // fully sold through, so the tick's sales math is a no-op
    revenueToDate: dollars(1_000_000),
    verdict: "solid",
    ...over,
  };
}

/** A shipped company parked at a week, with the Vault open and one dossier's condition satisfiable. */
function shipped(seed: number, over: Partial<GameState> = {}): GameState {
  return {
    ...newGame(seed),
    week: 60,
    cash: dollars(20_000_000),
    launched: [launched()],
    ...over,
  };
}

describe("the Vault — determinism + no-op safety", () => {
  it("(a) a run that never ships is byte-identical with the Vault fields present vs absent", () => {
    const withFields = newGame(31337);
    const oldSave = structuredClone(withFields);
    delete (oldSave as Partial<GameState>).vaultEnabled;
    delete (oldSave as Partial<GameState>).secretsFound;
    delete (oldSave as Partial<GameState>).secretStages;
    delete (oldSave as Partial<GameState>).secretsSeen;
    delete (oldSave as Partial<GameState>).pendingSecretReveal;

    const run = (s0: GameState) => {
      let s = s0;
      for (let w = 0; w < 24; w++) s = advanceOneWeek(s);
      return s;
    };
    const a = run(withFields);
    const b = run(oldSave);
    const strip = (s: GameState) => {
      const n = norm(s) as Partial<GameState>;
      delete n.vaultEnabled;
      delete n.secretsFound;
      delete n.secretStages;
      delete n.secretsSeen;
      delete n.pendingSecretReveal;
      return n;
    };
    expect(strip(a)).toEqual(strip(b));
    // Nothing shipped → the archive never even opened.
    expect(a.secretsFound).toEqual([]);
    expect(a.secretStages).toEqual({});
    expect(a.pendingSecretReveal ?? null).toBeNull();
  });

  it("(b) an existing save (vaultEnabled off) never opens a file, however much it has achieved", () => {
    // Six contracts delivered — Paper Trail's exact condition — but the flag is off.
    const legacySave = shipped(11, { vaultEnabled: false, contractsCompleted: 9 });
    const after = advanceOneWeek(legacySave);
    expect(after.secretsFound ?? []).toEqual([]);
    expect(after.pendingSecretReveal ?? null).toBeNull();
    expect(vaultBonuses(after)).toEqual(vaultBonuses(newGame(1)));
    expect(vaultSummary(after).open).toBe(false);
  });

  it("(c) opening a file replays byte-identical twice and banks its boon exactly once", () => {
    const start = shipped(8080, { contractsCompleted: 6 });
    const clone = structuredClone(start);

    const beforeRp = prestigeBonuses(start).rpMult;
    const a = advanceOneWeek(start);
    expect(a.secretsFound).toContain("paperTrail");
    expect(a.pendingSecretReveal?.ids).toContain("paperTrail");
    // The boon folds through the live selector.
    expect(prestigeBonuses(a).rpMult).toBeCloseTo(beforeRp + secretById("paperTrail")!.reward.rpMult!, 10);

    // Deterministic replay from an identical clone.
    const b = advanceOneWeek(clone);
    expect(norm(b)).toEqual(norm(a));

    // A second week doesn't re-open it or re-raise the ceremony.
    const c = advanceOneWeek(dismissSecretReveal(a));
    expect(c.secretsFound!.filter((id) => id === "paperTrail")).toHaveLength(1);
    expect(c.pendingSecretReveal ?? null).toBeNull();
  });

  it("(d) the reveal stamps the interrupt budget so nothing else piles onto the moment", () => {
    const s = advanceOneWeek(shipped(4242, { contractsCompleted: 6 }));
    expect(s.pendingSecretReveal).not.toBeNull();
    expect(s.lastInterruptWeek).toBe(s.week);
  });

  it("(e) a one-time Legacy Point reward is banked at the moment of discovery", () => {
    // Stage every other file as already open, so the Omega file completes this tick.
    const others = vaultCards(newGame(5)).filter((c) => c.id !== OMEGA_SECRET_ID).map((c) => c.id);
    const s = advanceOneWeek(shipped(5, { secretsFound: others, legacyPoints: 2 }));
    expect(s.secretsFound).toContain(OMEGA_SECRET_ID);
    expect(s.legacyPoints).toBe(2 + secretById(OMEGA_SECRET_ID)!.reward.legacyPoints!);
    expect(vaultSummary(s).title).toBe("Keeper of the Vault");
    // The structural half of that reward reaches the design ceiling via prestigeBonuses.
    expect(prestigeBonuses(s).designCeiling).toBeGreaterThan(prestigeBonuses(newGame(5)).designCeiling);
  });

  it("folds an EP dossier into the per-project design budget", () => {
    const base = shipped(77);
    const withEp = { ...base, secretsFound: ["theLongGame"] };
    expect(designBudget(withEp)).toBe(designBudget(base) + 1);
  });
});

describe("the Vault — buying intel", () => {
  it("charges cash, raises exactly one stage, and reveals progressively", () => {
    const s0 = shipped(909);
    const sealed = vaultCards(s0).find((c) => c.stage === STAGE_SEALED);
    expect(sealed).toBeDefined();
    expect(sealed!.codename).toBeNull();
    expect(sealed!.requirement).toBeNull();

    const cost = investigationCost(sealed!.tier, STAGE_RUMORED);
    const r1 = investigateSecret(s0, sealed!.id);
    expect(r1.ok).toBe(true);
    expect(toDollars(r1.state.cash)).toBe(toDollars(s0.cash) - toDollars(cost));
    const afterOne = vaultCards(r1.state).find((c) => c.id === sealed!.id)!;
    expect(afterOne.stage).toBe(STAGE_RUMORED);
    expect(afterOne.codename).not.toBeNull();
    expect(afterOne.whisper).not.toBeNull();
    expect(afterOne.requirement).toBeNull(); // still not the terms — that's the next purchase

    const r2 = investigateSecret(r1.state, sealed!.id);
    expect(r2.ok).toBe(true);
    const afterTwo = vaultCards(r2.state).find((c) => c.id === sealed!.id)!;
    expect(afterTwo.stage).toBe(STAGE_DECRYPTED);
    expect(afterTwo.requirement).not.toBeNull();
    expect(afterTwo.rewardLabel).not.toBeNull();

    // Nothing left to buy — intel never opens a file.
    const r3 = investigateSecret(r2.state, sealed!.id);
    expect(r3.ok).toBe(false);
    expect(r3.state.secretsFound ?? []).not.toContain(sealed!.id);
  });

  it("refuses the Omega file, an unaffordable purchase, an unknown id, and a shut vault", () => {
    const s = shipped(31);
    expect(investigateSecret(s, OMEGA_SECRET_ID).ok).toBe(false);
    expect(investigateSecret(s, "nope").ok).toBe(false);
    expect(investigateSecret({ ...s, cash: dollars(10) }, "ghostSignal").ok).toBe(false);
    expect(investigateSecret({ ...s, vaultEnabled: false }, "ghostSignal").ok).toBe(false);
    expect(investigateSecret({ ...s, launched: [] }, "ghostSignal").ok).toBe(false);
    // A refused purchase never charges.
    expect(investigateSecret(s, OMEGA_SECRET_ID).state.cash).toBe(s.cash);
  });
});

describe("the Vault — the reveal drip", () => {
  it("latches stages upward across ticks and points at the archive on the very first stir", () => {
    // A shipped company with three contracts delivered: Paper Trail's rumour gate (1 contract) is met,
    // its terms are not.
    let s = shipped(2024, { contractsCompleted: 3 });
    expect(s.secretStages).toEqual({});
    s = advanceOneWeek(s);
    expect(Object.keys(s.secretStages ?? {}).length).toBeGreaterThan(0);
    // The first stir names where to look — a mystery nobody can find is just a bug.
    expect(s.feed.some((f) => f.text.includes("the Vault, under Progress"))).toBe(true);
    // A stage, once latched, survives the condition regressing (contracts can't un-complete, but a
    // held-shares or licensee trace can — the latch is what makes that safe).
    const latched = { ...s.secretStages };
    const regressed = advanceOneWeek({ ...s, contractsCompleted: 0 });
    for (const [id, stage] of Object.entries(latched)) {
      expect(regressed.secretStages![id]).toBeGreaterThanOrEqual(stage);
    }
  });

  it("says nothing at all in a week where nothing moved", () => {
    const s = advanceOneWeek(shipped(606, { contractsCompleted: 3 }));
    const quiet = advanceOneWeek(s);
    const newLines = quiet.feed.length - s.feed.length;
    const vaultLines = quiet.feed.slice(s.feed.length).filter((f) => /vault|archive|file/i.test(f.text));
    expect(newLines).toBeGreaterThanOrEqual(0);
    expect(vaultLines).toHaveLength(0);
  });

  it("blocks opportunistic interrupts while a reveal is unacknowledged", () => {
    const clear = shipped(1717);
    expect(noPendingInterrupt(clear)).toBe(true);
    const revealing = { ...clear, pendingSecretReveal: { ids: ["paperTrail"], week: clear.week } };
    expect(noPendingInterrupt(revealing)).toBe(false);
    expect(noPendingInterrupt(dismissSecretReveal(revealing))).toBe(true);
  });
});

describe("the Vault — surfacing", () => {
  it("stays shut until the first ship, then reports its counts", () => {
    const fresh = newGame(3);
    expect(vaultSummary(fresh)).toMatchObject({ enabled: true, open: false, found: 0, total: SECRET_COUNT });
    const open = vaultSummary(shipped(3));
    expect(open.open).toBe(true);
    expect(open.total).toBe(SECRET_COUNT);
  });

  it("counts new leads until the player looks, then clears them", () => {
    const s = advanceOneWeek(shipped(1212, { contractsCompleted: 6 }));
    expect(vaultSummary(s).newLeads).toBeGreaterThan(0);
    const seen = markVaultSeen(s);
    expect(vaultSummary(seen).newLeads).toBe(0);
    expect(vaultCards(seen).every((c) => !c.isNew)).toBe(true);
    // Idempotent — a second look changes nothing.
    expect(markVaultSeen(seen)).toBe(seen);
  });

  it("never leaks a sealed file's terms into the card", () => {
    for (const card of vaultCards(shipped(64))) {
      if (card.stage === STAGE_SEALED) {
        expect(card.codename).toBeNull();
        expect(card.whisper).toBeNull();
        expect(card.requirement).toBeNull();
        expect(card.rewardLabel).toBeNull();
      }
      if (card.stage === STAGE_RUMORED) {
        expect(card.codename).not.toBeNull();
        expect(card.requirement).toBeNull();
      }
    }
  });
});
