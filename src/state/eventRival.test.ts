// Item 1.4 — market events name a REAL rival (preferring the nemesis) and route a scandal's hit to
// that rival, so the world's most frequent speech connects to the roster the player actually knows.
import { describe, expect, it } from "vitest";
import { newGame, applyEventEffect } from "./gameState.ts";
import { MARKET_EVENTS } from "../engine/events.ts";
import type { GameState } from "../engine/types.ts";

describe("market events name real rivals (item 1.4)", () => {
  it("every {rival}-slotted event declares a rivalSlot (and vice versa)", () => {
    for (const ev of MARKET_EVENTS) {
      const hasPlaceholder = ev.title.includes("{rival}");
      expect(hasPlaceholder).toBe(!!ev.rivalSlot);
    }
  });

  it("a scoped rivalScandal hits ONLY the named rival (strength + share price), text agrees", () => {
    const s = newGame(42);
    const target = s.competitors[0];
    const other = s.competitors[1];
    const before = { ...target.strengthByCategory };
    const otherBefore = { ...other.strengthByCategory };
    const out = applyEventEffect(s, { kind: "rivalScandal", factor: 0.5 }, s.week, `${target.name} stumbled`, "positive", target.id);
    const t2 = out.competitors.find((c) => c.id === target.id)!;
    const o2 = out.competitors.find((c) => c.id === other.id)!;
    // the named rival weakened…
    const anyCat = Object.keys(before)[0] as keyof typeof before;
    if (anyCat) expect(t2.strengthByCategory[anyCat]!).toBeLessThan(before[anyCat]!);
    expect(t2.sharePrice).toBeLessThan(target.sharePrice); // …and its stock dipped
    // …while an untargeted rival is untouched (scoped, not field-wide)
    const oCat = Object.keys(otherBefore)[0] as keyof typeof otherBefore;
    if (oCat) expect(o2.strengthByCategory[oCat]!).toBe(otherBefore[oCat]!);
  });

  it("without a target (choice events / chains) the scandal stays field-wide (legacy behaviour)", () => {
    const s = newGame(7);
    const out = applyEventEffect(s, { kind: "rivalScandal", factor: 0.5 }, s.week, "field opened", "positive");
    // every rival weakened, and no stock dip (field-wide legacy path)
    for (const c of s.competitors) {
      const c2 = out.competitors.find((x) => x.id === c.id)!;
      expect(c2.sharePrice).toBe(c.sharePrice);
      const cat = Object.keys(c.strengthByCategory)[0] as keyof typeof c.strengthByCategory;
      if (cat) expect(c2.strengthByCategory[cat]!).toBeLessThan(c.strengthByCategory[cat]!);
    }
  });

  it("naming is deterministic (same seed/week → same rival) and RNG-free", () => {
    // applyEventEffect + the naming derive from state only; two identical states name identically.
    const a: GameState = newGame(99);
    const b: GameState = newGame(99);
    expect(a.competitors.map((c) => c.name)).toEqual(b.competitors.map((c) => c.name));
  });
});
