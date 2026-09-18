# UI Redesign — Wave 7 (The living office) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3D office feel alive and finished — real furniture, a properly furnished room, robots that animate and occasionally talk, and a smooth popup — plus fix the floating speed dial that still covers content.

**Architecture:** The asset pipeline already exists: `scripts/fetch-furniture.mjs` pulls the **CC0 Kenney Furniture Kit** into `public/furniture/`, `furnitureModels.ts` maps catalog ids to those files, and `gltfFurniture.tsx` / `gltfRobot.tsx` render them **lazily with a parametric fallback** — so a partial fetch never breaks the build. This wave runs that pipeline, furnishes the room, drives the existing robot clip support with a small deterministic state machine, adds a new text-in-3D chat-bubble layer, and applies the house motion tokens to popups. **Nothing here touches the simulation.**

**Tech Stack:** TypeScript · React 19 · three / @react-three/fiber / drei (already dependencies) · Vitest (Node env) · CSS design tokens.

**Spec:** `docs/superpowers/specs/2026-09-16-premium-ui-redesign-design.md` (constraint 5: zero image assets for hero content — 3D models are the sanctioned path, and this wave adds no images)
**Owner decisions (recorded):** (1) run the fetch and **commit** the models; (2) chat bubbles are **on by default, with a Settings toggle, and suppressed under Reduce Motion**.

## Global Constraints

- **Determinism is sacred.** No engine file may change. The 3D layer is presentation only; the office layout lives in the save but the *default/staged* layouts are harness or new-game data. The pin must stay byte-identical.
- **No image assets.** Models are glTF (CC0), bubbles are text rendered in code. No PNGs, no sprites.
- **Every model keeps its parametric fallback.** `furnitureModels.ts` decides what is glTF; an id with no file must still render.
- **Reduce Motion is honoured inside the renderer**, not by swapping renderers (Wave 0's ruling): stilled camera drift, and **no chat bubbles at all**.
- **Perf gate:** the office is on screen for long stretches on phones. Any new per-frame work must be throttled, culled off-screen, and must not raise the DPR caps ([1,1.75] HQ).
- **Precache budget:** `public/**` is precached by the PWA (a prior pass cut 247 KiB from it). New models must be **excluded from the precache** or measured and accepted — see Task 1.
- No new dependencies; explicit import extensions; design tokens only for any CSS.
- Gate: `tsc` 0 · suite green · `npm run build` · `verify:ui2` PASS · `audit:screens` CLEAN · pin green.

---

### Task 0: Fix the floating speed dial covering content

**Files:**
- Modify: `src/components/hud.css` (`.speeddial`) and/or `src/App.css` (`.app__spacer`)

This is the one real bug in the list, and it predates the redesign: the fixed speed dial sits over the bottom-left of the scroll area, so on a long screen the last card's text scrolls under it. The redesign made it more visible by putting the growth chart there.

- [ ] **Step 1: Reproduce it in a capture**

Capture the Company tab at 1024×768 with the flag on and read the frame. Confirm the dial overlaps the growth chart's lower area. (This is the control; the fix must show the chart clear.)

- [ ] **Step 2: Fix it**

The dial is `position: fixed` on purpose (thumb reach), so the fix is **reserved space, not moving the control**: ensure the scroll container's bottom padding clears the dial's full height at every breakpoint, and that the last card is never under it. `src/App.css`'s `.app__spacer` was already raised once for this; confirm the current value clears the dial **plus the tab bar/safe area**, and raise it if a card can still sit under the dial. If a screen's own bottom padding is the real culprit, fix it there.

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck` → exit 0; `npm run build` → green
Re-capture the same frame and **read it**: the chart must be clear of the dial.

```bash
git add src/components/hud.css src/App.css
git commit -m "fix(ui2): reserve space for the floating speed dial so it stops covering content"
```

---

### Task 1: Fetch the Kenney asset set

**Files:**
- Runs: `scripts/fetch-furniture.mjs` (existing)
- Adds: `public/furniture/*.glb` (committed)
- Modifies: `src/garage3d/furnitureModels.ts` (only if the fetched set no longer matches its ids)
- Modifies: the PWA precache config (`vite.config.*`) if models must be excluded

- [ ] **Step 1: Run the fetch**

```bash
npm run furniture:fetch
```

It auto-discovers the download link; `KENNEY_URL=<zip>` overrides it. Report: how many models landed, their total size, and which catalog ids are still unmatched (those keep their parametric piece — that is fine, not a failure).

- [ ] **Step 2: Check the precache cost BEFORE committing**

Run `npm run build` and read the PWA's reported precache size. **If the models push the precache up materially, exclude `public/furniture/**` from precache** (they are lazy-loaded by `gltfFurniture.tsx`, so an offline-first player would lose them — measure and say which you chose, don't decide silently).

- [ ] **Step 3: Verify, and commit**

Run: `npm run typecheck` → exit 0; `npm test` → green; `npm run build` → green
Capture and **read** the Office tab at 1024×768 and confirm the glTF furniture renders in place of the parametric pieces (or that nothing regressed if the ids did not match).

```bash
git add public/furniture src/garage3d/furnitureModels.ts vite.config.ts
git commit -m "feat(office): ship the CC0 Kenney furniture models"
```

---

### Task 2: Furnish the room properly

**Files:**
- Modify: the default/staged layout(s) — the new-game starter layout and `scripts/stage-showcase.mjs`

The screenshot the owner saw looked sparse because the staged layout is deliberately spare. A clean office needs desks **with tables**, a lounge, a meeting corner and wall pieces, laid out on a grid with walkways.

- [ ] **Step 1: Fix the layout**

Read the current starter layout and the showcase staging. Rebuild both so the room reads as a furnished studio: **desk bands with tables and chairs at every seat**, a lounge with a rug and coffee table, a meeting table, and plants/branding on the walls. No overlapping pieces (the placement helper no-ops on collision — use that as the check).

- [ ] **Step 2: Verify and commit**

Capture at 1024×768, flag on, and **read** the Office frame: every seat should have a desk and a chair, and the floor should read as furnished rather than empty. Report what you saw.

Run: `npm run typecheck` → exit 0; `npm test` → green; `npm run build` → green

```bash
git add scripts/stage-showcase.mjs src/state/gameState.ts
git commit -m "feat(office): furnish the room with desks, tables and a lounge"
```

---

### Task 3: Robots that actually animate

**Files:**
- Modify: `src/garage3d/Garage3D.tsx` (the character cluster)
- Modify: `src/garage3d/gltfRobot.tsx` (only if clip selection is missing)

`gltfRobot.tsx` already accepts `asset` and `clip`, and there is a deterministic idle bob. This task gives each character a small state machine instead of one loop.

- [ ] **Step 1: Find out what clips exist**

Report which animation clips the fetched robot models actually contain. If they contain none, say so plainly — the fallback is procedural animation, which is still worth doing (see below), and the plan should not pretend a clip exists.

- [ ] **Step 2: A deterministic state machine**

Give each character a state — **idle → working → cheer** — selected from a **derived hash of `(seed, weekIndex, staffId)`**, never `Math.random`, so the same week always looks the same and captures stay stable. `cheer` already exists as a reaction on celebrations; route the new work state through the same reaction bus rather than a second one.

- [ ] **Step 3: Verify and commit**

Capture two frames a few simulated weeks apart and confirm the poses differ (the hash moves with the week). Confirm the office still holds frame rate.

Run: `npm run typecheck` → exit 0; `npm test` → green; `npm run build` → green; `npx vitest run src/state/activeRun.determinism.test.ts` → PASS

```bash
git add src/garage3d/Garage3D.tsx src/garage3d/gltfRobot.tsx
git commit -m "feat(office): robots idle, work and cheer on a derived schedule"
```

---

### Task 4: Chat bubbles

**Files:**
- Create: `src/garage3d/speechBubbles.tsx`
- Modify: `src/screens/Settings.tsx` and `src/state/settings.ts` (the toggle)
- Modify: `src/garage3d/Garage3D.tsx` (mount it)

Genuinely new: nothing in the codebase renders text in the 3D scene's world space today.

- [ ] **Step 1: Render text without an image**

Draw each bubble as a small rounded panel with **text generated at runtime** — a drei `<Text>` (SDF text, no texture file) or a canvas-drawn texture. Do not add a font file or a PNG. Cap it to a few concurrent bubbles, billboarded to face the camera, positioned above the speaker.

- [ ] **Step 2: Schedule them deterministically and quietly**

- Lines are authored constants: `"Working…"`, `"Shipping…"`, `"Compiling…"`, `"On it."`, `"Coffee?"` etc. (no real brand names, no emoji).
- Which character speaks, which line, and when comes from a **derived hash of `(seed, weekIndex, index)`** — never `Math.random` — so a capture is repeatable and the same week repeats.
- They must **pause with the sim** (a paused game shows no new bubbles) and be consumed at most one every few seconds.
- **Reduce Motion: no bubbles at all.**

- [ ] **Step 3: The Settings toggle**

Add `officeChatter: boolean` (default **true**) to `src/state/settings.ts` with the usual backfill, and a row in Settings under the office/graphics group using the existing switch component. It must survive a new company (it is a UI preference, not save data).

- [ ] **Step 4: Verify and commit**

Capture and **read** a frame with bubbles visible, then one with `officeChatter` off and one with Reduce Motion emulated, confirming they are absent in both. Report all three.

Run: `npm run typecheck` → exit 0; `npm test` → green; `npm run build` → green; pin → PASS

```bash
git add src/garage3d/speechBubbles.tsx src/garage3d/Garage3D.tsx src/state/settings.ts src/screens/Settings.tsx
git commit -m "feat(office): robots talk in small deterministic, opt-out bubbles"
```

---

### Task 5: Smooth popup animation

**Files:**
- Modify: `src/design/primitives.css` (the `.ds-sheet` / popup entrance) and any popup that hardcodes its own timing

The house motion tokens exist (`--spring-standard`, `--spring-snappy`, `--spring-gentle`) and are respected app-wide, but the bottom sheet's entrance is the least smooth surface.

- [ ] **Step 1: Audit and align**

List every popup entrance/exit and which token each uses. Bring outliers onto the shared tokens — **no new durations, no hardcoded cubic-beziers.** Confirm each is neutralised under Reduce Motion by the existing global catch-all.

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck` → exit 0; `npm test` → green; `npm run build` → green; `npm run verify:ui2` → PASS

```bash
git add src/design/primitives.css
git commit -m "polish(ui2): put every popup entrance on the shared motion tokens"
```

---

### Task 6: Verification

**Files:** none (evidence only).

- [ ] **Step 1: Determinism and perf**

Run: `npx vitest run src/state/activeRun.determinism.test.ts` → **byte-identical**
Run: `npm run sim` → unchanged (0/40 bankruptcies, all eras reached)
Report the built precache size and compare it against the pre-wave figure.
Report the office's frame rate at 1024×768 with bubbles on, and say how you measured it.

- [ ] **Step 2: The full gate**

`npm run typecheck` → 0 · `npm test` → green · `npm run build` → green · `npm run verify:ui2` → PASS · `npm run verify:deeplink` → PASS · `npm run audit:screens` → CLEAN

- [ ] **Step 3: Two flags, four frames**

Capture and **read**: flag-on (new office), flag-off (classic office), Reduce Motion (no bubbles, stilled drift), and `officeChatter` off (no bubbles). Report what each showed.

- [ ] **Step 4: Record the outcome**

Append a "Wave 7 outcome" section: status, commit range, gate output, the model count and total size, the precache delta, and deferred minors.

---

## Wave 7 exit criteria

- [ ] The speed dial no longer covers content on any screen or breakpoint.
- [ ] glTF furniture renders for the matched ids, with the parametric fallback intact for the rest.
- [ ] Every seat has a desk and a chair; the room reads as furnished.
- [ ] Robots change pose across weeks on a derived, repeatable schedule.
- [ ] Bubbles appear by default, vanish with the Settings toggle and under Reduce Motion, and pause with the sim.
- [ ] No new image or font assets; no new dependency.
- [ ] Precache delta measured and accepted or excluded, and stated.
- [ ] Determinism pin green; sim unchanged; `tsc` 0; suite green; build green; `verify:ui2` PASS; `audit:screens` CLEAN.

## Risks this wave must report on honestly

1. **Precache growth.** Committing models puts them in `public/`; the service worker precaches that glob. Measure before committing and choose exclusion over silent bloat.
2. **Frame rate.** Animating robots plus bubbles in a scene that is open for long stretches on phones. Throttle, cull off-screen, and measure.
3. **The `demand` frameloop.** An idle scene now renders once. Any animation that must keep running has to keep the scene active — confirm the office is active while visible and that bubbles do not force a redraw when hidden.
4. **The fetch may fail or be partial.** The pipeline is built for that; a partial fetch is a normal outcome, not a blocker. Report coverage rather than forcing it.
