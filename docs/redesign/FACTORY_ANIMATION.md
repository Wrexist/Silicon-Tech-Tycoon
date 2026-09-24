# Factory animation completion — 2026-09-24

## Changes

- Connected machines used by the product recipe or active client commission respond to passing units, rather than only animating the single batch-progress stage. Assembly arms also run as general assembly automation, consistent with their production bonus.
- Manual pause, decision overlays and another tab taking ownership freeze the local animation clock. Camera interaction remains available. Resuming preserves animation time instead of jumping to wall-clock time.
- Idle or disconnected lines no longer transport ghost products. Only connected conveyor segments register moving rollers and arrow pulses.
- Press, bonder, scanner, packing and robot smoothing use elapsed seconds; spindle rotation is frame-rate independent. Long frame gaps are clamped to avoid transport jumps.
- Factory has a visible global pause/resume control, with an explicit waiting-for-decision state. No second simulation clock or production shortcut was introduced.

## Evidence

`artifacts/factory-animation/motion.json` records live Three.js positions/rotations for conveyor items and named machine joints. The browser run verified changes in all four items, press rams, screen head, QA beam, robot yaw, CNC spindle and packing flap. Before-run and after-run paused samples were identical. No browser page errors were recorded.

The animation scenario holds the eight-second simulation tick at a fixed week in the test browser only, so interruptions cannot truncate the observed motion. A separate exploratory run reached a rival decision and correctly suspended animation. The scenario includes a phone order plus a client order requiring CNC equipment; unused or disconnected machinery is not expected to cycle.

Unit coverage tests recipe/client equipment selection, pause/reduced-motion delta, idle/disconnected transport, wrapping and equal travel at 30/60 fps. Final suite: 208 files / 2,153 tests passed, with a 30-second per-test timeout for the loaded workstation. Production TypeScript/Vite build passed. Final suite/build logs are `artifacts/factory-continuation/animation-suite-verified.log` and `animation-release-build.log`.

The diagnostic capture uses the existing game-visual-debugging fallback workflow: Chromium software rendering and local Playwright scripts because the game-dev CLI/adapter is unavailable. This verifies animation behavior, not physical iPhone frame rate or native lifecycle performance.
