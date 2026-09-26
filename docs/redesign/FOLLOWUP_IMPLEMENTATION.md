# Follow-up fixes — 2026-09-23

This implements the findings in FOLLOWUP_AUDIT.md. That file remains the original audit record.

## Implemented

- Research era totals include completed, active and queued projects. Completed eras remain explicit. Available project choices precede historical boosts and the roadmap.
- Design drafts and selected stages persist in versioned, run-scoped local storage. Validation rejects malformed renderer input and future timelines. A previous valid copy supports recovery. Save failures are visible; undo/redo retain up to 40 changes. An inactive company tab cannot autosave over the active tab.
- Market valuation is limited to Standing. Products and Demand lead with their own decisions.
- Company and Market use the same forecast revenue/outflow/cash-surplus basis. Debt payments are included in outflow; upfront production investment is separate. No simulation balance changes.
- Advice severity and price bands share one assessment. Missing components, excessive price and weak components lead to the relevant controls. Buyer priorities and actual model factors explain fit; estimates are not sales guarantees.
- Artwork failure is tied to the failed asset, so a different valid asset can load. Research fallback uses a flask.
- Office workers use a shared smaller procedural scale with recalculated chair/sofa contact. Camera target reduces upper empty space; light-mode decorative glow pools are removed. Existing geometry, animation and owned placements remain intact.
- Company team preview precedes its chart, with direct team access in the identity row. Role illustrations are more compact.
- Charts expose selectable periods, keyboard controls and recorded-value tables.
- Suspended time explains its cause. Pending decisions link to the existing inbox only when no higher-priority interrupt blocks it.
- Product comparison shows the draft, most recent same-category product and a selectable recorded rival. Own unit margins use current supply costs; rival costs remain undisclosed.
- Optional weekly recap reads the saved ledger and activity feed. It creates no extra popup.
- The showcase generator clears valuation history invalidated by its staged financial overrides. Capture harnesses do the same for the older fixture. No historical curve is manufactured.

## Generated / reused

The five previously generated GPT raster assets remain integrated. This follow-up requires no new raster artwork. Parametric devices and real office geometry are retained. See assets.json for prompts, references and provenance.

## Verified

- Full Vitest suite: **204 files, 2,140 tests passed** (`followup-tests.log`). Eight new regression tests cover draft validation/recovery, storage failure, run isolation, research totals and advice consistency.
- TypeScript and Vite production build passed (`followup-build.log`). Existing chunk-size and mixed-import warnings remain.
- Responsive browser checks: **45 passed**, covering all five screens at 320x568, 390x844 with 130% text, 430x932 and 820x1180. No horizontal page overflow or insufficient dock reservation in these cases.
- Follow-up browser reproduction confirms draft reload, undo/redo, corrected 1/6 research counter, Products without the valuation card, and keyboard-selectable chart values. No page errors in that run. Evidence: `followup-verified/findings.json`.
- Functional browser flows: **16 passed**, including research refunds/cancellation, continuous time, preserved placements, missing-asset fallback, empty histories and dark screens. The failure test blocks service workers so cached assets cannot hide simulated network errors.
- Screenshots use explicit 390x844 viewport clips; the resource header is included. Screenshots and functional-flow results are under `artifacts/redesign-implementation/`.

## Blocked / limits

No physical iPhone is connected; Windows cannot run Xcode. Physical touch, safe areas, thermal/battery behavior, frame pacing and native iOS lifecycle recovery require device testing. Software-rendered browser screenshots are not a device performance benchmark.

Existing low-poly office geometry remains visibly different from the offline mockup render. Saved room finishes are respected. Draft storage is local to the device/browser; it is not cloud synchronization. Small screens and larger text scroll to additional content rather than shrinking touch targets.
