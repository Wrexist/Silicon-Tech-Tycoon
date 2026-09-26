# Factory audit fixes - 2026-09-25

Implements the software work from `PRE_TESTFLIGHT_AUDIT.md`. Marketing version remains 1.4.0. No TestFlight upload was requested or performed in this pass.

## Implemented

| Audit item | Result |
|---|---|
| F01 | Recenter flushes OrbitControls damping before applying the final camera and target. Reset remains stable after repeated pinch/orbit. |
| F02 | Working stations are exclusive. When the only adjacent station is occupied, the second head stays parked at its owned footprint and does not animate over another head. The inspector explains how to give it space. Owned coordinates and simulation balance are unchanged. |
| F03 | Auto distinguishes missing Intake/Packer from a route that cannot fit. Crowded floors recommend clearing space or expanding; rejected operations remain free and preserve the layout. |
| F04 | Saved-layout controls have 44px hit areas, wrapping rows and an accessible naming field. Other undersized Factory action buttons were enlarged too. |
| F05 | Layout and side-order descriptions use real punctuation instead of literal question-mark separators. |
| I01 | Review decision is available inside Factory. Inbox decisions use the existing decision bus; company choices close Factory and focus the Office decision card. Another-tab holds remain non-actionable here. |
| I02 | Repeated conveyor beds/surfaces use two instanced draw calls. Hidden previews remain stopped; previews omit contact shadows. Full-view contact shadows render once per layout revision. Paused/reduced-motion scenes render on demand while camera controls remain usable. Physical profiling is still required. |
| I03 | Accessible machine selector, blue selection ring, Focus machine and Clear selection. Recenter restores the full floor. Existing touch placement/hold/move remain intact. |
| I04 | Active-job count and selector show the chosen job's actual progress. BOOST targets that job. Removing/completing the selected job falls back to the first remaining job. Animation requirements include all active jobs. Fully rushed jobs explain that completion happens on the next simulation tick. |
| I05 | Optional connected/unused route colors supplement existing directional arrows. The inspector explains parked, disconnected, idle, paused and active stations using the actual route and recipe. Cosmetic delivery paths remain cosmetic. |
| I06 | Rename and update a saved design, Undo deletion, and a direct Design action when no order is active. Management actions do not alter cash or the owned floor. Deleted-layout Undo is available while the current Factory session stays open; the six-layout limit still applies. |
| I07 | Release gates now run the fixture generator and interactive Factory audit, preserving their evidence. Legacy crowded/context-loss entrypoints forward to this maintained audit instead of requiring private temporary fixtures or obsolete scene-child positions. |

No new dependencies, save schema, progression changes, generated raster art or backend services were required.

## Verification

- Full Vitest suite: **210 files, 2,159 tests passed**. Includes saved-design ownership/cash invariants and a legal shared-station regression.
- Engine audit: **18 checks passed**, including the 16-scenario expansion/crowding matrix, save/load, Auto/Undo, production/launch/sales and financial consistency.
- Interactive Chromium audit: **14 main scenarios plus one focused decision-handoff scenario passed**, with no JavaScript page errors. Covers gestures, stable camera reset, hold/drop, belt painting/Undo, save/reload, synthetic background/foreground, production/launch, phone/tablet sizes, 130% text, reduced motion, context-loss fallback, truthful Auto refusal, selected-job rush, focus/clear selection, paused render idling and layout management.
- Browser screenshots inspected: crowded floor, focused machine, layout management and the Office decision reached from Factory. The decision fixture clears unrelated pending celebrations so it isolates the company choice; the original full run stopped at that fixture setup, then the corrected handoff passed independently. Generated evidence is under `artifacts/pre-testflight-audit/`.
- Production TypeScript/Vite build: **passed**; see `fixed-build.log`. Existing bundle-size/mixed-import warnings are unchanged.

Measured dense-fixture frame cost decreased from **862 to 700 draw calls** and approximately **156k to 51k triangles**. The seven-machine fixture decreased from **349 to 297 calls** and approximately **63k to 29k triangles**. These are browser renderer counters, not iPhone FPS or a battery claim. Paused-render frame counters stop advancing after controls settle.

## Still requires a physical device

Windows/Chromium cannot establish iOS thermal behavior, frame pacing, memory pressure, native app suspension, VoiceOver behavior or upgrade-from-build-74 save retention. Use the physical-device checklist in the original audit before declaring release readiness. No claim of native-device verification or a new TestFlight binary is made.

## Build 75 release-gate follow-up

The first CI run detected a timing error in the camera probe: the first sample preceded the reset frame, followed by four identical reset poses. The audit now waits for the exact requested camera position and target before checking for subsequent drift, rather than assuming a 250 ms delay means a software-rendered frame has completed. The drift tolerance is unchanged; no game behavior or release gate is bypassed.
