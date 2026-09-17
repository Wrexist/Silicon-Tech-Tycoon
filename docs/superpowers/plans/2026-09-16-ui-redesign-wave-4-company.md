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
