# UI Redesign — Wave 5 (The Testing action) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Test Prototype a player-facing action — spend cash and a week on the active design to tighten its forecast and possibly surface a flaw — and restore the Testing step in the Design Lab's stage ladder.

**Architecture:** Wave 3 shipped the engine (`prototypeOutcome`, `prototypeCost`) as a pure, player-action-only roll on derived-hash salt 317, and Wave 4 removed the dead Testing step from the ladder. This wave adds the missing middle: a state action that spends the cash and the week, records the outcome on the draft, feeds the confidence gain into the existing forecast, and renders the whole thing in the Design Lab behind the flag. **No tick changes and no cadence** — the roll happens only when the player presses the button, so a do-nothing run stays byte-identical.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · the balance harness (`npm run sim`).

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (§9.3 Test Prototype)
**Predecessors:** Wave 3's plan (the engine + salt 317) and Wave 4's outcome (the removed step, and the flag-gating rule).

## Global Constraints

- **Determinism is sacred.** The action is player-initiated only. Nothing in the weekly tick may call it, and no cadence may raise it. The 160-week pin must stay **byte-identical** on a do-nothing run.
- **Salt 317 is already registered** in `CLAUDE.md`. Do not add a new salt; do not draw on the main sim RNG.
- **Every new state field is optional and backfilled**, so an old save loads and behaves exactly as before.
- **Flag-gating rule (ruled in Wave 4):** the Testing UI is in-tab Design Lab content, so it renders **only** with `silicon.ui2` on. A flag-off build must show the Design Lab exactly as it is today.
- **No balance change without evidence:** constants live in `balance.ts`, and `npm run sim` must show the curve unchanged (0/40 bankruptcies, all eras reached).
- No new dependencies; explicit import extensions; design tokens only; Lucide icons only.
- Gate: `tsc` 0 · suite green · `npm run build` · `verify:ui2` PASS · `audit:screens` CLEAN · pin byte-identical · sim unchanged.

---

### Task 1: The action's state shape

**Files:**
- Modify: `src/state/gameState.ts`
- Modify: `src/state/persistence.ts` (`migrate()` backfill)
- Test: `src/state/prototypeAction.test.ts`

**Interfaces:**
- Consumes: `prototypeCost`, `prototypeOutcome`, `PROTOTYPE_SALT` from `engine/prototype.ts`; the `rest` action as the precedent for "spend a week" (v19: Rest costs 1 week / +30).
- Produces: `state.draftPrototype?: { week: number; flaw: StatKey | null } | null`; a `runPrototype()` action.

- [ ] **Step 1: Read the `rest` precedent first**

`src/state/gameState.ts` already has an action that costs a week and mutates state (`rest`, from v19). Read how it:
- validates affordability,
- advances the week,
- and shapes its `ActionResult` (ok / reason).

Match that shape exactly. Do not invent a second result convention.

- [ ] **Step 2: Write the failing test**

Create `src/state/prototypeAction.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { newGame, runPrototype, prototypeState } from "./gameState.ts";
import { dollars } from "../engine/money.ts";

// The action is PLAYER-INITIATED ONLY. These tests pin the three things that matter: it costs cash
// and a week, it refuses when it cannot afford them, and it is deterministic for a given (seed, week).

describe("runPrototype", () => {
  it("refuses when the company cannot afford it, changing nothing", () => {
    const s = { ...newGame(4242), cash: dollars(0) };
    const r = runPrototype(s);
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s); // identity: a refused action is a no-op, not a copy
  });

  it("spends the cost and advances exactly one week when it succeeds", () => {
    const s = { ...newGame(4242), cash: dollars(50_000_000), week: 30 };
    const r = runPrototype(s);
    expect(r.ok).toBe(true);
    expect(r.state.week).toBe(31);
    expect(r.state.cash).toBeLessThan(s.cash);
    expect(prototypeState(r.state)).not.toBeNull();
  });

  it("is deterministic for the same seed and week", () => {
    const a = runPrototype({ ...newGame(4242), cash: dollars(50_000_000), week: 30 });
    const b = runPrototype({ ...newGame(4242), cash: dollars(50_000_000), week: 30 });
    expect(prototypeState(a.state)).toEqual(prototypeState(b.state));
  });

  it("is a no-op on a save with no draft prototype field and no draft", () => {
    const s = newGame(4242);
    expect(prototypeState(s)).toBeNull();
  });
});
```

- [ ] **Step 3: Verify the failure**

Run: `npx vitest run src/state/prototypeAction.test.ts`
Expected: FAIL — `runPrototype` / `prototypeState` are not exported.

- [ ] **Step 4: Implement**

Add to the `GameState` type (beside the other optional, backfilled fields):

```ts
  /** The active design's prototype result, if one has been run against it. Optional and backfilled
   *  null, so an old save loads unchanged. Cleared when a new draft starts. */
  draftPrototype?: { week: number; flaw: StatKey | null } | null;
```

Add the accessor and the action beside `rest`:

```ts
/** The prototype result for the active draft, or null. Tolerant of a missing field (old saves). */
export function prototypeState(s: GameState): { week: number; flaw: StatKey | null } | null {
  return s.draftPrototype ?? null;
}

/** Run a prototype on the active design: pay `prototypeCost(era)` and spend one week, then record
 *  the outcome. PLAYER ACTION ONLY - it is never called from the tick, and its randomness is the
 *  derived hash of (seed, week, 317), so a run that never presses the button is untouched. */
export function runPrototype(s: GameState): ActionResult<GameState> {
  // 1. Guard affordability against prototypeCost(s.era); return { ok: false, reason, state: s }.
  //    Returning the SAME reference on refusal is what makes the test's identity check meaningful.
  // 2. Compute the draft's weakest stat from the current draft (the same source the Design Lab's
  //    stat bars read). If there is no draft, refuse.
  // 3. `const outcome = prototypeOutcome(s.seed, s.week, { era: s.era, weakestStat, rp: s.researchPoints });`
  // 4. Charge the cost, advance exactly one week, stamp `draftPrototype: { week, flaw: outcome.flaw }`.
  // 5. Return { ok: true, state: next }.
}
```

Match `ActionResult`'s actual generic shape from `rest` — do not invent one.

- [ ] **Step 5: Backfill**

In `src/state/persistence.ts`, add `draftPrototype` to `migrate()`'s backfills defaulting to `null`.

- [ ] **Step 6: Prove determinism**

Run: `npx vitest run src/state/prototypeAction.test.ts` → PASS
Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS, byte-identical
Run: `npm test` → green
Run: `npm run sim` → unchanged

- [ ] **Step 7: Commit**

```bash
git add src/state/gameState.ts src/state/persistence.ts src/state/prototypeAction.test.ts
git commit -m "feat(engine): add the player-initiated Test Prototype action"
```

---

### Task 2: The outcome reaches the forecast and the draft

**Files:**
- Modify: `src/state/gameState.ts` (or wherever the Design Lab's forecast is derived)
- Test: extend `src/state/prototypeAction.test.ts`

**Interfaces:**
- Consumes: `prototypeState`, and `forecastConfidence` / `forecastBand` / `forecastConfidenceLabel` from `engine/forecast.ts`.
- Produces: the prototype's `confidenceGain` folded into whatever the Design Lab already reads for its forecast band, so the UI change is a read, not a new calculation.

- [ ] **Step 1: Find the existing forecast read**

Locate where the Design Lab gets its projected-verdict confidence (the `forecast.ts` call). **Add the prototype's gain into that existing input** rather than creating a parallel forecast. Report which call site you changed.

- [ ] **Step 2: Test it**

```ts
  it("a completed prototype tightens the forecast, and nothing else does", () => {
    const base = { ...newGame(4242), cash: dollars(50_000_000), week: 30 };
    const after = runPrototype(base);
    expect(after.ok).toBe(true);
    expect(forecastConfidenceInput(after.state)).toBeGreaterThan(forecastConfidenceInput(base));
  });
```

Use whatever the real input accessor is named; if there is not one, add the smallest pure accessor that exposes it and test that.

- [ ] **Step 3: Verify and commit**

Run: `npx vitest run src/state/prototypeAction.test.ts` → PASS
Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS
Run: `npm test` → green

```bash
git add src/state/gameState.ts src/state/prototypeAction.test.ts
git commit -m "feat(engine): fold the prototype's confidence gain into the forecast"
```

---

### Task 3: The Testing UI, and the step returns

**Files:**
- Modify: `src/screens/DesignLab.tsx`
- Modify: `src/screens/developmentStage.ts` (the lens now has a real signal)

**Interfaces:**
- Consumes: `runPrototype`, `prototypeState`, `prototypeCost`, and the existing draft.
- Produces: a Testing panel, and a Development Stage ladder that shows Testing again.

- [ ] **Step 1: Restore the step**

Wave 4 removed `testing` from the rendered ladder because it could never light up. It can now: `developmentStage`'s `testing` branch should fire when `prototypeState(state)` is set for the active draft. Pass the real fact in, remove the `filter((s) => s.stage !== "testing")` exclusion, and update `developmentStage.test.ts` to cover the newly-reachable branch.

- [ ] **Step 2: Build the panel**

Add a **Testing** section to the Design Lab, visible only with `uiVersion === "next"` (the flag-gating rule). It shows:

- What a prototype does in one line, and its price: `prototypeCost(state.era)` formatted through `format()`.
- A primary **Run prototype** button calling the action, routed through the same feedback buses as every other spend (`emitSpend` + a success haptic + a toast), matching `rest`/`hire`.
- **Disabled with a reason** when: no draft; already run for this draft (say which week it ran); or unaffordable ("Need $X"). A disabled button must always say why — this is an established house rule.
- After a run: the outcome. If `flaw` is set, name the stat and link the player to where they can change it. If `flaw` is null, say the prototype found no issues and the forecast is tighter.
- The tightened forecast is visible in the existing verdict/confidence read (Task 2 made that automatic).

- [ ] **Step 3: Clear it when the draft changes**

A new draft must not inherit the previous prototype result. Clear `draftPrototype` wherever the Design Lab starts a fresh draft (the same place the successor seed is consumed) — and note the location in your report.

- [ ] **Step 4: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green
Run: `npm run build` → green
Run: `npm run verify:ui2` → PASS
Capture and **read** two frames at 1024×768, on the Design tab: flag-on (the Testing panel and the restored ladder step render) and flag-off (neither renders). Report what you saw.

```bash
git add src/screens/DesignLab.tsx src/screens/developmentStage.ts src/screens/developmentStage.test.ts
git commit -m "feat(ui2): the Testing action, and the step it lights up"
```

---

### Task 4: Verification

**Files:** none (evidence only).

- [ ] **Step 1: The two proofs**

Run: `npx vitest run src/state/activeRun.determinism.test.ts` → **byte-identical**
Run: `npm run sim` → **0/40 bankruptcies, all eras reached**, unchanged

The sim must be unchanged precisely because the action is never taken by the harness — if it moves, something called the action from a non-player path and that is a Critical finding.

- [ ] **Step 2: The full gate**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green
Run: `npm run build` → green
Run: `npm run verify:ui2` → PASS
Run: `npm run verify:deeplink` → PASS, four routes
Run: `npm run shots:stage:showcase; npm run audit:screens` → CLEAN

- [ ] **Step 3: Flag-off parity**

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
Remove-Item Env:\SHOTS_UI2, Env:\SHOTS_URL, Env:\SHOTS_VIEWPORT -ErrorAction SilentlyContinue
npm run shots:diff -- wave5-off
```

Expected: the Design Lab is unchanged - no Testing panel, no stage ladder.

- [ ] **Step 4: Record the outcome**

Append a "Wave 5 outcome" section: status, commit range, gate output, deferred minors.

---

## Wave 5 exit criteria

- [ ] A do-nothing 160-week run is **byte-identical**; `npm run sim` unchanged.
- [ ] The action refuses when unaffordable by returning the SAME state reference (a true no-op).
- [ ] It spends the cost, advances exactly one week, and records a deterministic outcome on salt 317.
- [ ] The prototype tightens the forecast through the existing forecast call, not a parallel one.
- [ ] Flag off → no Testing panel, no stage ladder, Design Lab unchanged.
- [ ] Flag on → the Testing panel renders with cost, disabled reasons, and the outcome; the ladder shows the step lit when a prototype has been run.
- [ ] A new draft does not inherit a previous prototype result.
- [ ] `tsc` 0 · suite green · build green · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN.

## Deliberate scope notes

- **No new salt, no new balance knobs beyond what Wave 3 registered.** The constants already exist; this wave wires them to a button.
- **The prototype is never required.** It stays a choice, which is what keeps the existing design→build→launch pacing intact.
- **No Testing action on the Development Stage for other screens.** Only the Design Lab owns a draft.
