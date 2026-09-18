# Wave 4 Company Overview — code-review fixes (R2–R5)

Branch: `feat/ui2-wave-0`
Commit: `3f9e17c` — `fix(ui2): correct Company Overview deltas and gate the dashboard`
(one combined commit; see "Why combined" below)
Files changed: `src/engine/financials.ts`, `src/engine/financials.test.ts`, `src/screens/Company.tsx`

## Why one combined commit

R2, R3 and R4 all rewrite the same chip-computation lines in `Company.tsx`. R4's engine
change (`growthDeltaPct` → `number | null`) does not typecheck until `Company.tsx` stops
passing `finPct.revenue` into `growthChip(pct: number)`, so the engine edit and the UI edit
must land together. Splitting into per-finding commits would leave a non-compiling
intermediate tree, so the four fixes ship as one commit.

## R2 — the Cash tile's chip showed the PROFIT delta

Removed `cashChip` entirely, along with the Cash tile's `title` (the delta tooltip). The tile
now renders `label + value` only. No series was substituted — `financialHistory` has no cash
series, so an absent chip is the honest answer.

## R3 — the Revenue/employee chip showed the REVENUE delta

Removed `revHeadChip` and the Revenue/employee tile's `title`. No per-head delta is computed.

## R4 — a zero baseline fabricated a `0%` chip

`src/engine/financials.ts`:

- Added `export interface GrowthPct { revenue: number | null; expenses: number | null; profit: number | null }`.
- `growthDeltaPct` now returns `null` for a series whose base week is zero (and for all three
  when there is no baseline row); `growthDeltaDollars` is unchanged.

`src/engine/financials.test.ts`:

- The zero-base test now asserts `null` for revenue/expenses/profit (and asserts profit too).
- Added a case proving a non-zero base still returns a number (revenue 50, expenses 25).

`src/screens/Company.tsx`:

- Chips are built only on a non-null pct:
  `finPct.revenue !== null ? growthChip(finPct.revenue, true) : null` (same for expenses).
- A `null` delta means no chip and no tooltip, exactly like too-short history.

## R5 — the Overview was not gated on `silicon.ui2`

`Company.tsx` already imports and reads `useUiVersion()` (used for Platform routing), so the
same `uiVersion` now gates the Overview content:

- `const isNext = uiVersion === "next";` and `finHistory = isNext ? (state.financialHistory ?? []) : []`
  — the classic path never reads `financialHistory`.
- `{isNext && (<> … </>)}` wraps the hero, the four `StatTile`s, the "Company growth" `DataChart`
  card and the "Key stats" `KeyStatsPanel` card. Because `&&` short-circuits, `StatTile`,
  `DataChart` and `KeyStatsPanel` elements are never even constructed on the classic path.
- `{uiVersion === "classic" && …}` restores the four original Financials readouts in the
  `co__fin-grid`: `Cash`, `Weekly burn` (tone negative), `Weekly income` (tone positive) at the
  top, and `Rev / headcount` after `Weekly net`. The rest of Overview renders identically in
  both paths.

### Where the classic markup was recovered from

`git show 20b8db2 -- src/screens/Company.tsx` (the Wave 4 rebuild commit). Its diff deleted
these four `Stat`s from the `co__fin-grid`; they were rebuilt byte-for-byte in structure and
copy, in the original order:

```
<Stat label="Cash" value={<AnimatedMoney value={state.cash} />} />
<Stat label="Weekly burn" value={format(wkBurn)} tone="negative" />
<Stat label="Weekly income" value={format(wkRev)} tone="positive" />
… Research / Services / Runway / Weekly net …
{state.staff.length > 0 && toDollars(wkRev) > 0 && (
  <Stat label="Rev / headcount" value={format(dollars(Math.round(toDollars(wkRev) / state.staff.length)))} tone="accent" hint="/wk" />
)}
```

## Commands and real output

```
$ npx tsc -b --noEmit
(no output — exit 0)

$ npx vitest run src/engine/financials.test.ts src/state/activeRun.determinism.test.ts
 Test Files  2 passed (2)
      Tests  10 passed (10)

$ npm test
 Test Files  185 passed (185)
      Tests  2004 passed (2004)
```

Final test count: **2004 passed / 185 files** (was 2003 before; the zero-base test was split in
two, +1).

```
$ npm run build
✓ built in 16.50s   (PWA: 80 precache entries)

$ npm run verify:ui2
PASS: onboarding completed with the flag on, no hook/console errors, rail rendered.
```

Determinism: `npx vitest run src/state/activeRun.determinism.test.ts` is part of the 10-test
run above and is green. `growthDeltaPct` is a pure return-type change with no RNG/state effect.

## Captured frames (1024×768)

Both shot via `npm run shots:diff` with `SHOTS_VIEWPORT=1024x768`, on the fresh `dist/` from
`verify:ui2`.

- **Flag ON** — `.shots/ui2on-1024/08-company.png` (`SHOTS_UI2=1`)
  Shows the Wave 4 dashboard: the 3D hero ("ERA 2 / Silicon"), the four stat tiles
  (Cash **$79.13M — no chip**; Weekly income $240.86K **+3%**; Weekly burn $11.03K **0%**;
  Revenue / employee $60.21K/wk **— no chip**), and the "Company growth" line chart with the
  4W/8W/26W/All range control. The Cash and Revenue/employee chips are gone as intended; the
  burn chip's `0%` is a genuine no-change on a non-zero base, not the zero-base fabrication.

- **Flag OFF** — `.shots/ui2off-1024/08-company.png` (no `SHOTS_UI2`)
  Shows the ORIGINAL Overview: **no hero, no tiles, no growth chart, no hero 3D**. The first
  card is "Financials", whose grid reads exactly the shipped readout — Cash $79.13M, Weekly burn
  $11.03K (negative), Weekly income $240.86K (positive), Research +12.0 RP, Services $355/wk,
  Runway Profitable, Weekly net +$229.83K, Rev / headcount $60.21K/wk — followed by the cash
  sparkline and projection bars. Classic chrome (bottom nav) as expected.

## Concerns

1. **The burn chip legitimately reads `0%` in the flag-on frame.** R4 only suppresses the
   *zero-base* case; a non-zero base with an unchanged value is a real zero change, so `0%` is
   correct. Flagging it so the frame isn't mistaken for a regression.
2. `finPct.profit` is still computed but no longer read by any chip (only revenue/expenses are).
   Harmless — it stays part of the `GrowthPct` contract and the `growthDeltaDollars.profit`
   tooltip path was removed with R2.
3. On the classic path the component still computes the Wave 4 derived *strings* (`revPerHead`,
   `lastLaunch`/`rating`, `growthSeries`) but never renders them; only `financialHistory` is
   explicitly guarded, per the review's wording. `dollarsTitle` returns `undefined` in classic
   because `hasFinDelta` is false. No visual or behavioural leak.
