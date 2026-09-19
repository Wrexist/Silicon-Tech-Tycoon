# UI Redesign — Wave 3 (Mechanics) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the four things the mockup implies that need real data — a weekly financial history, a Customer Rating, a Test Prototype step, and a Development Stage lens — **without changing a single do-nothing simulation result**.

**Architecture:** Wave 3 is the first wave that touches `src/engine/`. It follows the repo's established rule for new "alive" systems: **optional, backfilled state fields that default to a no-op**, pure engine functions, a **fresh derived-hash salt** for any side-channel randomness, and the pinned 160-week reproducibility test staying byte-identical on a do-nothing run. Two of the four items are pure derivations over data that already exists; only Test Prototype is a genuine new mechanic, and it is **optional and never mandatory** so existing pacing is untouched.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · the balance harness (`npm run sim`).

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (§9.2, §9.3)
**Predecessors:** Wave 2a's routing plan (the shell owns the header; params live in the URL) and Wave 2c's outcome (two minors to close first).

## Global Constraints

- **Determinism is sacred.** A run that takes no new action must produce a **byte-identical** 160-week trace. Every new field is optional and backfilled; every new system is gated on that field and no-ops when it is absent.
- **Salt 317 is reserved for this wave.** The in-use salts are 11, 23, 37, 53, 71, 83, 91, 97, 101, 113, 127, 131, 137, 149, 151, 157, 163, 211, 223, 227, 229, 233, 239, 257, 263, 269, 271, 277, 281, 293, 307, 311. Never the main sim RNG.
- **No balance change without evidence.** Any numeric constant goes in `engine/balance.ts`, and `npm run sim` (40 seeds) must show the curve unchanged or improved — 0 bankruptcies, all eras reached.
- **Principle 0:** with `silicon.ui2` off the UI is unchanged. The new data is recorded regardless of the flag (it lives in the save, not the UI), so a later flag-on build can chart it.
- Engine stays pure: no imports from `state/`. Persistence gains the fields in `migrate()`'s backfills.
- No new dependencies; explicit import extensions; design tokens only in CSS.
- Gate per task: `tsc` 0 · `npm test` green (pin included) · `npm run build` · and after any engine/balance change, `npm run sim`.

---

### Task 0: Close Wave 2c's two real minors

**Files:**
- Modify: `src/state/pageStack.ts`, `src/state/pageStack.test.ts`, `src/state/usePageNav.ts`

**Interfaces:**
- Produces: `PAGE_IDS: readonly PageId[]` — the canonical, runtime-enumerable list the type is derived from.

- [ ] **Step 1: Make the guard able to fail**

Today the "wires every declared page" test compares `WIRED_PAGES` to a hand-written literal, so adding a `PageId` leaves it green while `#/company/vault` would blank the main area. Export the canonical list and derive the type from it:

```ts
/** Every page the router can name. The `PageId` union is DERIVED from this array, and `WIRED_PAGES`
 *  is checked against it, so a page can never be declared without a test noticing it has no screen. */
export const PAGE_IDS = ["settings", "platform", "museum", "goals"] as const;
export type PageId = (typeof PAGE_IDS)[number];
```

Then in `pageStack.test.ts`, replace the literal in the every-declared-page test with `PAGE_IDS`.

- [ ] **Step 2: Stop the flag-off URL rewrite**

With the flag off, `routeFromHash` resolves `#/company/museum` into a frame, so the initial stack is non-empty and the un-gated `clear()` rewrites a stale URL on the first tab change where it previously did nothing. Build the initial stack only when enabled:

```ts
  const [stack, setStack] = useState<PageStack>(() => {
    if (!enabled) return []; // inert with the flag off: no frame, and so no URL rewrite on a tab change
    const { frame } = routeFromHash(typeof window === "undefined" ? "" : window.location.hash, currentRoot);
    return frame ? [frame] : [];
  });
```

(`enabled` is already computed above the initializer — confirm the declaration order and move it up if needed; a `useState` initializer must not read a value declared later in the same scope.)

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → 1,981 (the test's assertion changes, its count does not)
Run: `npm run build` → green

```bash
git add src/state/pageStack.ts src/state/pageStack.test.ts src/state/usePageNav.ts
git commit -m "fix(ui2): make the wired-page guard able to fail, and keep flag-off clear() inert"
```

---

### Task 1: Weekly financial history

**Files:**
- Modify: `src/engine/types.ts` (the `GameState` field)
- Modify: `src/state/gameState.ts` (record it in the weekly tick; backfill in `newGame`)
- Modify: `src/state/persistence.ts` (`migrate()` backfill)
- Modify: `src/engine/balance.ts` (the cap)
- Test: `src/engine/financials.test.ts`

**Interfaces:**
- Consumes: the `cashHistory` precedent — `{ week: number; cash: number }[]`, pushed once per week in the tick, capped by shifting.
- Produces: `type FinancialWeek = { week: number; revenue: number; expenses: number; profit: number }`; `state.financialHistory: FinancialWeek[]`; `recordFinancialWeek(history, week)`; `growthDeltas(history, weeks)`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/financials.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { growthDeltas, recordFinancialWeek, type FinancialWeek } from "./financials.ts";

const wk = (week: number, revenue: number, expenses: number): FinancialWeek =>
  ({ week, revenue, expenses, profit: revenue - expenses });

describe("financial history", () => {
  it("appends a week and reports the profit it derives", () => {
    const h = recordFinancialWeek([], { week: 3, revenue: 120, expenses: 20 });
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual({ week: 3, revenue: 120, expenses: 20, profit: 100 });
  });

  it("caps the history so an old save cannot grow without bound", () => {
    let h: FinancialWeek[] = [];
    for (let w = 0; w < 500; w++) h = recordFinancialWeek(h, { week: w, revenue: w, expenses: 0 });
    expect(h.length).toBeLessThanOrEqual(260);
    expect(h[h.length - 1].week).toBe(499);
  });

  it("returns zero deltas when there is nothing to compare", () => {
    expect(growthDeltas([], 8)).toEqual({ revenue: 0, expenses: 0, profit: 0 });
    expect(growthDeltas([wk(1, 10, 5)], 8)).toEqual({ revenue: 0, expenses: 0, profit: 0 });
  });

  it("compares the latest week against the one N weeks back", () => {
    const h = [wk(1, 100, 40), wk(2, 110, 45), wk(3, 150, 50)];
    const d = growthDeltas(h, 2);
    expect(d.revenue).toBe(50);
    expect(d.expenses).toBe(10);
    expect(d.profit).toBe(40);
  });
});
```

- [ ] **Step 2: Verify the failure**

Run: `npx vitest run src/engine/financials.test.ts`
Expected: FAIL — cannot resolve `./financials.ts`.

- [ ] **Step 3: Implement the pure module**

Create `src/engine/financials.ts`:

```ts
// Weekly financial history: revenue, expenses and the profit they imply, one row per simulated week.
// Recorded unconditionally (it is save data, not UI), so a later flag-on build can chart a run that
// started before the redesign. Pure — the tick supplies the numbers.
import { BALANCE } from "./balance.ts";

export interface FinancialWeek {
  week: number;
  revenue: number;
  expenses: number;
  profit: number;
}

/** Append one week, deriving `profit` from its parts so the two can never disagree, and capping the
 *  list the way cashHistory is capped — an unbounded array in a save is a slow leak. */
export function recordFinancialWeek(
  history: readonly FinancialWeek[],
  week: { week: number; revenue: number; expenses: number },
): FinancialWeek[] {
  const next = [...history, { ...week, profit: week.revenue - week.expenses }];
  return next.length > BALANCE.financials.historyCap ? next.slice(next.length - BALANCE.financials.historyCap) : next;
}

/** Percentage change from N weeks back to the latest week, per series, rounded to a whole percent.
 *  Zero when there is not enough history — never a fabricated number. */
export function growthDeltas(
  history: readonly FinancialWeek[],
  weeks: number,
): { revenue: number; expenses: number; profit: number } {
  const last = history[history.length - 1];
  const past = history[history.length - 1 - weeks];
  if (!last || !past) return { revenue: 0, expenses: 0, profit: 0 };
  const pct = (now: number, then: number) => (then === 0 ? 0 : Math.round(((now - then) / Math.abs(then)) * 100));
  return {
    revenue: pct(last.revenue, past.revenue),
    expenses: pct(last.expenses, past.expenses),
    profit: pct(last.profit, past.profit),
  };
}
```

- [ ] **Step 4: Add the balance constant**

In `src/engine/balance.ts`, beside the existing history/cap constants:

```ts
  // --- Weekly financial history (Silicon 2.0 growth chart) ---
  financials: {
    historyCap: 260, // ~5 years of weeks; matches cashHistory's cap so the two stay in step
  },
```

- [ ] **Step 5: Record it in the tick and backfill old saves**

In `src/state/gameState.ts`, find where `cashHistory` is pushed in the weekly tick (`const cashHistory = [...state.cashHistory, { week, cash: toDollars(cash) }];`) and record that same week's figures alongside it.

**Do not invent variables.** The tick has no single `weeklyRevenue` binding, so read the tick and use what it already computes:
- **revenue** — sum the per-product `gross` the tick books while iterating the week's sales (the same values it adds into `cumulativeRevenue`). If the tick accumulates a running total you can reuse, use that instead of re-summing.
- **expenses** — the existing `weeklyOutflow(state)` helper the runway/Company burn figures already use, so the chart's expenses line agrees with the burn the player sees.

State the exact expressions you recorded in your report, so the review can confirm the chart and the burn readout cannot disagree.

Then add `financialHistory: []` to `newGame`'s state object and to every other state constructor in the file (search for `cashHistory: [{ week: 0`).

In `src/state/persistence.ts`, add `financialHistory` to `migrate()`'s backfills defaulting to `[]`.

- [ ] **Step 6: Prove determinism**

Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS, byte-identical
Run: `npm test` → green; the count is 1,981 + 4
Run: `npm run sim` → the curve must be unchanged (0/40 bankruptcies, all eras reached)

- [ ] **Step 7: Commit**

```bash
git add src/engine/financials.ts src/engine/financials.test.ts src/engine/balance.ts src/engine/types.ts src/state/gameState.ts src/state/persistence.ts
git commit -m "feat(engine): record a weekly financial history for the growth chart"
```

---

### Task 2: Customer Rating

**Files:**
- Modify: `src/engine/reviews.ts` (a pure derivation)
- Test: `src/engine/reviews.test.ts` (extend)

**Interfaces:**
- Consumes: the outlet scores `criticReviews(inp).outlets` already returns.
- Produces: `customerRating(scores: readonly number[]): { score: number; label: string }` — 0–100 plus a band label. Taking the SCORES (not `ReviewInputs`) is deliberate: it makes the empty case directly testable instead of depending on a fixture that happens to produce no outlets.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/reviews.test.ts`:

```ts
describe("customerRating", () => {
  it("is the outlet average, rounded, with a band label", () => {
    expect(customerRating([80, 90, 70])).toEqual({ score: 80, label: "Good" });
    expect(customerRating([85, 90])).toEqual({ score: 88, label: "Excellent" });
  });

  it("never invents a rating when there are no outlets yet", () => {
    expect(customerRating([])).toEqual({ score: 0, label: "No data" });
  });

  it("stays inside 0-100 for extreme inputs", () => {
    for (const s of [[0], [100], [0, 100], [100, 100, 100]]) {
      const r = customerRating(s);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Verify the failure**

Run: `npx vitest run src/engine/reviews.test.ts`
Expected: FAIL — `customerRating` is not exported.

- [ ] **Step 3: Implement**

In `src/engine/reviews.ts`:

```ts
/** A single 0-100 "how do buyers feel" number, derived from outlet scores that already exist — no new
 *  state, no new simulation, nothing to keep in sync. Bands are deliberately coarse: a five-point
 *  wobble should not relabel a company. */
export function customerRating(scores: readonly number[]): { score: number; label: string } {
  if (scores.length === 0) return { score: 0, label: "No data" };
  const score = Math.round(scores.reduce((n, s) => n + s, 0) / scores.length);
  const label = score >= 82 ? "Excellent" : score >= 65 ? "Good" : score >= 45 ? "Mixed" : "Poor";
  return { score, label };
}
```

The Company screen later calls it as `customerRating(criticReviews(inputs).outlets.map((o) => o.score))`.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/engine/reviews.test.ts` → PASS
Run: `npm test` → green; the count is the previous + 2
Run: `npm run build` → green

```bash
git add src/engine/reviews.ts src/engine/reviews.test.ts
git commit -m "feat(engine): derive a Customer Rating from the existing outlet scores"
```

---

### Task 3: Test Prototype

**Files:**
- Create: `src/engine/prototype.ts`
- Test: `src/engine/prototype.test.ts`
- Modify: `src/engine/balance.ts` (cost, weeks, confidence gain)

**Interfaces:**
- Consumes: `forecastConfidence`, `forecastBand`, `forecastConfidenceLabel` from `forecast.ts`.
- Produces: `PROTOTYPE_SALT = 317`; `prototypeCost(era): Money`; `prototypeOutcome(seed, week, args): { flaw: StatKey | null; confidenceGain: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/engine/prototype.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PROTOTYPE_SALT, prototypeOutcome } from "./prototype.ts";

const args = { era: 2, weakestStat: "battery" as const, rp: 40 };

// Deterministic per (seed, week): the SAME run must resolve the same way every time, and two
// different weeks must be free to differ. Never the main sim RNG.
describe("prototypeOutcome", () => {
  it("is stable for a given seed and week", () => {
    expect(prototypeOutcome(4242, 30, args)).toEqual(prototypeOutcome(4242, 30, args));
  });

  it("varies across weeks so the gamble is real", () => {
    const seen = new Set([20, 21, 22, 23, 24, 25, 26, 27].map((w) => JSON.stringify(prototypeOutcome(4242, w, args))));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("only ever names the draft's weakest stat as the flaw, or none", () => {
    for (let w = 0; w < 40; w++) {
      const out = prototypeOutcome(99, w, args);
      if (out.flaw !== null) expect(out.flaw).toBe("battery");
      expect(out.confidenceGain).toBeGreaterThanOrEqual(0);
    }
  });

  it("reserves the wave's salt and does not alias an in-use one", () => {
    expect(PROTOTYPE_SALT).toBe(317);
  });
});
```

- [ ] **Step 2: Verify the failure**

Run: `npx vitest run src/engine/prototype.test.ts`
Expected: FAIL — cannot resolve `./prototype.ts`.

- [ ] **Step 3: Implement the pure module**

Create `src/engine/prototype.ts`:

```ts
// Test Prototype: an OPTIONAL spend on the active design that returns a tighter forecast and may
// surface one flaw to fix. Optional on purpose — declining changes nothing, so existing pacing and
// the design -> build -> launch math are untouched, and a do-nothing run stays byte-identical.
import { BALANCE } from "./balance.ts";
import { scale, type Money } from "./money.ts";
import type { StatKey } from "./types.ts";

/** This wave's derived-hash salt. Side-channel randomness must never draw on the main sim RNG. */
export const PROTOTYPE_SALT = 317;

function hash01(seed: number, week: number, salt: number): number {
  // COPY the local roll helper from `src/engine/moonshots.ts` (its derived-hash roll at ~line 139)
  // rather than importing one — there is no shared `hash01` in this repo; each derived-hash stream
  // owns its helper, and that is the established pattern (moonshots salt 307, secrets salt 311).
  // Read that file first and match its exact arithmetic, so 317 behaves like every other stream.
}

export function prototypeCost(era: number): Money {
  return scale(BALANCE.prototype.baseCost, 1 + (Math.max(1, era) - 1) * BALANCE.prototype.costPerEra);
}

export interface PrototypeOutcome {
  /** The one stat worth fixing, or null when the prototype found nothing to flag. */
  flaw: StatKey | null;
  /** How much tighter the forecast band gets, in the same units `forecastBand` consumes. */
  confidenceGain: number;
}

/** Resolve a prototype attempt for a (seed, week, draft). Pure and total: the same inputs always
 *  produce the same outcome, and the flaw can only ever be the draft's own weakest stat. */
export function prototypeOutcome(
  seed: number,
  week: number,
  args: { era: number; weakestStat: StatKey | null; rp: number },
): PrototypeOutcome {
  const roll = hash01(seed, week, PROTOTYPE_SALT);
  const found = args.rp >= BALANCE.prototype.rpToCatchFlaw && roll < BALANCE.prototype.flawChance;
  return {
    flaw: found ? args.weakestStat : null,
    confidenceGain: BALANCE.prototype.confidenceGain,
  };
}
```

- [ ] **Step 3b: Register the salt**

`CLAUDE.md` carries the salt registry and is the single place a reader checks whether a salt is taken. Add `317` to that list with a one-line note that it is the Test Prototype's roll, so the next stream picks a different number:

```
  317 = Test Prototype's flaw roll (Design -> Testing; optional, player-action only).
```

- [ ] **Step 4: Add the balance constants**

```ts
  // --- Test Prototype (Silicon 2.0, Design -> Testing) ---
  prototype: {
    baseCost: 180_000,
    costPerEra: 0.6,
    weeks: 1,
    flawChance: 0.45,
    rpToCatchFlaw: 25, // below this the prototype still tightens the forecast, but cannot find a flaw
    confidenceGain: 18,
  },
```

- [ ] **Step 5: Verify, including determinism**

Run: `npx vitest run src/engine/prototype.test.ts` → PASS
Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS, byte-identical
Run: `npm test` → green
Run: `npm run sim` → unchanged (this task adds no tick behaviour; the sim must prove that)

- [ ] **Step 6: Commit**

```bash
git add src/engine/prototype.ts src/engine/prototype.test.ts src/engine/balance.ts
git commit -m "feat(engine): add the optional Test Prototype mechanic on a fresh salt"
```

---

### Task 4: The Development Stage lens

**Files:**
- Modify: `src/screens/DesignLab.tsx`
- Create: `src/screens/developmentStage.ts` (pure derivation)

**Interfaces:**
- Consumes: the existing design draft state and build pipeline.
- Produces: `developmentStage(draft): { stage: "concept" | "design" | "components" | "testing" | "finalize"; index: number }` — a pure read, **not a gate**.

- [ ] **Step 1: Write the pure derivation and its test**

`developmentStage` reads only what the draft already carries (whether components are all chosen, whether a prototype was run, whether a build is underway) and returns which stage the player is at. Test it against hand-built draft objects covering: nothing chosen → `concept`; components chosen but no prototype → `components`; prototype run → `testing`; build underway → `finalize`. It must never return a stage that implies an action is required — **it is a lens, not a gate**.

- [ ] **Step 2: Render it**

In `DesignLab.tsx`, render the five-stage stepper using the existing `.lab` tokens and `SectionRail`'s visual language (do not add a second rail primitive). The stepper reflects `developmentStage(draft)` and becomes interactive **only** when clicking a stage would switch to an existing existing tab — Testing is the only new step, and it must be reachable but never required.

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green; the count is the previous + the new stage tests
Run: `npm run build` → green
Run: `npm run verify:ui2` → PASS

```bash
git add src/screens/DesignLab.tsx src/screens/developmentStage.ts src/screens/developmentStage.test.ts
git commit -m "feat(ui2): show the design pipeline as a Development Stage lens"
```

---

### Task 5: Verification

**Files:** none (evidence only).

- [ ] **Step 1: The two proofs that matter**

Run: `npx vitest run src/state/activeRun.determinism.test.ts` → **byte-identical**
Run: `npm run sim` → **0/40 bankruptcies, all eras reached**, curve unchanged from the pre-wave baseline

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
npm run shots:diff -- wave3-off
```

Expected: the Design Lab's classic flow is unchanged; nothing new renders.

- [ ] **Step 4: Record the outcome**

Append a "Wave 3 outcome" section: status, commit range, the determinism and sim output verbatim, deferred minors.

---

## Wave 3 exit criteria

- [ ] A do-nothing 160-week run is **byte-identical** to the pre-wave trace.
- [ ] `npm run sim` shows no regression (0/40 bankruptcies, all eras reached).
- [ ] `financialHistory` is recorded every week, capped, and backfilled empty on old saves.
- [ ] Customer Rating is a pure derivation — no new state.
- [ ] Test Prototype costs money and one week, is optional, is deterministic on salt 317, and can only ever flag the draft's own weakest stat.
- [ ] Development Stage is a lens: no stage is ever required.
- [ ] Flag off → nothing new renders.
- [ ] `tsc` 0 · suite green · build green · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN.

## Deliberate scope notes

- **No `PAGE_IDS`-style registry for stats.** Test Prototype reuses the existing `StatKey` union.
- **The Company Growth chart itself is not in this wave.** It is a `DataChart` primitive task and belongs with the Company screen migration; this wave records the data it will read and proves the derivation, so the chart is a pure presentation task later.
- **No balance-tuning on the new constants.** They are placed in `balance.ts` with the sim as the check; tuning waits for the harness's verdict and, ideally, live players.

---

## Wave 3 outcome (completed 2026-09-16)

**Status: COMPLETE.** Tasks 0-4 batched and reviewed as one unit. Task quality: Approved, no Critical findings.

**The two gates that matter, run by the controller:**

- **Determinism pin - Tests 2 passed.** The reviewer independently confirmed the diff CANNOT change a do-nothing run: the tick work is a pure read (ecordFinancialWeek does no RNG and no mutation; sub/	oDollars/weeklyOutflow are pure), and no new branch gates a sim path. Note the honest caveat it raised: "byte-identical" holds between two runs of the same seed; there is no full-state frozen golden that would flag a legitimately added field.
- **
pm run sim (40 seeds) - Reached IPO/listed: 40/40,** era distributions unchanged (era 4 hit 23% / solid 50%; era 5 hit 17% / solid 52%), no bankruptcies.
- 
pm test green (1,999 tests / 185 files), 
pm run build green, 
pm run audit:screens CLEAN.

**Delivered:**

- inancialHistory - weekly revenue (the cumulativeRevenue delta, so it cannot drift from the ledger), expenses (weeklyOutflow, the exact basis of the runway readout), and a derived profit. Optional, capped at 260, backfilled [] in migrate() and in all three state constructors.
- customerRating(scores) - a pure derivation over the outlet scores that already exist. No new state.
- prototypeOutcome / prototypeCost - the optional Test Prototype. Salt 317, registered in CLAUDE.md. **Player-action only:** the reviewer grepped the tree and confirmed nothing in the tick or any cadence references it. The roll helper is a character-for-character copy of moonshots.ts's, not an approximation.
- developmentStage - a pure lens over the existing draft. Confirmed it cannot gate anything: it is never passed to missingSlots/openWizard/startBuild.

**A finding parked with a ruling (Important, not dismissed):**

> **The Testing step renders but can never activate.** DesignLab.tsx hard-wires prototypeRun: false, so the 	esting branch is unreachable and the step renders permanently disabled.
>
> **Ruling:** park it. The lens gates nothing, so there is no correctness or determinism risk, and the wave deliberately shipped the lens before the Testing action. **Cost if wrong: players see a step that cannot light up.** The recommended first fix next session is a one-liner: omit Testing from the rendered list until the prototype action ships, so the visible ladder matches what the app can actually do.

**Deferred minors:**

1. growthDeltas returns absolute dollars, not percent - the brief's interface text and its test disagreed; the implementer followed the test. Currently unconsumed, so harmless, but rename it to make the unit obvious before a chart reads it.
2. The quota-fallback trim in persistence.ts does not also trim inancialHistory, so a full second 260-row array survives the fallback.
3. Recorded expenses lag the UI by one week on the late-era drag term (identical basis, pre-tick state).
4. uilding is global, not per-draft, so an in-flight build can read an unrelated draft as inalize.
5. prototypeOutcome rolls only (seed, week, 317) - no per-draft sub-salt, so two prototypes in one week share a roll.
6. Two stacked .lab__tabs strips can render two lab__tab--on elements at once.
7. CLAUDE.md's new salt line has a stray trailing ).

**Process note:** the final whole-branch review was not run separately - the task review covered the whole batch, and the controller re-ran the pin, the sim, the suite, the build and the audit afterwards.
