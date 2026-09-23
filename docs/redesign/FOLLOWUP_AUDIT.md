# Follow-up audit — 2026-09-23

Scope: current five-screen implementation, source inspection and isolated Chrome reproduction against the built app. Player saves were not touched. This is an audit; findings below are not marked fixed. Evidence: `artifacts/redesign-implementation/followup-audit/findings.json`.

## Prioritized findings

| Priority | Finding | Evidence and consequence | Proposed correction |
|---|---|---|---|
| P1 | Research era completion counter is always zero | `Research.tsx:502-505` removes completed projects before counting them. With Assembly Line completed, browser shows `Garage Era 0/5` instead of 1/6. | Derive totals/completed from the full era catalogue, then separately filter visible cards. Add regression coverage. |
| P1 | Design draft does not survive reload | `DesignLab.tsx:271` stores the draft only in component state. Browser: `Audit unsaved draft` survives tab navigation but becomes `Aurora Air 2` on reload. | Persist a versioned, validated draft tied to the current run. Include selected stage, safe recovery and a visible saved status. Existing tab retention works. |
| P2 | Market valuation dominates Products and Demand | `Market.tsx:213` renders valuation outside the selected panel. At 390x844 the card ends around y675 with the dock beginning at y728, leaving little space for the selected content. | Keep the full valuation/chart under Standing. Put product performance and demand decisions first in their respective panels. |
| P2 | Financial label is more precise than its calculation supports | `managementMetrics.ts` subtracts `weeklyOutflow`; this includes debt service, and upfront production investment is excluded. Arithmetic is consistent across screens, but the result is labelled net profit. | Clearly label the current figure as forecast weekly cash surplus/operating cash flow, or define a distinct profit measure. Keep actual history separate from forecasts. Do not change balance to solve wording. |
| P2 | Design advice always has warning treatment | `DesignLab.tsx:722` unconditionally uses amber + warning icon, including cases with no missing components or meaningful price/part problem. Price advice begins at ratio >1.2 while other panels still label ratios below 1.3 Fair. | Derive severity and text from one assessment; distinguish information, opportunity and actual risk. Use the main demand/price/competition driver rather than a generic instruction. |
| P3 | Artwork fallback cannot recover when the asset changes | `management.tsx:6-9` keeps `failed=true` across a new asset prop. An initially missing illustration can leave the next valid project illustration stuck on a generic users icon. | Reset failure for a new asset or key the image by asset; choose a context-appropriate fallback. Source-confirmed; not reproduced as an end-user flow in this audit. |

## Visual and interaction improvements

- Office still falls short of the approved reference: robots dominate desk scale, much of the scene card is empty, and low-detail furniture/materials do not match the portrait artwork. Tune camera framing, worker/workstation proportions, lighting and material consistency. Preserve owned placements; do not repaint saved brick walls merely for screenshots.
- Company team management and role portraits sit below the first viewport. Reduce repeated financial explanation and give team actions a clearer place without shrinking readable text or touch targets.
- Research needs available choices closer to the active work. Completion progress, queue, completed boosts, income breakdown and future unlocks should remain distinguishable.
- Charts need selectable values and an accessible textual/table alternative. Current DataChart's accessible label names series/range but does not expose their numerical points.
- The clock's disabled “Waiting” state should explain what it is waiting for and link to the existing decision flow where appropriate.

## Useful additions, in order

1. Saved drafts, recovery and design undo/redo. These protect player effort.
2. Side-by-side comparison of a draft, a previous product and a relevant rival: price, specs, unit margin and fit from existing simulation calculations.
3. A concise explanation of the largest factors behind the fit/launch forecast, with actions that jump to the relevant controls. Avoid invented precision about expected sales.
4. An optional compact weekly recap based on existing recorded events/history, integrated with the existing feed/decision inbox rather than another compulsory popup.

Do not prioritize additional currencies, new root tabs or more interrupt popups. The current game already has research, staffing, production, stock trading, progression and multiple event systems; making those easier to understand has higher value.

## Evidence limits

- Browser reproduction produced no page errors in the exercised paths. This does not establish absence of bugs elsewhere.
- The showcase fixture has current valuation around $2.73B but its last stored historical value is about $27.62M. This explains the screenshot inconsistency; the inspected chart reads supplied history. It is a demo-data quality issue, not evidence of a cents conversion bug in live simulation.
- Screenshot header visibility varies in prior captures. Runtime inspection found the resource header at y0 with an 80px height. Do not infer a production navigation bug from those captures alone; capture with settled animations and validate the image.
- Physical touch gestures, frame pacing, thermal/battery cost and native iOS lifecycle/save recovery still require testing on a representative iPhone. Software-rendered screenshots and passing layout tests do not establish smooth performance.

Recommended sequence: fix the Research counter → protect drafts → correct financial/advice semantics → improve per-tab hierarchy → office visual/performance pass → add comparison tools.
