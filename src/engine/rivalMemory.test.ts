// Rival head-to-head memory — the pure fold and its copy helpers. Determinism-safe by construction
// (no RNG anywhere in the module); the state-layer wiring is covered by rivalMemory.integration.
import { describe, it, expect } from "vitest";
import {
  emptyRivalMemory,
  recordRival,
  markRivalAcquired,
  rivalMemoryLine,
  strikeHistoryLine,
  rivalMemoryBeat,
  rivalryEpilogueClause,
  type RivalHistory,
  type RivalMemory,
} from "./rivalMemory.ts";

describe("recordRival — the fold", () => {
  it("creates the history + entry on first contact and accumulates every event kind", () => {
    let h: RivalHistory | undefined;
    h = recordRival(h, "pomelo", 10, "win");
    h = recordRival(h, "pomelo", 12, "loss");
    h = recordRival(h, "pomelo", 12, "strike");
    h = recordRival(h, "pomelo", 14, "strikeWeathered");
    h = recordRival(h, "pomelo", 16, "priceWar");
    h = recordRival(h, "pomelo", 20, "duelWon");
    h = recordRival(h, "pomelo", 30, "duelLost");
    expect(h.pomelo).toEqual({
      wins: 1, losses: 1, strikes: 1, strikesWeathered: 1, priceWars: 1, duelsWon: 1, duelsLost: 1, lastWeek: 30,
    });
  });

  it("is immutable: the previous history object and entries are untouched", () => {
    const h1 = recordRival(undefined, "tristar", 5, "win");
    const before = { ...h1.tristar };
    const h2 = recordRival(h1, "tristar", 6, "loss");
    expect(h1.tristar).toEqual(before);
    expect(h2.tristar.losses).toBe(1);
    expect(h2.tristar.wins).toBe(1);
  });

  it("keeps rivals independent and lastWeek monotonic", () => {
    let h = recordRival(undefined, "a", 10, "win");
    h = recordRival(h, "b", 12, "loss");
    h = recordRival(h, "a", 4, "win"); // an out-of-order week never regresses lastWeek
    expect(h.a).toMatchObject({ wins: 2, losses: 0, lastWeek: 10 });
    expect(h.b).toMatchObject({ wins: 0, losses: 1, lastWeek: 12 });
  });

  it("markRivalAcquired stamps the week, creating the entry for a bloodless buyout", () => {
    const h = markRivalAcquired(undefined, "quantyx", 80);
    expect(h.quantyx.acquiredWeek).toBe(80);
    expect(h.quantyx.wins).toBe(0);
    const h2 = markRivalAcquired(recordRival(undefined, "quantyx", 10, "win"), "quantyx", 90);
    expect(h2.quantyx).toMatchObject({ wins: 1, acquiredWeek: 90, lastWeek: 90 });
  });
});

function mem(over: Partial<RivalMemory>): RivalMemory {
  return { ...emptyRivalMemory(), ...over };
}

describe("rivalMemoryLine — the profile sentence", () => {
  it("is null when there is nothing on file", () => {
    expect(rivalMemoryLine(emptyRivalMemory())).toBeNull();
  });

  it("reads the record from the player's side, plus the specifics", () => {
    expect(rivalMemoryLine(mem({ wins: 5, losses: 2, strikesWeathered: 3, priceWars: 2, duelsWon: 1 })))
      .toBe("You lead the head-to-head 5–2 · 3 strikes weathered · 2 price wars · 1 duel trophy taken");
    expect(rivalMemoryLine(mem({ wins: 1, losses: 4 }))).toBe("They lead the head-to-head 4–1");
    expect(rivalMemoryLine(mem({ wins: 2, losses: 2 }))).toBe("All square at 2–2 head-to-head");
    expect(rivalMemoryLine(mem({ duelsLost: 2 }))).toBe("2 duels lost");
  });

  it("drops the record part when asked (the nemesis card already shows it)", () => {
    expect(rivalMemoryLine(mem({ wins: 5, losses: 2 }), { record: false })).toBeNull();
    expect(rivalMemoryLine(mem({ wins: 5, losses: 2, priceWars: 1 }), { record: false })).toBe("1 price war");
  });
});

describe("strikeHistoryLine — the strike card's memory", () => {
  it("stays silent on a first strike", () => {
    expect(strikeHistoryLine(mem({ strikes: 1 }))).toBeNull();
  });

  it("counts the strike on screen and the ones weathered before", () => {
    expect(strikeHistoryLine(mem({ strikes: 3, strikesWeathered: 2 })))
      .toBe("Their third strike on you — you've weathered 2 strikes before.");
    expect(strikeHistoryLine(mem({ strikes: 2 }))).toBe("Their second strike on you.");
  });
});

describe("rivalMemoryBeat — notable-transition feed beats", () => {
  it("fires once, on the crossing, and not again", () => {
    expect(rivalMemoryBeat(mem({ wins: 2 }), mem({ wins: 3 }))?.tone).toBe("positive");
    expect(rivalMemoryBeat(mem({ wins: 3 }), mem({ wins: 4 }))).toBeNull();
    expect(rivalMemoryBeat(undefined, mem({ wins: 1 }))).toBeNull();
  });

  it("speaks on a third loss and a third price war, and stays quiet otherwise", () => {
    expect(rivalMemoryBeat(mem({ losses: 2 }), mem({ losses: 3 }))?.tone).toBe("negative");
    expect(rivalMemoryBeat(mem({ priceWars: 2 }), mem({ priceWars: 3 }))?.text).toContain("price war");
    expect(rivalMemoryBeat(mem({ strikes: 2 }), mem({ strikes: 3 }))).toBeNull();
  });
});

describe("rivalryEpilogueClause — the defining feud", () => {
  it("is undefined with no history or only trivial contact", () => {
    expect(rivalryEpilogueClause(undefined, () => "X")).toBeUndefined();
    expect(rivalryEpilogueClause({ pomelo: mem({ wins: 1, losses: 1 }) }, () => "Pomelo")).toBeUndefined();
  });

  it("names the biggest feud and closes it from the record", () => {
    const h: RivalHistory = {
      pomelo: mem({ wins: 4, losses: 2 }),
      voltix: mem({ wins: 1, losses: 1 }),
    };
    expect(rivalryEpilogueClause(h, (id) => (id === "pomelo" ? "Pomelo" : "Voltix")))
      .toBe("Its defining feud, with Pomelo, closed 4–2 in your favour.");
    expect(rivalryEpilogueClause({ pomelo: mem({ wins: 1, losses: 3 }) }, () => "Pomelo"))
      .toBe("Its defining feud, with Pomelo, closed 1–3; some scores stay unsettled.");
  });

  it("a buyout ends the feud its own way, with the name resolved from the calibrated defs", () => {
    // No liveName resolver (the rival left the field) — the def-based fallback still names Quantyx.
    const h: RivalHistory = { quantyx: { ...mem({ wins: 1 }), acquiredWeek: 120 } };
    expect(rivalryEpilogueClause(h)).toBe("Its long feud with Quantyx ended the old-fashioned way: it bought them.");
  });

  it("never uses an em dash (epilogue house style)", () => {
    const h: RivalHistory = { pomelo: mem({ wins: 3, losses: 3 }) };
    const clause = rivalryEpilogueClause(h, () => "Pomelo")!;
    expect(clause).not.toContain("—");
    expect(clause).toBe("Its defining feud, with Pomelo, ended all square at 3–3.");
  });
});
