# Factory bug fixes — 2026-09-24

## Implemented

- Fixed the first-open pinch hint stretching from competing top/bottom CSS rules. It now sizes to its text, sits within the stage, and dismisses on interaction.
- Anchored the delivery truck and pallet outside the open west wall. Auto, manual routing and eastward expansions cannot relocate them into the factory.
- Replaced delivery robots' obstacle-crossing interior paths with separated exterior loading lanes. Idle lines do not animate deliveries. Camera framing includes the exterior dock.
- Kept the full-screen scene orientation tied to the viewport rather than the remaining canvas height. Opening order/build controls no longer turns the room or resets the player's camera.
- Added touch gesture ownership: a pinch cancels pending painting, placement and holds; pointer cancellation, focus loss and backgrounding abandon gestures without purchasing or moving equipment. Belt painting cannot trigger long-press pickup.
- Bounded Factory help to the safe viewport, retained reachable navigation, shortened explanations and improved its surface contrast.
- Positioned Factory notifications above the measured tool area, including wrapped controls and larger text. Auto's quote now explains that it organizes machines, not just belts.

No save migration, ownership, prices, production rules or progression balance changes.

## Verification

- Full Vitest suite: 209 files, 2,157 tests passed. New regression cases cover exterior vehicle clearances, expansion independence and pinch/cancellation ownership.
- Production TypeScript/Vite build passed. Existing large-chunk and persistence mixed-import warnings remain.
- Browser UI checks: 320×568 at 130% text, 390×844 at 100%, 430×932 at 130%. Checked tutorial navigation, hint height, order-panel camera stability, Auto, purchased machine preservation, Undo and exact cash restoration.
- Browser touch input: a two-finger pinch while painting leaves layout and cash unchanged. A real long press picks up the test machine; an OS-style touch cancellation re-enables the camera and leaves the save unchanged. Notification clearance is checked against the measured toolbar.
- Live Three scene diagnostics: conveyor items, spindle, press, screen head, QA beam, assembly arm and delivery shuttle animate during production; pause freezes transforms before and after running.
- Evidence: `artifacts/factory-bug-audit/after/`, `artifacts/factory-bug-audit/motion/motion.json`, `artifacts/factory-bug-audit/tests.log`, `artifacts/factory-bug-audit/build.log`.
- Test fixtures run in isolated browser storage. One historical screenshot fixture was rejected by current save validation; the audit uses a validated fixture instead of weakening validation.

## Limits

Browser checks use Chrome/SwiftShader, not physical iPhone performance measurements. Delivery animation is a cosmetic exterior loading loop, not a new internal logistics/pathfinding simulation. This change does not upload a new TestFlight build.
