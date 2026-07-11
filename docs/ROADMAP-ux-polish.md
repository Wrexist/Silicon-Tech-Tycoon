# UX Polish & Progression Roadmap

Follow-up to the immersion roadmap. Addresses the deferred findings from the UX/progression audit
(early-game feel, mid/late pacing, discoverability). Same guardrails as always: determinism pin green,
balance sim byte-identical for UI/guidance changes, and re-validated (healthy, not identical) for the
few items that legitimately touch the economy — each such item calls out the sim impact.

Status legend: `[ ]` todo · `[x]` done · `(sim)` touches the balance economy → needs `npm run sim`
re-validation · `(safe)` guidance/UI only → byte-identical.

---

## Phase A — Discoverability & feed polish (safe)

### A1. Persistent "what just unlocked" card `(safe)`
The first ship silently unlocks half the meta-game, announced by ONE 4.2s toast. Replace with a small
dismissible HQ card listing each newly-live system with a deep-link, persisting until tapped.
**Files:** `App.tsx`, `screens/HQ.tsx`, a `unlockCardSeen` state/profile flag.

### A2. Feed salience + roll-up `(safe)`
The feed is an undifferentiated firehose (up to 60 items, milestone spam mixed with real beats).
Tag items with a priority, visually elevate high-priority rows, and roll up milestone spam.
**Files:** `state/gameState.ts` (FeedItem priority), `screens/HQ.tsx` (FeedCard).

### A3. Tap-to-open info popovers replace hover-only tooltips `(safe)`
Doctrine/"Pick one", Capstone, and region Standing explanations live in `title=` tooltips — invisible
on touch. Replace the load-bearing ones with a tappable `(i)` affordance + inline one-liner.
**Files:** `screens/Research.tsx`, `screens/Market.tsx`.

---

## Phase B — HQ information architecture (safe)

### B1. Pinned "needs you now" zone `(safe)`
Late-game HQ is a 15+ card mega-scroll where the one thing needing action can be below the fold. Pin a
priority zone at the top (pending choice / poach / ready-to-launch / claimable reward) so what needs
the player is always first.
**Files:** `screens/HQ.tsx`.

### B2. Collapse always-present informational cards `(safe)`
Community / Contracts / Legacy cards render unconditionally; make the informational ones collapsible so
the scroll stays scannable.
**Files:** `screens/HQ.tsx`.

---

## Phase C — Progression pacing (mostly sim)

### C1. Era 1→2 distinction `(safe surface + sim lever)`
Eras 1 & 2 share identical `eraModifier`s; the only real era-2 change (competition pressure ramp) is
unsurfaced. Step 1 (safe): surface it via `eraRuleSummary` + era context. Step 2 (sim): give era 2 one
mild distinct lever so the transition is felt, re-validated.
**Files:** `engine/eras.ts`, `engine/balance.ts`.

### C2. Decision density in the wait `(sim)`
Between launches the player taps "next". The engine already supports concurrent builds, so Step 1
(safe): nudge overlapping pipelines (design-while-building). Step 2 (sim): raise the opportunistic
interrupt density in eras 3–4 (the interrupts are individually rare AND globally throttled to 1/3wk).
**Files:** `state/gameState.ts` guidance; `engine/balance.ts` interrupt cadences.

### C3. Late-game adversity `(sim)` — DONE
The economy was a one-way ratchet: 0 bankruptcies, rep never dips, four passive income streams vs.
trivial burn. Added a **late-era operating drag** (`lateEraDrag` in `gameState.ts`, `BALANCE.lateEra`):
a capped weekly cash cost scaled by lifetime revenue that starts in the AI era, so a frontier-scale
company pays to keep running and the endgame stops being a free ratchet. It scales with success (a
gentle rubber-band on the top) and is hard-capped, so it dents growth without ever bankrupting a
solvent company. `ZERO` before the drag era → the early game and the pinned sim's first three eras
are byte-identical. Surfaced as the "Scale" line in the Company burn breakdown and folded into
`weeklyOutflow` (runway/solvency). Tuned via `npm run sim`: median endgame net worth $1708.5M →
$1602.6M (−6.2%), p10 $1455.5M, **0/40 bankruptcies, all 40 runs reach era 4**, hit-rate unchanged.
**Files:** `state/gameState.ts`, `engine/balance.ts`, `screens/Company.tsx`, `engine/lateGame.test.ts`.

---

## Sequencing
Phase A → B are safe UI, shipped first and individually. Phase C is sequenced last, each step
`npm run sim`-validated; the safe "surface/guidance" sub-steps ship byte-identical, the economy levers
ship only after the sim confirms 0 bankruptcies, all eras reached, and a healthy hit-rate spread.

## Status
- [x] A1 · [x] A2 · [x] A3
- [x] B1 · [~] B2 (addressed via the B1 reorder)
- [x] C1 (surface) · [x] C2 (late-era interrupt density) · [x] C3 (late-era operating drag)
