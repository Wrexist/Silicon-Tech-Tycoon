# Pre-TestFlight audit: Factory and production

Audit completed: 2026-09-25 (checks began 2026-09-24). Application revision: `e23f3c9` (marketing version 1.4.0).

**Recommendation: fix F01-F05 before the next upload.** The build and existing tests pass, but the additional interactive/geometry checks found defects the existing suite does not catch. No player save was used or changed. This audit adds diagnostic scripts and this checklist; it does not change gameplay or upload a binary.

## Confirmed fixes needed

| ID | Priority | Finding and evidence | Change needed / acceptance check |
|---|---|---|---|
| F01 | High | **Recenter retains orbit momentum.** After repeated orbit/pinch and Recenter, the camera continues changing position without input. Reproduced in the browser and recorded as successive camera transforms. This also makes immediate, precise object selection unreliable. | Clear residual orbit/zoom damping before applying the reset pose. After reset, camera position and target must remain stable without input; immediately holding a visible machine must pick it up. |
| F02 | High | **Two machine heads can overlap on a legal shared belt tile.** A mill at `(0,0)` and screen bonder at `(3,0)` both mount to the belt at `(2,0)`; both receive world position `(-5.5,-4.5)`. The floor passes placement validation. This is a manual, incomplete-line case; the tested Auto layouts did not duplicate working-head stations. | Make working-head placement collision-safe even when no distinct station is available. Preserve owned footprints and saves; show a clear disconnected/conflict state instead of overlapping geometry. Test shared tiles, corners and crowded custom floors. |
| F03 | Medium | **Auto gives the wrong explanation on crowded floors.** When the router cannot fit a line, the UI says “Place an Intake and a Packer first” even though both are present. Reproduced on crowded expansion-0/1 floors. The rejected action correctly preserves money and ownership. | Distinguish missing endpoints from insufficient space/blocked routing. Tell the player to free space or expand, and keep the same no-charge/no-mutation behavior. |
| F04 | Medium | **Saved-layout touch targets are too small.** Measured Apply at 34px high, Delete at 34×34px and Save current at 38px high, below this redesign's 44px target. | Make the actual hit areas at least 44×44px; recheck long names, larger text, confirmation rows and narrow screens. |
| F05 | Low | **Broken separators in player-facing copy.** The layout confirmation renders `0 added ? 0 removed ? ...`. Similar literal question-mark separators remain in the side-order pause message and layout-expansion/finish descriptions. | Replace placeholders with proper punctuation or separate lines. Verify rendered text, not just source encoding. |

Evidence: `artifacts/pre-testflight-audit/browser.json`, `engine.json`, `camera-diagnostic.log`, `layout-confirmation.png`, `blocked-auto.png`, and `shared-belt-heads.png`.

## Further improvements, separate from bugs

| ID | Priority | Improvement | Reason / scope |
|---|---|---|---|
| I01 | Before wider testing | **Put Review decision inside Factory.** | The tested production completion also produced a pending company decision. Factory shows a disabled “Waiting for decision” button; the actionable main-screen review control is behind the Factory overlay. Closing Factory works, so this is a navigation gap rather than a deadlock. Reuse the existing decision action. |
| I02 | Before wider testing | **Profile dense factories on an iPhone, then optimize measured costs.** | The 16-machine expanded fixture reported 862 draw calls and about 156k triangles in a sampled frame; the seven-machine fixture reported 349 calls. These are Chrome/SwiftShader counters, not iPhone FPS. Investigate geometry/material sharing, instancing, preview shadow work and rendering while manually paused. Avoid expensive new lighting/effects until device measurements exist. |
| I03 | Polish | **Make close-up editing easier.** | Expanded factories and short viewports make individual machines very small despite the controls remaining accessible. Consider zoom-to-selected, a clear selected-machine outline/label and a focused edit view. Keep the existing full-floor reset available. |
| I04 | Workflow | **Show all active production jobs.** | Factory's current-order card reads `building[0]`; production and working-kind calculations already support more than one job. Add an active-job count and selector/list using the existing jobs, without inventing a new scheduler. |
| I05 | Clarity | **Make line and station status visible on the floor.** | Add optional route direction/connection highlighting and an explanation for an idle/disconnected station. Keep it tied to actual route/recipe state and avoid implying that cosmetic delivery robots simulate internal logistics. |
| I06 | Convenience | **Improve saved-layout management and empty-state actions.** | Rename/update a saved layout, offer Undo for accidental layout deletion, and make “No active order” link directly to Design. These reuse existing gameplay; they are not required to make production function. |
| I07 | Regression prevention | **Add the new visual/touch cases to release automation after fixing them.** | Existing release gates test fallback Factory ownership/Undo, but not the new repeated-orbit reset or shared-head geometry cases. Keep validated fixtures reproducible and retire stale screenshot scripts that assume the old scene hierarchy or a missing `C:/tmp` fixture. |

No new game mechanic is needed to fix the confirmed defects. Prioritize reliable controls and clear status over additional content for this build.

## Verification performed

| Check | Result | Evidence / boundary |
|---|---|---|
| Full existing Vitest suite | **Pass: 209 files, 2,157 tests** | `tests.log`; rerun for this audit. |
| Production TypeScript/Vite build | **Pass** | `build.log`; existing large-chunk and mixed-import warnings remain. |
| Expanded/crowded routing matrix | **Pass: 16 scenarios** | Expansions 0-3, with 0/7/14/28 requested extra machines. Successful routes preserve IDs, kinds, levels and valid placement. Two oversized arrangements refuse safely. |
| Auto price, Undo, named-layout restoration and serialization | **Pass** | Engine probes verify quoted cash changes, exact Undo and owned geometry. Browser also saves a named layout, sends pagehide, reloads and compares layout, jobs, ready items and cash. |
| Production through completion, launch and sales | **Pass** | Engine saves/reloads every week, completes the job, rejects duplicate launch, sells units and checks financial history. Browser resumes an actual timed week, shows manufacturing complete, launches through the Factory popup and preserves exactly one launch on reload. There is no separate manual collection mechanic. |
| Financial consistency | **Pass in tested periods** | Revenue minus expenses equals profit for the shared weekly forecast and recorded history. This does not equate cash balance with profit; purchases and other cash movements are separate. |
| Pinch/orbit preserving ownership/cash | **Pass** | Repeated gestures do not edit/spend. Camera reset stability fails separately under F01. |
| Hold, move and drop | **Pass in isolation** | Move an Intake to a legal destination, persist it and verify no charge. Tested separately from the drifting-camera case. |
| Belt painting and Undo | **Pass** | Actual touch-drawn run, correct per-tile charge, exact restoration. |
| Gesture cancellation | **Previously passed at the same application revision** | `artifacts/factory-bug-audit/after/verification.json`: OS-style touch cancellation releases a held machine without committing; pinch during painting does not purchase tiles. |
| Phone/tablet layouts | **Pass for accessible controls** | Crowded dark-theme fixture at 390×844 with 130% text; 820×1180 and 1180×820 tablet sizes; 844×390 short web viewport. Previous same-revision checks also covered 320×568 and 430×932. Fit/accessibility does not mean tiny 3D targets are comfortable (I03). |
| Reduced motion | **Pass** | Scene transforms remain stationary after enabling Reduced Motion. |
| WebGL failure | **Pass for fallback availability** | Forced context loss switches to the accessible grid with build controls. Existing suite covers ownership/Undo through the fallback. |
| Background/foreground logic | **Pass with synthetic browser visibility** | Hidden for more than one normal tick interval: no week advances. Foreground: one normal production week resumes. This is not native iOS suspension proof. |
| JavaScript page errors | **None in the final browser audit** | Expected assertion failures are F01 and F03; F02 is recorded by the geometry probe. |

## Physical-device checks still needed

This workspace is Windows and has no connected iPhone/iPad or iOS simulator tool. These cannot be honestly marked verified here. Use the next TestFlight candidate for this checklist:

- [ ] Small supported iPhone and a larger notched iPhone: safe-area top/bottom, all sheets, keyboard over layout naming, long names and larger text.
- [ ] Native touch: repeated pinch/rotate, two fingers during painting, interrupted long press, drag/drop near edges and Recenter followed immediately by selection.
- [ ] Lifecycle: home/lock/return during production and immediately after editing; force-quit/relaunch; update from build 74 while retaining the save. Compare cash, layout, jobs and ready/launch state before/after.
- [ ] Performance: 15-20 minutes with a dense expanded factory; record frame pacing, memory, heat and battery behavior, including Low Power Mode and repeated Office/Factory opening.
- [ ] iPad rotation and multitasking; screen-reader focus and reachable dismissal for stacked decisions/sheets.

iPhone is intentionally **portrait-only** in `ios/App/App/Info.plist`; iPad supports all orientations. Landscape phone-browser checks are stress tests, not a promise of native iPhone landscape support.

## Reproduce the software audit

Run from the repository root. The engine script creates isolated, validated fixtures; no real save is read.

```powershell
npx esbuild scripts/audit-factory-release.ts --bundle --platform=node --format=cjs --outfile=artifacts/pre-testflight-audit/engine.cjs
node artifacts/pre-testflight-audit/engine.cjs
npm run dev -- --host 127.0.0.1 --port 5181
# In another terminal; AUDIT_URL and SHOTS_CHROME can override the defaults:
node scripts/audit-factory-browser.mjs
```

The browser audit intentionally returns a nonzero exit code while F01/F03 remain. F02's legal shared-station coordinates are retained in `engine.json`. First-pass touch failures were investigated: fresh-scene editing passes, and the repeated-orbit sequence exposes the separate residual-camera-motion defect. They are not counted as additional independent placement bugs.

No new TestFlight upload was made by this audit.
