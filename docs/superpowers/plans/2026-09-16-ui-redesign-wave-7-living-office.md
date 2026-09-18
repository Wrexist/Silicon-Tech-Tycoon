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

### Task 1: Asset coverage — what already landed, and what is actually used

**Files:**
- Runs: `scripts/fetch-furniture.mjs` (existing)
- Inspects: `public/furniture/*.glb` (23 present), `src/garage3d/furnitureModels.ts`
- Modifies: `furnitureModels.ts` only if coverage is poor; the PWA precache config only if needed

**Corrected during plan self-review:** `public/furniture/` already contains **23 `.glb` models**, so the fetch has been run before. The sparse office in the capture is a **layout** problem (Task 2), not a missing-asset problem. Do not re-fetch blindly.

- [ ] **Step 1: Audit coverage, do not re-fetch**

Compare the 23 files against `furnitureModels.ts`'s registered ids and the catalog: how many catalog ids resolve to a glTF model, and which fall back to parametric? Report the list. Only run `npm run furniture:fetch` if coverage is genuinely poor — and if you do, report how many models landed and their total size.

- [ ] **Step 2: Check what `public/furniture/` costs and whether it is tracked**

Report (a) whether the `.glb` files are tracked in git, (b) their total size, and (c) the PWA's reported precache size from `npm run build` — and whether `public/furniture/**` is inside that glob. **If it is, say so and recommend exclusion**; these are lazy-loaded by `gltfFurniture.tsx`, so precaching them costs every player on first load. Do not change the config silently.

- [ ] **Step 3: Verify, and commit only if you changed something**

Run: `npm run typecheck` → exit 0; `npm test` → green; `npm run build` → green
Capture and **read** the Office tab at 1024×768 and confirm which pieces render as glTF versus parametric, so Task 2's layout work builds on the truth.

```bash
git add public/furniture src/garage3d/furnitureModels.ts vite.config.ts
git commit -m "feat(office): close the furniture asset coverage gap"
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

---

## Wave 7 pass 1 outcome (2026-09-16) - TASKS 0-2 DONE, TWO FINDINGS PARKED

**Status:** Tasks 0 (speed dial), 1 (asset audit) and 2 (furnishing) are implemented and committed. The review returned **Needs fixes** with two Important findings; both are **parked with rulings** because one is a product decision and the other is a design choice, and the controller session is at its budget cap. Tasks 3-5 (robot animation, chat bubbles, popup motion) are **not started**.

**Gates:** 	sc 0 - 2,011 tests / 186 files - build green - erify:ui2 PASS - udit:screens CLEAN - **determinism pin byte-identical**.

### What landed

- **The speed dial auto-hides while scrolling**, collapsing to a small dim pill so content is legible mid-scroll, restoring on idle.
- **Asset audit (no blind re-fetch):** 23 of 86 catalog ids resolve to glTF, 63 fall back to parametric. public/furniture/ is 24 tracked .glb files, 262 KiB, already **excluded from the precache** with a CacheFirst runtime route - verified against ite.config.ts. Precache: 80 entries / 3,526.95 KiB.
- **The showcase layout is now a furnished studio:** 3 desk bands with seated staff, a lounge, a meeting table, wall plants and branding - 34/34 placements, zero collisions, all in bounds.

### The engine carve-out, reviewed

The diff touches src/engine/furniture.ts. The reviewer examined it rather than rubber-stamping: the only behavioural change is the array defaultLayout() returns; no logic, no RNG. It traced both sim reads (officeAttrs folds ttrs, officeZoneBonus folds **category**), confirmed the new pieces are attr-free and - critically - that the one amenity-category piece (mascotStandee) sits 5 cells from the desk anchor so it contributes **zero** zone pairs. Both pins are sim-neutral. The accompanying test change **strengthens** coverage (it adds exact-set plus attrs/zone invariants) rather than deleting an assertion.

### Parked findings

**P1 (Important, PRODUCT DECISION) - the furnished room is showcase-only; a new player still gets a bare garage.**
Furniture carries ttrs (comfort/focus/inspiration), and officeZoneBonus also rewards *categories* near a desk, so adding furnished pieces to the starter layout **moves the pinned simulation** (observed: esearchPoints 95 -> 103 from one chair).
**Ruling: the starter stays bare, deliberately, and this is now documented.** The answer to "the office looks empty" is that the room is the player's own progression - you buy and place furniture, and the office fills as you do. Re-baselining the golden pin to allow a furnished starter is a **deliberate simulation change** and needs its own decision, not a side effect of an art pass. *Cost if wrong: a new player's first impression is a sparse room.*

**P2 (Important, DESIGN CHOICE) - the dial still covers content at rest.**
Auto-hide only helps *while* scrolling; after ~650ms idle the dial returns to full size over whatever is beneath it, which is the original complaint. Any fixed bottom chrome overlays content that scrolls under it - the tab bar does the same and is accepted because it reads as chrome.
**Ruling: parked, because the honest fix is a design choice, not a bug fix.** Either the dial becomes docked chrome (one row above the tab bar, where content is expected to pass beneath) or it stays a floating control and the overlap is accepted as the price of thumb reach. Guessing would repeat the mistake of the first attempt, which "fixed" it by hiding it only half the time. *Cost if wrong: the dial can still sit over text when the player stops to read.*

**P3 (Minor):** the new pin-safety comment in engine/furniture.ts says officeZoneBonus folds only ttrs. It folds **category** too - the sim is safe only because of the standee's coordinates. The comment should say the dressing is attr-free **and** kept ≥2 cells from any desk, or a future move silently shifts the pinned run.

### Not started

**Tasks 3-5:** robot animation clips, the chat-bubble layer, and the popup motion pass. They are the remaining half of Wave 7 and are ready as written.

---

## Wave 7 pass 2 outcome (2026-09-16) - COMPLETE

**Status:** Tasks 3-5 implemented, reviewed, and the review's two Important findings fixed. Wave 7 is done.

**Gates:** 	sc 0 - **2,014 tests / 187 files** - build green - erify:ui2 PASS - udit:screens CLEAN - **determinism pin byte-identical** - no engine file touched.

### Delivered

- **Robots idle, work and cheer** on a derived schedule (a bespoke cosmeticHash01, salts 401/419/421/433/439 - now registered in CLAUDE.md). Two frames a few weeks apart show different poses.
- **Chat bubbles**: small rounded panels with runtime-drawn text (no image or font asset), capped at 2, billboarded above the speaker, on by default, absent when officeChatter is off, absent under Reduce Motion (the layer is not mounted), and **frozen while the sim is held** - proven by two captures taken ~2.6s apart with the sim paused, both showing no bubbles.
- **Every popup entrance is on the shared --spring-* tokens.** The pass diagnosed a real bug: the tokens embed a duration, so the old shorthand had become an invalid declaration or a 350ms delay.
- The officeChatter preference lives in the UI-only settings store, so it survives a new company and never enters the save.

### The finding worth carrying forward

**The glTF robot path is dead, and it predates this wave.** obotModels.ts globs ./models/robot_*.glb, but that directory contains only ase.glb, so every character has always rendered as the **parametric** robot and the animation here is procedural. This also explains why the report could not claim clip-driven animation.

**Latent trap:** if someone renames ase.glb to obot_shared.glb, the characters become the rigged sample and gltfRobot.tsx plays a fixed clip while ignoring still and the work target - the new idle/working distinction would silently vanish. **Follow-up, not a Wave 7 defect.**

### Review findings, fixed

1. **Bubble timing was render-wall-clock.** It now accumulates **active-only** time, so a held sim produces nothing new and captures are stable. The comment states the honest trade-off: content is a derived hash; timing advances with active play, because pinning timing to the sim would need a tick counter this layer does not receive, and exact cross-session timing is not a goal for cosmetic chatter.
2. **Bubbles did not pause under an interrupt overlay.** The hold is now paused || suspended (the real key on useGameControls()), so a decision card holds the office exactly like a manual pause.
3. Cleanups: deleted the dead officeWeekKey(), and added officeLive.test.ts (3 tests) to lock the derived helpers.

### Deferred minors

- The work-target key is the **seat** seed, not staffId, so a character's state does not follow them if seating changes.
- speechBubbles.tsx's module-level texture cache is never disposed (bounded, but it lives for the page lifetime).
- speakers is rebuilt every Scene render; bubbles only re-seat on the next slot.
- Pre-existing Math.random remains in RoamingRobot, Dust and BallBin - UI-only, never touching the engine, but worth knowing in a wave about ambient determinism.
- **Perf note:** the office measured 23.8 fps in headless SwiftShader. That is a **software-render floor, not a device number** - the real figure needs a phone or iPad.

---

## P2 resolved - the speed dial is collapsed at rest (2026-09-16)

**Commit 4cf94e3.** P2 was parked because the honest fix is a design choice, not a bug fix. Ruled and done: **the dial collapses to a single ~44px button** showing the current primary action (Play when paused, Pause when running), and expands to the three controls on tap - re-collapsing after a choice or on an outside/scroll interaction.

Why this shape: a fixed control cannot avoid overlaying content that scrolls under it, so the only real fix is to shrink its **resting** footprint. The three-control pill covered a chunk of the column at all times; one 44px round button does not.

**Proven by frames:**  8-company (1024x768) shows a single small round button at bottom-left with the growth chart clear;  1-office-top (390x844) shows the phone layout undisturbed.

**Gate:** 	sc 0 - 2,014 tests / 187 files - build green - erify:ui2 PASS - udit:screens CLEAN - pin byte-identical.

**Known, pre-existing, accepted:** on phones a toast (bottom 96px) can briefly overlap the collapsed dial (bottom 72px). The toast auto-dismisses; it predates this change and is cosmetic.

## P1 - ruled, unchanged

The starter room stays as it is. Furnishing it fully means adding attribute- or amenity-bearing pieces, which **moves the pinned simulation** (one chair shifted esearchPoints 95 -> 103). Changing the simulation as a side effect of an art pass is the wrong trade. The room is the player's progression: you buy and place furniture and the office fills as you do. **If a furnished new game is wanted, it is a deliberate re-baseline of the golden pin and should be its own reviewed change.**

## Robot characters - nothing to wire

The glTF robot path is dead because **no robot models exist**: obotModels.ts globs ./models/robot_*.glb and the directory holds only ase.glb, so every character is the parametric robot. There is no rename or glob fix that produces rigged robots - that needs a robot asset pack. Recorded as an asset task, not a bug.

## Wave 7 - final state

All six tasks plus two fix rounds complete. Delivered: the scrolling-dial fix and its collapse; the asset-coverage audit (23/86 ids glTF, 62 KiB tracked, already excluded from the precache); a furnished showcase room (34/34, zero collisions); procedural robot idling/working/cheering on derived salts; opt-out, Reduce-Motion-safe chat bubbles that freeze with the sim; and every popup entrance back on the shared spring tokens.

**Device-only caveat that persists:** the office measured 23.8 fps in headless SwiftShader. That is a software-render floor, not a device figure. With robots and bubbles now animating, a real phone/iPad measurement is the one thing this repo cannot produce.
