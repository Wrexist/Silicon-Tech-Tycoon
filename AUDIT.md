# Silicon: Tech Tycoon — Master Audit & Improvement Plan

A living, exhaustive audit of the whole app. Worked top-to-bottom, then repeated. Each item is
a checkbox; `[x]` done, `[~]` in progress, `[ ]` todo. Phases are ordered by risk/impact:
foundation & correctness first, then UX polish, then depth/features, then the repeat sweeps.

Legend: 🐛 bug · ⚠️ risk · ✨ improvement · 💎 premium-polish · ⚡ perf · ♿ a11y · 🧪 test

---

## PHASE 0 — Build & toolchain health (FOUNDATION, do first)
- [x] 0.1 Make `npm run build` (`tsc -b`) green — was ~40 pre-existing errors, now **0**
      (re-verified 2026-06-09 with `tsc -b --noEmit --force`, no stale tsbuildinfo).
  - [x] Market.tsx ×4: `format(<number cents>)` needs branded `Money` — wrap with `cents()`.
  - [x] HQ.tsx ×4: remove unused `Sheet`, `UPGRADE_LINES` line, `Product` type, dead `CHANNEL_ICONS`
        (+ any icon imports it orphans).
  - [x] DesignLab.tsx: remove unused `Rocket` import.
  - [x] vite.config.ts: `/// <reference types="vitest/config" />` + `defineConfig` from **vite**
        (not vitest/config) to fix the duplicate-vite Plugin clash AND keep `test` valid.
- [x] 0.2 `npm run typecheck` green (same `tsc -b`); wire a real check (root tsconfig was a no-op stub).
- [x] 0.3 `npm test` (vitest) all green; count: **177** (14 files) as of 2026-06-09.
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
- (v14 reconciliation, 2026-06-09) Fresh-container verification: tsc -b forced-clean **0 errors**,
  vitest **177/177**, vite build + PWA green, static dist smoke (shell/JS/CSS/sw/manifest all 200).
  Browser smoke impossible in this env (no chromium; playwright CDN blocked). Verified shipped
  since Sweep 4: B3 era rep-AND-rev gating, wizard demand-variance range, spend FX. Still open:
  B5 price range, B6 +EV stock drift (drift .0016 + dividend .0011/wk), F13 furniture instancing,
  0.5 bundle audit (main chunk 541KB/163KB gz; three split + lazy). Hygiene (0.7): found
  `tsconfig.node.tsbuildinfo` TRACKED in git (the `*.tsbuildinfo` ignore pattern never applied to
  it) — a committed, build-regenerated cache that could mask incremental typecheck errors;
  untracked via `git rm --cached`.
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

---
## SWEEP 2 — COMPLETE (verified)
Build GREEN (tsc 0, vite ok), vitest 94 passing (+5). Adversarial re-audit of all Sweep-1 changes
found NO material regressions (removed dead negate() nit). Features shipped:
- Save export/import (base64, migrate-validated, clipboard+download, Import sheet w/ confirm + inline error).
- Company "Stats" sheet: cash sparkline + net worth, best-seller, lifetime revenue/units/products/hits/flops/rep/fans.
- LaunchedProduct.verdict recorded at launch (competition-adjusted) + migrate backfill for old saves.

## SWEEP 3 — focus: content/balance, deep a11y+perf, iOS/PWA, more premium features
- [ ] Content/balance audit: economy curve garage→empire, winnability, dead-ends, exploit-checks (7.1-7.5)
- [ ] Deep a11y audit: contrast AA, focus order, keyboard nav, ARIA on sliders/sheets (6.1-6.3)
- [ ] iOS/Capacitor/PWA: safe-area, status bar, haptics native path, manifest, touch-only flows (9.x)
- [ ] Post-launch product detail w/ sales chart + sequel button (8.1)
- [ ] Marketing depth: campaign outcome feedback (8.2)
- [x] Achievements/milestones, premium no-FOMO (8.3) — 20-milestone PURE catalog + evaluator
  (engine/achievements.ts, unit-tested: every predicate, no double-unlock, monotonic, silent
  backfill). State: GameState.unlockedAchievements (migrate default [] + silent earned-backfill at
  end of migrate). Live tick + launch/era/IPO/buyShares fire ONE celebratory toast per NEW unlock;
  boot + offline catch-up fold unlocks in silently (no toast backlog). UI: Achievements sheet from
  Company (count "N/total", earned full-colour Lucide cards, locked muted Lock placeholders with a
  tasteful hint — no exact thresholds). Tokens + 8pt grid, dark/light parity. Dropped none — all
  proposed milestones backed by existing tracked data (sellout derived from totalUnits===plannedUnits).

---
## SWEEP 3 — progress
Build GREEN (tsc 0, vite ok), vitest 95. Done: balance/content audit (found early-game runway
BLOCKER + fan-grind exploit + readability gaps); post-launch Product Detail sheet (tap a launched
product → device render, sales curve, "why it won/flopped" drivers from new LaunchInsight snapshot,
"Design a successor" → seeds DesignLab w/ next series name). 
Balance findings queued for fix pass (B1-B9 below).

### Balance fix queue (from content audit)
- [x] B1 BLOCKER: recommendedRun could bankrupt during the build. FIXED — recommendedRun now reserves
      buildSafetyReserve = buildWeeks×weeklyBurn + safetyReserveMargin ($1k) before funding units
      (gameState.affordableRun/buildSafetyReserve; BALANCE.build.safetyReserveMargin). Tests: a fresh
      save's recommended run leaves ≥ the reserve and survives the whole build without bankruptcy.
- [x] B2 defaultRun 600 unaffordable. FIXED — BuildWizard opens on recommendedRun (always affordable);
      defaultRun kept only as the demand-probe size/ceiling hint, documented in balance.ts.
- [ ] B3 Era advance OR-revenue skip makes reputation a sudden endgame grind → require rep AND softer revenue, or rep-gated. (DEFERRED — larger design change.)
- [x] B4 Fan-grind sellout exploit. FIXED — (a) pre-orders capped to BALANCE.fans.preOrderCap (0.6) of
      total demand in planProduction so a giant fanbase can't self-fulfil a token run; (b) the sellout
      fan-bonus only fires when the run met ≥ selloutMinDemandShare (0.5) of demand, else a small
      undersupplyFanPenalty (0.05) for chronic undersupply (launchReady). Tests: token sellout isn't
      rewarded, gain is analytically bounded, pre-orders < total demand under the cap.
- [ ] B5 Pricing solved by one Suggest button → show a range not the peak. (DEFERRED — larger design change.)
- [x] B6 Stock drift +EV passive income printer → FIXED (post-Sweep-4): share prices now
      mean-revert around a reputation-anchored fairSharePrice (log-gap × meanReversion 0.06/wk);
      baseline drift + perpetual reputation momentum REMOVED (quality lives in the price LEVEL).
      Launch pops/dips decay (half-life ≈ 12wk) → tradable swings, not compounding income.
      Buy-and-hold EV ≈ dividend yield (~5.9%/yr) − brokerage. 5 new engine tests (3-seed
      400-week zero-EV bound, reversion both directions, corrupt-price healing).
- [x] B7 Readability: DesignLab verdict disagreed with launch gate. FIXED — DesignLab now derives its
      projected verdict from the SAME effectiveScore (planProduction.launchScore × competitionFactor)
      and the SAME BALANCE.reputation.hit/flopThreshold the launch uses. Test: lab verdict == recorded
      launch verdict across hit/flop/steady cases.
- [x] B8 Readability: price-fit + deltas now surfaced. FIXED — launch feed appends "+N fans · +M
      reputation" (losses for flops); BuildWizard review shows a Price fit indicator (Overpriced −X% /
      On the money / Value buy) alongside demand fit, plus "Cash after build starts" + "Runway: N wk"
      with a premium risk warning when runway < build weeks (B1b).
- [ ] B9 Depth (later): choice-driven market events, reactive/specialized rivals, demand variance at launch, component sidegrades.

---
## SWEEP 3 — audits done (a11y deep + iOS/PWA), fix queue
Runtime smoke: Company renders Achievements + Stats, 0 console errors. Achievements (20) + balance
fixes + post-launch detail all live. tsc 0 / vitest 135 / build ok.

### a11y blockers/serious (queued)
- [ ] A1 index.html: remove maximum-scale=1.0,user-scalable=no (zoom blocker — WCAG 1.4.4).
- [ ] A2 Light-theme contrast: darken --ink-3 (#9ca3af 2.3:1 → ~#6b7280); add on-light text variants for
      function colors/positive/negative (bright hues fail as text); darken --accent to #2563eb for white-on-accent sm buttons; nudge --ink-2.
- [ ] A3 Sheet primitive: focus into dialog on open, trap Tab, restore focus on close. Apply to IPO/Bankrupt/Offline overlays too (add role=dialog/aria-modal/Escape).
- [ ] A4 3D <Canvas> aria-label/role=img (mirror IsoScene); WASD hint not the only doc.
- [ ] A5 HUD cash/RP/rep as aria-live polite + meaningful aria-label ("$24.0K cash","Reputation 47 of 100").
- [ ] A6 AnimatedNumber/GainFX honor prefers-reduced-motion (JS rAF ignores CSS query) → snap.
- [ ] A7 (known exception) 3D build-mode placement pointer-only; keep auto-place fallback + document.

### iOS/PWA blockers/serious (queued)
- [x] I1 Safe-area the 3 full-screen overlays (.ipo .bankrupt .onboard button): padding max(--edge, env(safe-area-inset-*)).
- [x] I2 Service worker via vite-plugin-pwa (precache shell+assets, runtime-cache furniture/*.glb) → offline PWA.
      `registerType:autoUpdate`, `manifest:false` (we keep public/manifest.webmanifest), globs js/css/html/svg/png/webmanifest,
      glb served by a CacheFirst runtime route. Registered in src/main.tsx via `virtual:pwa-register` (guarded; no-op when unsupported).
- [x] I3 Real PNG icons: generated 180/192/512 + 512-maskable from public/icon.svg via `sharp` (scripts/gen-icons.mjs).
      Wired into manifest.icons[] (maskable purpose) + index.html apple-touch-icon → /apple-touch-icon-180.png.
- [x] I4 @capacitor/status-bar + splash-screen: SplashScreen #0f1115 / no spinner / hidden from JS on mount; StatusBar DARK style.
      Config in capacitor.config.ts plugins{}; runtime init in src/native.ts (guarded by Capacitor.isNativePlatform(), never throws).
- [~] I5 Scaffold ios/ — needs macOS/Xcode, can't run here. See "Native iOS build (run on a Mac)" below.
- [x] I6 haptics branch on isNativePlatform (native Haptics on device, Web Vibration on web — removes double-buzz).

---

## Native iOS build (run on a Mac — required, not possible in this environment)
The web build, PWA service worker, icons, and Capacitor config are all ready. The native
iOS project (`ios/`) is intentionally **not** committed because `npx cap add ios` requires
macOS + Xcode (CocoaPods, native toolchain). On a Mac, run:

```bash
npm install
npm run build          # emits dist/ + dist/sw.js + precache manifest
npx cap add ios        # one-time: scaffolds ios/App + installs pods
npx cap sync           # copies dist/ into the native shell + syncs plugins
npx cap open ios       # opens ios/App/App.xcworkspace in Xcode to run/archive
```

`capacitor.config.ts` is already correct for this: appId `com.wrexist.silicon`, webDir `dist`,
SplashScreen (#0f1115, no spinner, JS-hidden) + StatusBar (DARK) plugin config. After any web
change, re-run `npm run build && npx cap sync`. Re-run `node scripts/gen-icons.mjs` only if
`public/icon.svg` changes (regenerates the PNGs).

---
## SWEEP 3 — COMPLETE (verified)
Build GREEN (tsc 0, vitest 135, vite build emits sw.js + workbox + PNG icons). Fresh-server runtime
smoke: 0 console errors, HQ renders, cash/HUD live. (Earlier "format is not defined" was stale HMR
buffer — gone on clean reload; code imports format correctly + production build clean.)
Done this sweep:
- Content/balance audit + FIXES: early-game runway BLOCKER (recommendedRun reserves build burn),
  defaultRun affordability, fan-grind exploit tamed (pre-order cap, sellout volume bar, undersupply
  penalty), DesignLab verdict now matches launch (competition-adjusted), launch feed shows +fans/+rep,
  price-fit indicator + "cash after build/runway" warning in wizard.
- Post-launch Product Detail sheet ("why it won/flopped" from LaunchInsight) + Design-a-successor.
- Achievements (20, pure engine + evaluator, silent backfill, one celebratory toast per live unlock).
- Deep a11y FIXES: zoom unblocked, light-theme contrast (ink-3/accent/on-light text tokens), Sheet
  focus trap+restore + dialog semantics on IPO/Bankrupt/Offline, Canvas aria-label, HUD aria-live +
  labels, AnimatedNumber/GainFX honor reduced-motion.
- iOS/PWA FIXES: safe-area on 3 overlays, vite-plugin-pwa service worker (offline shell + glb runtime
  cache), real PNG icons (192/512/maskable/apple-touch-180 via sharp), @capacitor/status-bar+splash
  native init, haptics native/web branch. (ios/ scaffold = documented Mac-only step.)

## SWEEP 4 — depth + perf + re-audit
- [ ] Adversarial re-audit of Sweep 3 changes (focus traps, token contrast, SW offline correctness, balance).
- [ ] B3 era gating tie to reputation; B5 pricing variance/range; B6 stock drift mean-reverting (design changes).
- [ ] B9 depth: choice-driven market events, reactive/specialized rivals, launch demand variance, component sidegrades.
- [ ] F13 furniture instancing (perf); dpr cap low-power.
- [ ] Deeper per-screen premium polish pass + microinteractions.

---
## SWEEP 4 — interrupted by session limit, build RECOVERED
A depth agent landed B9 LAUNCH DEMAND VARIANCE (market.ts demandVarianceMultiplier, ±12% seeded,
RNG-persisted, bounded) but was cut off before adding its import to gameState.ts → I fixed the
missing import. Build verified GREEN: tsc 0, vitest 135, vite build ok (SW + icons), runtime smoke
0 console errors. The rivals/events agent made no committed changes (cut off early).
STILL TODO (Sweep 4 remainder): adversarial re-audit of Sweep 3; ~~reactive/specialized rivals~~
(shipped, commit 06f7675); ~~choice-driven market events~~ (shipped, commit 3361445); ~~B3
era-rep gating~~ (shipped — `eras.ts` requires rep AND rev for era 2+); B5 pricing range; ~~B6
stock mean-reversion~~ (shipped — see Balance fix queue B6); furniture instancing perf; deeper
polish. ~~Demand-variance UI readability~~
(shipped — wizard "Projected demand" now shows the low–high range). Verified 2026-06-09.
