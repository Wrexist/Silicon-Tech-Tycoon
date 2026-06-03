# Silicon: Tech Tycoon — Master Audit & Improvement Plan

A living, exhaustive audit of the whole app. Worked top-to-bottom, then repeated. Each item is
a checkbox; `[x]` done, `[~]` in progress, `[ ]` todo. Phases are ordered by risk/impact:
foundation & correctness first, then UX polish, then depth/features, then the repeat sweeps.

Legend: 🐛 bug · ⚠️ risk · ✨ improvement · 💎 premium-polish · ⚡ perf · ♿ a11y · 🧪 test

---

## PHASE 0 — Build & toolchain health (FOUNDATION, do first)
- [~] 0.1 Make `npm run build` (`tsc -b`) green — was ~40 pre-existing errors, now 10.
  - [ ] Market.tsx ×4: `format(<number cents>)` needs branded `Money` — wrap with `cents()`.
  - [ ] HQ.tsx ×4: remove unused `Sheet`, `UPGRADE_LINES` line, `Product` type, dead `CHANNEL_ICONS`
        (+ any icon imports it orphans).
  - [ ] DesignLab.tsx: remove unused `Rocket` import.
  - [ ] vite.config.ts: `/// <reference types="vitest/config" />` + `defineConfig` from **vite**
        (not vitest/config) to fix the duplicate-vite Plugin clash AND keep `test` valid.
- [ ] 0.2 `npm run typecheck` green (same `tsc -b`); wire a real check (root tsconfig was a no-op stub).
- [ ] 0.3 `npm test` (vitest) all green; note count.
- [ ] 0.4 Audit tsconfig: confirm `noUnusedLocals/Parameters`, `strict`, `noUncheckedIndexedAccess`?
- [ ] 0.5 Bundle audit: three.js chunk ~732KB — confirm lazy-only; consider drei tree-shake.
- [ ] 0.6 Dead-code sweep: unused exports/components/CSS classes across src.
- [ ] 0.7 `.gitignore` covers dist/, .furniture-tmp/, scratch; no stray temp files committed.

## PHASE 1 — Engine correctness (PURE LOGIC — highest leverage, unit-test everything)
- [ ] 1.1 money.ts: rounding, overflow, negative guards, format() locale/`$` consistency. 🧪
- [ ] 1.2 market.ts: demand/hype/trend math — NaN/Infinity guards, clamp 0..1, divide-by-zero. 🧪
- [ ] 1.3 salesCurve.ts: curve sums to ~totalUnits, never negative, sellout cap respected. 🧪
- [ ] 1.4 competitors.ts: share-price evolution bounds, launch cadence, strength decay. 🧪
- [ ] 1.5 economy.ts: payroll/burn/runway/bankruptcy edge cases (0 staff, huge cash). 🧪
- [ ] 1.6 production (gameState): tooling+run cost, fans→pre-orders, demand-fit, competitor
        match/beat penalties — verify formulas, add boundary tests. 🧪
- [ ] 1.7 eras.ts: progression gating, unlocks, no soft-locks. 🧪
- [ ] 1.8 stocks.ts: buy/sell fees, dividends, holdings value, player share price. 🧪
- [ ] 1.9 furniture.ts: placement/collision/footprint/rotation correctness. 🧪
- [ ] 1.10 Determinism: same seed → same outcome (RNG isolation).

## PHASE 2 — State, persistence, lifecycle
- [ ] 2.1 useGame tick: no double-ticks, pause/fast correctness, cleanup on unmount.
- [ ] 2.2 Save schema versioning + migrations: forward/backward, corrupt-save recovery. ⚠️
- [ ] 2.3 Field backfill completeness (new fields default safely on old saves).
- [ ] 2.4 Multi-tab/localStorage race handling; quota-exceeded fallback. ⚠️
- [ ] 2.5 New Game+ / prestige reset correctness (no leaked state).
- [ ] 2.6 Bankruptcy + IPO end states: clean, no stuck UI.

## PHASE 3 — Rendering (devices + 3D garage)
- [ ] 3.1 DeviceRenderer: every category silhouette renders, no clipping, theme-correct.
- [ ] 3.2 deviceStyle mapping: extreme inputs don't break the SVG.
- [ ] 3.3 3D garage: WebGL fallback to 2D works; reduced-motion respected. ♿
- [ ] 3.4 Kenney glTF models: scale/orientation/centering tuning pass (eyes-on). 💎
- [ ] 3.5 Build/Decorate mode: placement, drag, rotate, undo, duplicate — no ghost artifacts.
- [ ] 3.6 Perf: frame budget, instancing for repeated furniture, dispose on unmount. ⚡

## PHASE 4 — Screens & UX flow (premium feel)
- [ ] 4.1 HQ: hierarchy, empty states, CTA clarity, no cramped corners. 💎
- [ ] 4.2 Design Lab: build wizard steps clear, validation, can't-afford states. 💎
- [ ] 4.3 Research: project clarity, assignment UX, progress feedback.
- [ ] 4.4 Market: stock exchange readability, trade sheet, sparklines, net worth. 💎
- [ ] 4.5 Company: staff/facilities/financials legibility.
- [ ] 4.6 Onboarding: first-run clarity, naming, skip.
- [ ] 4.7 Global: toasts, sheets, modals — consistent motion + dismissal.
- [ ] 4.8 Navigation: bottom nav active states, deep-link safety.

## PHASE 5 — Premium polish (RULE #1)
- [ ] 5.1 Token compliance sweep: no hardcoded colors/spacing/fonts. 💎
- [ ] 5.2 8pt grid + whitespace consistency. 💎
- [ ] 5.3 Microinteractions: press states, transitions, haptics on key actions. 💎
- [ ] 5.4 Icons: Lucide everywhere, never emoji (per memory). 💎
- [ ] 5.5 Empty states never blank; loading/skeleton states. 💎
- [ ] 5.6 Typography scale + number tabular alignment (tnum). 💎
- [ ] 5.7 Dark/light parity across every screen. 💎

## PHASE 6 — Accessibility & input ♿
- [ ] 6.1 Focus order, focus-visible rings, keyboard nav for all interactive elements.
- [ ] 6.2 ARIA labels/roles on icon-only buttons, sliders, sheets.
- [ ] 6.3 Contrast ratios (text + UI) meet WCAG AA.
- [ ] 6.4 Reduced-motion honored everywhere (3D, gain anims, transitions).
- [ ] 6.5 Tap targets ≥44px; safe-area insets (iOS notch/home bar).

## PHASE 7 — Content, balance & depth (the sim must be fair + readable)
- [ ] 7.1 Economy curve: garage→empire pacing, no dead ends, winnable. 🧪
- [ ] 7.2 "Why won/flopped" readability — surface the reasons after each launch.
- [ ] 7.3 Component/category catalog breadth + meaningful tradeoffs.
- [ ] 7.4 Competitor behaviour believable + reactive.
- [ ] 7.5 Difficulty/sandbox modes; balance constants documented in balance.ts.

## PHASE 8 — Features & complements (✨ add value)
- [ ] 8.1 Post-launch product detail: sales chart, lifetime stats, sequel button.
- [ ] 8.2 Marketing depth: campaign outcomes, channel synergy feedback.
- [ ] 8.3 Achievements / milestones (premium, no FOMO).
- [ ] 8.4 Save export/import (offline backup).
- [ ] 8.5 Stats/history screen (revenue over time, market share).
- [ ] 8.6 Tutorial/coach marks (optional, dismissible).

## PHASE 9 — iOS / Capacitor / PWA
- [ ] 9.1 Safe-area insets, status-bar style, splash.
- [ ] 9.2 Haptics via @capacitor/haptics on native; web fallback.
- [ ] 9.3 Offline-first (no network calls), PWA manifest correct.
- [ ] 9.4 Touch-only flows verified (no hover-only affordances).

## PHASE 10 — Hardening
- [ ] 10.1 ErrorBoundary coverage + copyable diagnostics (done) — verify per-screen.
- [ ] 10.2 Defensive guards: null/undefined, array bounds, NaN in UI formatters.
- [ ] 10.3 No `!` non-null abuse; no stray TODO/FIXME in shipped paths.
- [ ] 10.4 Console clean (no warnings/errors) in normal play.

---

## REPEAT SWEEPS (after Phase 10, loop back to Phase 0)
Each sweep: re-run build/typecheck/tests, re-read changed areas adversarially, hunt new bugs,
add one premium improvement per screen, log findings below.

## FINDINGS LOG (append-only; newest first)
- (v13.1) tsc -b was a no-op stub historically → ~40 latent type errors. Fixed engine types
  (CompetitorState/Product/BuildJob/LaunchedProduct) + 3 unused params. 10 screen-level left.
- (v13) Kenney CC0 furniture integrated (23 models) + 10 parametric items + glTF seam.

---
## FINDINGS — Sweep 1 (4 parallel audit agents: engine, state, UI/polish, rendering)
Deduplicated + prioritized fix queue. (file refs approximate; verify line on edit.)

### P0 — correctness / data-loss (fix first)
- [ ] F1 useGame.tsx — offline catch-up runs TWICE (useState initializer + mount effect both call catchUpOffline on stale on-disk lastActive) → doubles offline gains, corrupts determinism, x2 under StrictMode. Single catch-up + immediate save.
- [ ] F2 persistence.ts — migrate() returns null on version-skew / missing fields → caller treats as "no save" and OVERWRITES the real save (permanent data loss). Distinguish no-save vs unreadable; keep a backup, surface recovery.
- [ ] F3 persistence.ts save() — swallows QuotaExceededError silently → data loss on iOS/WKWebView. Trimmed-save fallback (drop cashHistory, cap launched) + one-time toast.
- [ ] F4 gameState.ts feedSeq — module counter resets on reload → duplicate feed ids → duplicate React keys. Seed from max existing id or use uuid/time-based id.
- [ ] F5 market.ts launchScore/hype uncapped — stacked visionary marketers + brandStudio + marketing upgrade → unbounded hype → revenue explodes, trivializes game. Clamp total hype after summing bonuses.
- [ ] F6 gameState.ts — RP accumulates as fractional floats (rate=0.5 offline) vs integer costs. Round RP each tick / on spend.
- [ ] F7 gameState.ts — offline catch-up applies fan decay (+cash burn) for up to 8 weeks with zero possible action → fans/cash erode (soft-lock risk). Skip/cap fan decay during offline catch-up; floor fans.
- [ ] F8 gameState.ts — hit/flop reputation uses competition-FREE launchScore while sales use competition → inconsistent (hit rep but ~0 sales). Gate isHit on actual projected sales/demand.
- [ ] F9 gameState.ts — unitsSold can exceed totalUnits over partial offline tick. Cap unitsSold at totalUnits.
- [ ] F10 money.ts — add/sub/scale have no Number.isFinite guard; a NaN multiplier poisons all cash math and persists. Guard → ZERO/clamped.

### P1 — rendering / perf / premium feel
- [ ] F11 gltfFurniture.tsx — Kenney models render at scale:1 with no bbox fit/centering/grounding → wrong size, float/sink. Compute Box3, scale to footprint, translate min.y→0, center on tile.
- [ ] F12 glTF furniture not theme-aware (won't recolor light/dark like parametric). Tint from RoomPalette or document fixed colors.
- [ ] F13 Garage3D — player furniture + workstations/monitors not instanced → draw calls scale with decoration. InstancedMesh by (type,palette) / merge static meshes.
- [ ] F14 Garage3D — ~10 always-on useFrame loops (camera never settles, BallBin O(N^2), Dust, Robot, steam, characters) → sustained battery drain. Demand frameloop + settle epsilon; throttle cosmetic anims; pause offscreen.
- [ ] F15 Garage3D ContactShadows resolution 512 re-renders every frame in a static scene. frames={1}.
- [ ] F16 Garage3D BrickWall uses Math.random in effect → re-randomizes/flickers + instanceColor may be null on first run. Deterministic hash(index).
- [ ] F17 DeviceRenderer — cameraCount===0 still draws a lens (Math.max(1,...)). Skip module when 0.
- [ ] F18 squircle.ts — clamp smoothing to [0,1] / k=max(0,k) to avoid corner bulge.
- [ ] F19 DeviceRenderer — flip-card width formula diverges from useGeom().renderW → layout jump on flip. Reuse renderW.
- [ ] F20 DeviceRenderer Shape returns null for unhandled category → blank svg (violates no-blank mandate). Generic fallback silhouette.
- [ ] F21 support.ts — webgl/reduce-motion memoized once; no webglcontextlost handler → no runtime downgrade to 2D. Add context-loss → IsoScene.

### P1 — UX / a11y / polish
- [ ] F22 Many tap targets <44px (steppers, icon buttons: hud 40, co__fire 30, hqb__search-clear 30, lab__stepper 34, trade__stepper 36, co__skill 30). Bump to ≥44.
- [ ] F23 Market activity empty state uses undefined class mkt__feed-empty → unstyled/blank. Use EmptyState primitive + Lucide glyph.
- [ ] F24 catalogs.ts category glyph fields are EMOJI (📱💻🎮⌚🕶) — violates Lucide-only mandate. Remove/replace with Lucide names.
- [ ] F25 Market ▲/▼ change + −/+ steppers use literal glyphs → use Lucide TrendingUp/Down, Minus/Plus.
- [ ] F26 HQ hq__camhint "WASD to look around" shown on touch/iOS build. Gate behind hover/pointer:fine; "Drag to look around" on touch.
- [ ] F27 Toast — add role=status aria-live=polite to host (launch results announced) + tap-to-dismiss.
- [ ] F28 Off-system micro type (11/10.5/12.5px) + off-grid spacing (3/5/6px). Add --fs-micro/--fs-nano + --sp-2/--sp-6 tokens; replace literals.
- [ ] F29 #fff knob colors (toggle/switch) don't adapt → add --knob token; centralize Avatar SVG hex constants.
- [ ] F30 Duplicate Stat/WizStat across Market/Company/DesignLab → promote one <Stat> primitive.
- [ ] F31 Consolidate frosted-glass opacities (86/82/92%) into one --glass token (hud/nav/coach).
- [ ] F32 TrendBars + Sparkline components exist but Market re-implements trends inline → consolidate.

### P2 — improvements / features / hardening
- [ ] F33 Save export/import (base64) via migrate() validation — premium, no-backend backup.
- [ ] F34 Screen-level ErrorBoundary inside app__main so a buggy screen keeps HUD/nav.
- [ ] F35 Autosave: debounce on state-change instead of blind 4s interval (battery).
- [ ] F36 Split context: stable actions context vs state context → fewer re-renders per tick.
- [ ] F37 prestige/restart should setFast(false) (NG+ starts at 8x otherwise).
- [ ] F38 stocks.ts — clamp share qty (unbounded buyShares) + Math.max(0, qty) in holdings math.
- [ ] F39 salesCurve floor uses magic launchScore>1 cliff → use >0.
- [ ] F40 competitors.ts — clamp share-change > -0.95; unify rival "present" threshold (>0 vs >1).
- [ ] F41 newGame/persistence use different seed formulas; signed ints. One makeSeed() unsigned helper.
- [ ] F42 Centralize safeStorage (3 dup KEY+try/catch wrappers); move magic caps (cashHistory 260, feed 60, backfill literals) into BALANCE.
- [ ] F43 Tests: add offline-catch-up integer-invariant test, hype-cap test, planProduction zero-spendable test, priceFit extremes test, persistence round-trip/recovery tests.

---
## SWEEP 1 — COMPLETE (verified)
Build GREEN (tsc -b 0 errors, vite build ok), vitest 89 passing (+33 new tests across guards/persistence),
runtime smoke test PASSED (all 5 screens render, 0 console errors, 3D garage live).
Done: Phase 0 build health; F1-F11, F14-F32, F37-F40 (engine correctness, state/persistence data-loss,
rendering fit/perf/recovery, UX/a11y/premium polish). 
Deferred to Sweep 2+: F12 (glTF theme tint — decided: keep Kenney colors, documented), F13 (furniture
instancing — perf, larger refactor), F33-F36/F41-F43 (features + safeStorage + more tests).

## SWEEP 2 — focus: features + depth + fresh adversarial re-audit
- [ ] Re-audit changed files adversarially (did Sweep 1 introduce regressions?)
- [ ] F33 Save export/import (premium offline backup)
- [ ] 8.1 Post-launch product detail (sales chart, lifetime stats, sequel)
- [ ] 8.5 Stats/history screen (revenue, market share over time)
- [ ] 7.2 "Why won/flopped" readability after launch
- [ ] F34 screen-level ErrorBoundary; F35 autosave debounce; F36 context split
- [ ] Deeper content/balance + a11y/perf passes
