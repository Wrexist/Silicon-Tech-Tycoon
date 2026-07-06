# Prompt — make Factory Mode the cleanest, most user-friendly part of the game

Paste everything below the line into a new **Fable 5** session on branch
`claude/game-design-ux-review-22ojj9`. It is self-contained.

---

You are a senior game-UX engineer working on **Silicon: Tech Tycoon** (Vite + React + TS +
Capacitor). Read `DEV.md` and `LEARNINGS.md` first, then `FACTORY_MODE_PLAN.md` and the TASK.md
entries v73–v80 (they describe Factory Mode's history). Your job: make **Factory Mode** the
cleanest, calmest, most user-friendly surface in the game. Remove every noisy element. Do NOT
regress the simulation or the 3D scene — only the UX/UI/navigation around it.

## The files
- `src/components/FactoryMode.tsx` — the fullscreen shell (top bar, left order card, right rail,
  bottom BOOST strip, Build toolbar, sheets) + the `FactoryCard` minimap on the Office tab +
  `FloorMinimap` (layout-driven SVG).
- `src/components/factoryMode.css` — all its styling.
- `src/components/Factory3D.tsx` — the three.js floor (DO NOT restyle the 3D; leave the scene,
  machines, belts, arrows and traveling product alone unless a change is purely additive polish).
- `src/engine/factoryFloor.ts` (+ `.test.ts`) — PURE grid/catalog/validation. PROTECTED: don't
  refactor; only add pure helpers with tests if a feature needs them.
- State actions already exist: `buyFloorMachine`, `buyFloorBelt`, `clearFloorCell`, `rushBuild`
  (BOOST), all cash-gated and tested via `useGame()`.

## Locked rules (non-negotiable — from DEV.md/LEARNINGS.md)
1. **Premium through restraint.** DesignSystem tokens only (`src/design/tokens.css`), 8pt grid,
   Lucide icons (never emoji), no hardcoded colours/spacing/fonts. The dark overlay may use
   `rgba(...)` neutrals but every accent/among/state colour must be a token.
2. **Zero image assets** — parametric SVG / 3D primitives / glyphs only.
3. **Theme-correct** — must read in light, dark, and high-contrast. The mode is dark-first but
   panels/buttons must not break the light theme where they surface.
4. **Reduced-motion + a11y** — `prefers-reduced-motion` safe; `aria-*` on every control; 44px
   touch targets on primary actions; the fullscreen is a dialog with a focus trap + Escape.
5. **No dark patterns**, no fake numbers (stats are per-week because that's the real sim).
6. Every commit: `npm run typecheck` (0), `npm test` (green), `npm run build` (green). Verify the
   result in a real browser with a screenshot (Chromium is at `/opt/pw-browsers/chromium`; use a
   staged save — see `scripts/stage-save.mjs` / `npm run shots:stage`, then inject
   `localStorage["silicon.save.v1"]`; the mode is reached via the Office tab → Factory world tab →
   "Open factory mode"). Do a build with a live production run (set `building[0].weeksElapsed`,
   fresh `lastActive`) so the line animates.

## What "clean and user-friendly" means here — the target
The **3D floor is the star**. Chrome should be minimal, quiet, and get out of the way. Aim for
a HUD a first-time player parses in 3 seconds: *what am I making, is it on track, and the one
button that helps (BOOST)* — everything else one tap away.

### Concrete tasks (ranked by impact)
1. **Audit for remaining noise and kill it.** Current state after v80: top bar = era badge +
   cash/flow + RP + close; left = one Current Order card; right rail = Build/Upgrades/Research/
   Stats; bottom = BOOST + ship + shop. Look critically and remove anything that doesn't earn
   its place. Candidates: the era badge (is it needed?), the RP chip (RP isn't spent here — maybe
   drop it), the Research rail button (it just leaves the mode — maybe move it into a sheet or
   drop it). Fewer, calmer elements win.
2. **One coherent button system.** Right now buttons are hand-rolled with ad-hoc `rgba()`.
   Define a small, consistent set (primary = BOOST, quiet = side/rail icons, sheet buttons) with
   uniform radius/padding/weight/press-state, all token-driven. No two buttons should look
   subtly different for no reason.
3. **Make the right rail calmer and self-explaining.** Icon + label is good; ensure the labels
   are short, the active/disabled/badge states are subtle (the affordable-dot is fine but should
   whisper, not shout), and the whole rail reads as one quiet column.
4. **Build mode should feel like a focused sub-mode, not a wall of chips.** The current toolbar is
   a hint line + belt/direction + 5 machine chips + erase + Done. Redesign it to be calmer:
   consider a compact palette (icon tiles with cost, the selected one highlighted), a clear
   "you're building" affordance, and an unmistakable exit. Keep the taught rule ("Intake →
   Packer", "Erase refunds half") but make it a one-liner, not a paragraph.
5. **The empty / line-stopped states must be gentle and actionable**, never alarming. "Line
   stopped" should read as guidance with a direct "Fix in Build" affordance, not a red error.
6. **The Office-tab `FactoryCard`** (the minimap + chips + expand) should be a clean, inviting
   entry point — one glance tells you the line's health (the minimap already colours the chain).
   Tidy the chips and the expand affordance.
7. **Motion discipline.** Any HUD transitions (panel fold, sheet open, build-mode swap) should be
   quick, spring-consistent with the app, and reduced-motion safe. No flashing, no bounce spam.

### Explicitly DO NOT
- Do not touch the 3D scene's geometry, machine rigs, belt arrows, smart corners, or the
  traveling product (v79) — those are signed off. Only the 2D HUD/nav/buttons are in scope.
- Do not add new gameplay or engine mechanics (that's the separate, gated "F4" pass).
- Do not add a second navigation paradigm — keep the top bar / left card / right rail / bottom
  strip skeleton; refine it, don't replace it.
- Do not ship anything rough: if a redesign can't be made clean this session, leave it and log a
  one-liner in TASK.md.

### Deliverable
A short series of commits (one logical change each), each gate-green and screenshot-verified,
plus a TASK.md entry summarizing the before/after and anything left for on-device tuning. End
with a 430×900 dark-theme screenshot of the final HUD over a running line.

The bar: a stranger opens Factory Mode and immediately understands it, nothing on screen feels
loud or redundant, and every button looks like it belongs to the same, considered system.
