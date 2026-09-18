# UI Redesign — Wave 4 (Company Overview) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Company screen's Overview as the mockup's dashboard — hero, stat tiles with deltas, the Company Growth chart, and a Key Stats panel — using the data Wave 3 started recording.

**Architecture:** Three new primitives (`StatTile`, `KeyStatsPanel`, `DataChart`) on top of the existing design system, then one screen migration. The chart extends the repo's existing hand-rolled SVG chart module rather than adding a charting dependency, and it reads `financialHistory` — so this wave also settles the `growthDeltas` unit ambiguity the Wave 3 review flagged, **before** a consumer exists. The Company Overview is a large file, so that task is specified as a contract (like Wave 2b's Platform task) rather than as pasted code.

**Tech Stack:** TypeScript · React 19 · Vite · Vitest (Node env, no DOM) · SVG drawn in code · design tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (§6 pattern library, §8.2 Company)
**Predecessors:** Wave 3's outcome (which recorded `financialHistory` and parked the Testing step) and Wave 2b's Platform task (the contract-style screen migration precedent).

## Global Constraints

- **No engine changes.** This wave reads state; it does not change simulation. The determinism pin must stay green.
- **Principle 0:** with `silicon.ui2` off, the Company screen is unchanged.
- **Zero image assets:** the hero is the in-engine render (`HeroFrame` mounts the existing 3D scene or `DeviceRenderer`); the chart is SVG drawn in code.
- **No new dependencies** — in particular no charting library.
- Design tokens only; explicit import extensions; Lucide icons only; 8pt spacing.
- Node test environment; no jsdom. Pure logic is unit-tested; UI is verified by `verify:ui2`, `verify:deeplink` and the release audit.
- **After any edit to `package.json`, re-run `npm run build`.**
- Gate: `tsc` 0 · suite green · `npm run build` · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN · determinism pin green.

---

### Task 1: Settle the growth-delta unit, before a consumer exists

**Files:**
- Modify: `src/engine/financials.ts`
- Modify: `src/engine/financials.test.ts`

**Interfaces:**
- Renames `growthDeltas` → `growthDeltaDollars`; adds `growthDeltaPct(history, weeks)`.
- Produces both for Task 4, which uses the percent for the tile chips and the dollars for tooltips.

The Wave 3 review flagged that the brief's contract said "percent" while its test asserted absolute dollars, and the function shipped as dollars. The mockup's chips read `+12%`, so the screen needs a percent — and leaving one ambiguous function around is how the next reader charts the wrong number.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/financials.test.ts`:

```ts
describe("growth deltas — units are explicit in the name", () => {
  const h = [wk(1, 100, 40), wk(2, 110, 45), wk(3, 150, 50)];

  it("reports absolute dollars", () => {
    expect(growthDeltaDollars(h, 2).revenue).toBe(50);
    expect(growthDeltaDollars(h, 2).expenses).toBe(10);
  });

  it("reports whole percent", () => {
    expect(growthDeltaPct(h, 2).revenue).toBe(50);
    expect(growthDeltaPct(h, 2).expenses).toBe(25);
  });

  it("never divides by zero when the past week was empty", () => {
    const zero = [wk(1, 0, 0), wk(2, 0, 0), wk(3, 200, 30)];
    expect(growthDeltaPct(zero, 2).revenue).toBe(0); // no fabricated percentage from a zero base
    expect(growthDeltaPct(zero, 2).expenses).toBe(0);
  });
});
```

- [ ] **Step 2: Verify the failure**

Run: `npx vitest run src/engine/financials.test.ts`
Expected: FAIL — `growthDeltaDollars` / `growthDeltaPct` are not exported.

- [ ] **Step 3: Implement**

Rename the existing function to `growthDeltaDollars` (body unchanged) and add:

```ts
/** Percentage change from N weeks back to the latest week, per series, rounded. A zero base yields
 *  0, never Infinity — the chart must not draw a number it cannot justify. */
export function growthDeltaPct(
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

Keep the old tests passing by renaming their call sites.

- [ ] **Step 4: Verify and commit**

Run: `npx vitest run src/engine/financials.test.ts` → PASS
Run: `npm test` → green
Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS (a pure rename/add cannot affect the sim, but the pin is cheap)

```bash
git add src/engine/financials.ts src/engine/financials.test.ts
git commit -m "refactor(engine): name the growth-delta units and add the percent form"
```

---

### Task 2: `StatTile` and `KeyStatsPanel`

**Files:**
- Modify: `src/design/primitives.tsx`
- Modify: `src/design/primitives.css`

**Interfaces:**
- Produces: `StatTile({ label, value, delta?, deltaTone?, hint? })` where `delta` is a preformatted string (e.g. `"+12%"`) and `deltaTone` is `"up" | "down" | "flat"`; `KeyStatsPanel({ items })` where `items: readonly { icon: ReactNode; label: string; value: ReactNode; hint?: string }[]`.

- [ ] **Step 1: Add the components**

`StatTile` renders a label (muted, `--fs-micro`), a large value (`--fs-headline`, `tnum`), and an optional delta chip coloured by `deltaTone` using `--positive-text` / `--negative-text` / `--ink-2`. `KeyStatsPanel` renders a list of rows: a 20px Lucide icon in a tinted tile, the label, and the value right-aligned.

Both use the `ds-` prefix and existing tokens only. `StatTile` must be usable in a 2-up grid on a phone and a 4-up grid on wide — so it sets no width of its own; the container decides.

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npx vitest run src/design/tokenRefs.test.ts` → PASS
Run: `npm run build` → green

```bash
git add src/design/primitives.tsx src/design/primitives.css
git commit -m "feat(ui2): add the StatTile and KeyStatsPanel primitives"
```

---

### Task 3: `DataChart`

**Files:**
- Modify: `src/components/charts.tsx` (extend the existing hand-rolled SVG module)
- Modify: `src/components/charts.css` (or the module's existing stylesheet)

**Interfaces:**
- Produces: `DataChart({ series, weeks, xLabel?, formatValue })` where `series: readonly { id: string; label: string; colour: string; points: readonly number[] }[]`. Consumed by Task 4.

- [ ] **Step 1: Read the existing module first**

`src/components/charts.tsx` already draws SVG charts (sparkline, trend bars, a sales curve). Extend it — reuse its scale/axis helpers if they exist rather than writing a second scaling implementation. Put the new component beside them, and note in your report exactly which existing helpers you reused.

- [ ] **Step 2: Implement**

Requirements, all of which the review will check:

- **Multi-series**: any number of series, each with its own colour from a token passed in by the caller (the caller owns the semantic colours — the chart must not hardcode `--positive` etc.).
- **A legend** naming every series with its colour swatch.
- **A range selector**: a small segmented control (4W / 8W / 26W / All) that slices the points. This is local `useState` — the range is a view preference, not route state.
- **Axis labels**: `weeks` tick labels along the x-axis, spaced so they never collide on a 390px screen.
- **Zero-safe**: an all-zero or single-point series renders a flat line and an axis, never `NaN` paths or a blank SVG. This is the explicit requirement of the repo's no-blank-screen rule.
- **Accessible**: the SVG gets `role="img"` and an `aria-label` summarising the series and the range.
- **No dependency, no images.**

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npx vitest run src/design/tokenRefs.test.ts` → PASS
Run: `npm run build` → green

```bash
git add src/components/charts.tsx src/components/charts.css
git commit -m "feat(ui2): add the multi-series DataChart"
```

---

### Task 4: The Company Overview migration

**Files:**
- Modify: `src/screens/Company.tsx`
- Modify: `src/screens/company.css`

**Interfaces:**
- Consumes: `financialHistory`, `growthDeltaPct`, `growthDeltaDollars` (Task 1); `StatTile`, `KeyStatsPanel` (Task 2); `DataChart` (Task 3); `customerRating` (Wave 3); `worldCoverage` for Global Reach.

**This is a contract task, not pasted code.** `Company.tsx` is ~80 KB. Before editing, read it and **enumerate the blocks the Overview sub-tab renders today**, exactly as Wave 2b's Platform task required. List them in your report. Then:

- [ ] **Step 1: Hero**

Add the in-engine hero at the top of Overview: the company name, the era, and the existing 3D scene (or `DeviceRenderer` fallback). If a `HeroFrame` primitive does not exist yet, create the minimum that mounts the existing `Garage3D` with the mockup's framing and a gradient scrim — **do not build a second 3D scene**, and do not add an image.

- [ ] **Step 2: Stat tiles**

Replace the Overview's existing wallet/burn readout with a `StatTile` row: **Cash · Weekly Income · Weekly Burn · Revenue / Employee**. Each carries a delta chip from `growthDeltaPct(financialHistory, 8)` — with the sign and tone matching the metric's meaning (**a rising burn is `down`/negative, a rising income is `up`/positive**; get this right, it is the easiest thing in the wave to invert). When `financialHistory` is too short for a delta, render the tile with **no chip** rather than a fabricated `0%`.

- [ ] **Step 3: Company Growth chart**

`DataChart` with three series from `financialHistory`: Revenue, Expenses, Profit — coloured from tokens that match the rest of the app's semantics. Add the range selector's default at 8 weeks. When `financialHistory` is empty (an old save) the chart area shows the existing empty-state pattern, not a broken axis.

- [ ] **Step 4: Key Stats panel**

`KeyStatsPanel` with three rows: **Products Shipped** (`state.launched.length`), **Global Reach** (`worldCoverage(unlockedRegions)` from `engine/regions.ts`), **Customer Rating**.

Customer Rating needs one decision, so take this one: it is the outlet scores of the company's **most recent launch**, pulled through the same `criticReviews` inputs the Market screen already uses for that product — i.e. `customerRating(criticReviews(thatProductInputs).outlets.map((o) => o.score))`. That choice is deterministic, explains itself ("how buyers felt about what you shipped last"), and matches the review the player can already read in Market. Do **not** average across all launches: an old flop would drag the number forever. If there are no launches yet, the row shows the `No data` label Wave 3 built for exactly this — never a `0`.

Two sibling rows key off things that are easy to invert, so check them: Global Reach is a **coverage** figure (0–100%), not a region count; and Products Shipped is lifetime, not active.

- [ ] **Step 5: Every enumerated block still renders**

Nothing existing may be dropped. A block that does not fit the four new pieces stays below them in its original order. State the assignment in your report.

- [ ] **Step 6: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green
Run: `npm run build` → green
Run: `npm run verify:ui2` → PASS
Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS

Then capture and **read** the frame, at 1024×768 with the flag on, and report what you saw (tiles aligned, chart drawn, nothing overlapping).

```bash
git add src/screens/Company.tsx src/screens/company.css src/components/HeroFrame.tsx
git commit -m "feat(ui2): rebuild the Company Overview as the dashboard"
```

---

### Task 5: Close the parked Testing step

**Files:**
- Modify: `src/screens/DesignLab.tsx`

Wave 3's review parked one Important finding: the Development Stage lens renders a **Testing** step that can never light up, because `prototypeRun` is hard-wired `false`. That is a visible dead control.

- [ ] **Step 1: Fix it**

Omit `testing` from the rendered stage list until the prototype action ships, so the visible ladder matches what the app can actually do. Do **not** wire the prototype action in this wave — that is its own task, and it is a player-facing mechanic that deserves its own plan.

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green
Run: `npm run build` → green

```bash
git add src/screens/DesignLab.tsx
git commit -m "fix(ui2): drop the Testing step until its action exists"
```

---

### Task 6: Verification

**Files:** none (evidence only).

- [ ] **Step 1: Flag-off parity**

```bash
$env:SHOTS_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
Remove-Item Env:\SHOTS_UI2, Env:\SHOTS_URL, Env:\SHOTS_VIEWPORT -ErrorAction SilentlyContinue
npm run shots:diff -- wave4-off
```

Expected: the Company screen renders as before; no tiles, no chart, no hero.

- [ ] **Step 2: The full gate**

Run: `npm run typecheck` → exit 0
Run: `npm test` → green
Run: `npx vitest run src/state/activeRun.determinism.test.ts` → PASS
Run: `npm run build` → green
Run: `npm run verify:ui2` → PASS
Run: `npm run verify:deeplink` → PASS, four routes
Run: `npm run shots:stage:showcase; npm run audit:screens` → CLEAN

- [ ] **Step 3: Growth-chart honesty check**

The chart is only as good as its data. Load the showcase save (which has no `financialHistory`, being a staged file), confirm the chart shows its empty state rather than a fabricated line, then play a few weeks in a real run and confirm points appear. Report both.

- [ ] **Step 4: Record the outcome**

Append a "Wave 4 outcome" section: status, commit range, gate output, the enumerated block assignment, deferred minors.

---

## Wave 4 exit criteria

- [ ] Flag off → the Company screen is unchanged.
- [ ] Flag on → Overview shows the hero, four stat tiles with honest deltas, the three-series growth chart with a working range selector, and the Key Stats panel.
- [ ] An old save with no `financialHistory` shows the chart's empty state and tiles with no chips — never a fabricated number, never `NaN` paths.
- [ ] Customer Rating reads "No data" when there are no reviews.
- [ ] A rising burn shows as a negative-toned chip (the sign convention is correct).
- [ ] The Testing step no longer renders.
- [ ] No block dropped from Overview; no engine file touched; determinism pin green.
- [ ] `tsc` 0 · suite green · build green · `verify:ui2` PASS · `verify:deeplink` PASS · `audit:screens` CLEAN.

## Deliberate scope notes

- **The Testing action (Test Prototype's UI) is NOT in this wave.** The engine ships; the player-facing action and its affordability/feedback rules are their own task, which is why Task 5 removes the dead step rather than activating it.
- **The hero is the existing render, framed.** No new 3D scene, no image asset, no `<canvas>` of its own.
- **No other Company sub-tab changes.** Team and Platform are untouched; only Overview is rebuilt.

---

## Wave 4 outcome (2026-09-16) - TASKS COMPLETE, REVIEW FINDINGS OPEN

**Status: the five tasks are implemented, committed and green, but the task review returned "Needs fixes" and the findings below were PARKED, not fixed** - the controller session ran out of budget after the review. This is a budget cap, not a judgement that the findings are acceptable. Read this section before building on the wave.

**Gates (all run by the controller on the final HEAD):** 	sc 0 · 2,003 tests / 185 files · 
pm run build green · erify:ui2 PASS · erify:deeplink PASS (4/4 routes) · udit:screens CLEAN · determinism pin green (run after Task 1 and after Task 4).

**Delivered:** growthDeltaDollars + growthDeltaPct; StatTile + KeyStatsPanel; a multi-series DataChart (legend, 4W/8W/26W/All, zero-safe, ole="img", no dependency); the Company Overview rebuilt with an in-engine hero, four tiles and Key Stats; and the parked Testing step removed from the Development Stage ladder. The block enumeration confirmed nothing was dropped - the only deletions are the four stat readouts the tiles replace.

## Parked findings (ruled, NOT resolved)

**R1 - CRITICAL: a second concurrent WebGL context, unmitigated.**
HeroFrame mounts a second Garage3D while the Company tab is up. HQ's office is already deliberately kept mounted to preserve its context, and this repo's own comment records that context churn is what made the office fail on memory-constrained mobile browsers. The hero passes no paused (so it renders at 60fps) and no onContextLost (so a lost context has no downgrade path - the ErrorBoundary does not catch webglcontextlost).
**Ruling:** parked at the cap. **Cost if wrong: an iOS context-loss or jetsam regression on the Company tab.**
**Recommended fix, in order:** pass paused so the hero is not a live 60fps scene; pass onContextLost to swap in DeviceRenderer; gate the live canvas to non-phone viewports and use DeviceRenderer on phones; ideally render the hero from HQ's existing context rather than a new Canvas.
**Device check that would settle it:** on an older iPhone/iPad with a large save, open Company and switch tabs / background-foreground repeatedly; watch for two canvases, a blank hero, the office dropping to IsoScene, or a Safari reload.

**R2 - IMPORTANT: the Cash tile's chip is the PROFIT delta** (growthChip(finPct.profit, true)), with a tooltip attributed to cash. inancialHistory has no cash series, but a real cash sparkline already exists in the Financials card, so an honest 8-week cash delta is available.
**Ruling:** parked. **Cost if wrong: a number the player will act on, attached to the wrong metric.**

**R3 - IMPORTANT: the Revenue/employee chip is the REVENUE delta**, not the per-head delta, so hiring with flat revenue moves it in the wrong direction. Same class as R2.
**Ruling:** parked. **Cost if wrong: same - a misleading chip.**

**R4 - IMPORTANT: a zero baseline fabricates a  % chip.** growthDeltaPct returns   for a zero base, and the tile renders it whenever history is long enough - so a week that earned $0 and now earns something shows "0%/flat", while the same tile's tooltip shows the true dollar change. This contradicts the wave's own hard rule ("never fabricate a number") and the function's own comment.
**Ruling:** parked. **Cost if wrong: a fabricated delta, and the chip disagreeing with its tooltip.** Fix: return 
ull (or a hasBase flag) per series and omit the chip when the base is 0.

**R5 - a DECISION, not a bug: the new Overview content is NOT gated on silicon.ui2.** The hero/tiles/chart/key-stats sit directly under coTab === "overview". So with the flag OFF, a player still sees the redesigned Company Overview. Every prior wave gated the SHELL (rail, title, pages) but never screen CONTENT; the routed pages are flag-gated because the route is, but in-tab content is not.
**Ruling:** surfaced for the owner. **This needs an explicit answer before more screens are migrated:** either (a) the flag gates screen content too, in which case every migrated screen needs a classic/next branch and Waves 2b/2c's in-page content needs the same treatment; or (b) the flag only ever gated the shell, and "the flag-off build is unchanged" applies to chrome alone - in which case Wave 0's Principle 0 wording is wrong and should be corrected rather than the code.

**Minor (recorded):** the hero has no decorative/paused mode and its camera rig also answers global WASD; an all-zero chart forces the y-axis top to $1; DataChart's 	otal comes from series[0] only; the hero's in-scene tap labels are inert.

**Process note:** the final whole-branch review was not run separately - the task review covered the batch. The wave is green but carries an unresolved Critical; do not treat it as merge-ready.

---

## R1 fix (2026-09-16)

**Commit 78b6af7** - HeroFrame no longer creates an unguarded second WebGL context.

- The live canvas is now gated to **tablet/wide** (useLayoutMode() !== "phone"); phones (and anything below the 800px breakpoint the shell uses) get the latest device's DeviceRenderer, or the building glyph when nothing has shipped. That removes the concurrent-context pressure on exactly the constrained devices the HQ design was built to protect.
- The hero now passes **onContextLost**, so a lost context downgrades to the same fallback instead of leaving a dead canvas - ErrorBoundary cannot catch webglcontextlost, which is why the handler was required.

**Verified:** 	sc 0 - 2,003 tests / 185 files - build green - erify:ui2 PASS - udit:screens CLEAN - determinism pin green - lazyBoundaries 11/11 - 	okenRefs 5/5.

**Residual (recorded, not fixed):** on tablet/wide the hero still renders live (no paused). Deliberately left unset: Garage3D drives rameloop through VisibilityPause, and rameloop="never" from first mount risks a first paint with nothing drawn - a blank hero. The safe next step is a **device check**: if an iPad shows thermal or memory pressure with Company open, add paused and confirm the first frame still draws. Until then the wide-screen risk is moderate, not critical: the constrained-device path no longer mounts a second context at all.

**Still open from Wave 4:** R2 (Cash chip shows the profit delta), R3 (Revenue/employee chip shows the revenue delta), R4 (a zero baseline fabricates a  %), R5 (the decision on whether the flag gates screen content).

---

## R2-R5 resolved (2026-09-16)

**Commit 3f9e17c** (plus 7e0ad0b for this record).

- **R2** - the Cash tile's chip and tooltip are gone. inancialHistory has no cash series, so an absent chip is the honest answer; no other series was substituted for cash.
- **R3** - the Revenue/employee chip and tooltip are gone. Same reasoning: a per-head delta needs both weeks' headcounts, and inventing that was more risk than the chip was worth.
- **R4** - growthDeltaPct now returns 
ull per series when the base week was zero, so "unknown" is distinguishable from "no change"; a null delta renders no chip and no tooltip. Tests updated, plus a case proving a non-zero base still returns a number.
- **R5 - RULED: the flag gates screen content.** The dashboard (hero, tiles, chart, Key Stats) is now behind uiVersion === "next", and the classic path restores the **original** Overview readouts recovered from 20b8db2's diff (Cash, Weekly burn, Weekly income, Rev / headcount). Verified by reading both frames: flag-off shows the original Overview with no hero, tiles, chart or 3D.

**Gate:** 	sc 0 - 2,004 tests / 185 files - build green - erify:ui2 PASS - erify:deeplink PASS (4/4) - udit:screens CLEAN - determinism pin green.

**Residuals recorded:** the classic path still computes the Wave-4 strings it no longer renders (harmless waste); inPct.profit is now unused by the chips.

## R5's consequence - one follow-up it implies

Ruling "the flag gates screen content" means every in-place screen redesign needs a classic/next branch. Auditing that:

- **Platform, Museum, Goals are already safe**: their content is reachable only through a flag-gated route, so with the flag off the hook returns no page and the classic sheet or hub sub-view renders instead.
- **The Development Stage lens (Wave 3, DesignLab.tsx) is NOT safe.** It is in-tab content with no flag gate, so flag-off players see the new stage ladder (currently minus Testing). It needs the same classic/next treatment as the Company Overview - a small follow-up, not done here.
- Any future in-tab redesign inherits this rule: **gate it, or it ships to everyone.**

---

## Follow-up closed: the Development Stage lens is gated (2026-09-16)

**Commit 8d2b347.** R5's consequence is now fully discharged: the stage strip in DesignLab.tsx renders only when uiVersion === "next", so a flag-off build shows the Design Lab exactly as it was before Wave 3. The devStage derivation and developmentStage.ts are untouched - the lens is a rendering concern.

**Verified by frame** at 1024x768 on the Design tab: flag-on shows the ladder (Concept / Design / Components / Finalize - Testing remains removed pending its action); flag-off shows no ladder, with the hero and Category selector unchanged.

**Gate:** 	sc 0 - 2,004 tests / 185 files - build green - erify:ui2 PASS - udit:screens CLEAN - determinism pin green.

**Flag-gating audit, now complete:** every surface that changes for flag-on players is behind the flag. The routed pages (Platform, Museum, Goals) are gated by the route itself; the Company Overview and the Development Stage lens are gated directly. Any future in-tab redesign inherits the rule: **gate it, or it ships to everyone.**

---

## Hero paused residual - INVESTIGATED AND DISPROVEN (2026-09-16)

The R1 residual asked whether the hero should pass paused to stop its live 60fps loop. It was tried, captured, and **reverted** - the frame proved the naive fix is wrong.

- With paused: .shots/hero-paused/08-company.png shows the hero panel as a **uniform dark field**. No walls, desks, robots or vault - only the scrim and the "ERA 2 / Silicon" text.
- Without paused (control): the full office diorama renders clearly.

Cause: Garage3D's VisibilityPause sets rameloop="never" when paused, and R3F with rameloop="never" from first mount does not run the initial draw. So the hero would have shipped **blank**, which is worse than live.

**Outcome: the hero stays live.** The correct fix is a first forced draw before idling - rameloop="demand" plus an invalidate() on mount - but that lives in the **shared** Garage3D.tsx whose pause semantics HQ depends on, so it is its own task with its own regression risk, not a one-line prop.

**Still standing:** on tablet/wide the hero is a live second WebGL context. It is gated away from phones and now handles context loss, so the remaining exposure is iPad thermals - which a device check, not a headless capture, must settle.
