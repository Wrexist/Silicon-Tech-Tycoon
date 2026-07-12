// Choice-event consequence flags (item 5.9): a choice records what you decided, and a later
// flag-gated event only appears once the matching flag is raised — a callback so decisions echo.
import { describe, expect, it } from "vitest";
import { newGame, resolveChoice, type GameState } from "./gameState.ts";
import { pickChoiceEvent, CHOICE_EVENTS } from "../engine/events.ts";
import { makeRng } from "../engine/rng.ts";

const flagshipStore = CHOICE_EVENTS.find((e) => e.id === "flagship_store")!;
const flagshipLegacy = CHOICE_EVENTS.find((e) => e.id === "flagship_legacy")!;

describe("choice consequence flags (item 5.9)", () => {
  it("the follow-up event declares its prerequisite flag; the trigger option sets it", () => {
    expect(flagshipLegacy.requiresFlag).toBe("flagshipOpen");
    expect(flagshipStore.options.find((o) => o.id === "build")!.setsFlag).toBe("flagshipOpen");
  });

  it("resolving a choice records both the option flag and a generic eventId:optionId record", () => {
    const g: GameState = { ...newGame(3), era: 3, pendingChoice: { event: flagshipStore, week: 40 } };
    const after = resolveChoice(g, "build");
    expect(after.choiceFlags).toContain("flagshipOpen");
    expect(after.choiceFlags).toContain("flagship_store:build");
    expect(after.resolvedChoices).toContain("flagship_store");
    // The alternative option raises only the generic record, not the flag.
    const g2: GameState = { ...newGame(3), era: 3, pendingChoice: { event: flagshipStore, week: 40 } };
    const online = resolveChoice(g2, "online");
    expect(online.choiceFlags).toContain("flagship_store:online");
    expect(online.choiceFlags).not.toContain("flagshipOpen");
  });

  it("a flag-gated event is EXCLUDED from the pool until its flag is present", () => {
    // Scan for a pick with no flags: flagship_legacy must never come up (it's gated).
    let sawGatedWithoutFlag = false;
    for (let s = 0; s < 400; s++) {
      const pick = pickChoiceEvent(makeRng(s), 4, [], [], []); // no flags
      if (pick?.id === "flagship_legacy") sawGatedWithoutFlag = true;
    }
    expect(sawGatedWithoutFlag).toBe(false);
    // With the flag present, the gated event CAN be picked (given the right seed).
    let sawGatedWithFlag = false;
    for (let s = 0; s < 400 && !sawGatedWithFlag; s++) {
      // Exclude every other era-≤4 event as "resolved" so only the gated one can win.
      const others = CHOICE_EVENTS.filter((e) => e.id !== "flagship_legacy").map((e) => e.id);
      const pick = pickChoiceEvent(makeRng(s), 4, others, [], ["flagshipOpen"]);
      if (pick?.id === "flagship_legacy") sawGatedWithFlag = true;
    }
    expect(sawGatedWithFlag).toBe(true);
  });

  it("with no flags, the pool is identical to before the callback existed (sim byte-identical guard)", () => {
    // pickChoiceEvent with flags=[] never returns a requiresFlag event, so the reachable pool equals
    // the set of unflagged events — the property the pinned sim relies on.
    for (let s = 0; s < 200; s++) {
      const pick = pickChoiceEvent(makeRng(s), 4, [], [], []);
      if (pick) expect(pick.requiresFlag).toBeUndefined();
    }
  });
});
