---
name: determinism-guard
description: Add or change anything in src/engine/ or src/state/gameState.ts without breaking the pinned 160-week reproducibility test. Use when adding a new simulation system, a random event, an "alive" interrupt (a pendingX card), a balance constant, or a state field — and whenever the determinism pin fails and you need to find out why.
---

# Determinism guard

**Determinism is the repo's hardest rule.** `src/engine/*` is pure, and a pinned test runs a seed
for 160 weeks twice and compares the results byte-for-byte. A single stray `Math.random()`,
`Date.now()`, or unguarded new field breaks it — and a broken pin means saves stop being
reproducible, challenges stop being fair, and balance work stops being trustworthy.

## The three laws

1. **`engine/` imports nothing from React or the DOM.** No `window`, no `localStorage`, no
   `Date.now()`, no `Math.random()`. The whole simulation is pure TypeScript.
2. **A do-nothing run must stay byte-identical.** Any new system is gated on an **optional /
   backfilled** state field and defaults to a **no-op**. The pinned test never sets the field, so it
   never sees the system.
3. **Side-channel randomness uses a DERIVED hash of `(seed, week, salt)` — never the main sim RNG.**
   Pulling from the sim RNG shifts every subsequent draw and desynchronises the entire run.

## Adding a new "alive" system

Follow the established pattern (see nemesis, eureka, community ask, earnings call, staff moments,
regional events — all built this way):

```
pure engine fn, gated on an optional field
      ↓
derived-hash interrupt sets  base.pendingX
      ↓
opt-in reducer resolves it
      ↓
staged overlay mounted in App.tsx
```

### 1. Pick a fresh salt

Every derived-hash stream needs its **own** salt. Reusing one correlates two systems: they fire on
the same weeks forever, which reads as a bug and is nearly impossible to diagnose later.

**The in-use list lives in `CLAUDE.md`** — read it, take the next unused value, and add your entry
there in the same change, with a one-line note on what the stream does. Sub-salts follow the
existing convention (e.g. salt 233 uses 2331/2332/2333 for its sub-decisions).

### 2. Gate on an optional field

```ts
// GameState
/** Optional/backfilled → absent in old saves and in a do-nothing run. */
myThing?: MyThingState;
```

Every read must tolerate `undefined` (`state.myThing ?? []`). Never add a required field to
`GameState` without a migration, and never let its absence change a number.

### 3. Respect the interrupt budget

Any card that fires on its **own cadence** must gate on **both**:

- `interruptQuiet` — at least `BALANCE.interrupts.minGapWeeks` since `lastInterruptWeek`
- the full `!base.pendingX` chain — every other pending interrupt

…and must stamp `base.lastInterruptWeek = week` when it fires. Skip either and modals cluster,
which players experience as the game shouting at them.

Exempt from the gate (but they still stamp): scheduled ceremonies (year-52 awards) and **earned**
ceremonies where the reward is already banked (nemesis trophy, the Vault reveal). Add new overlays
to `design/interruptPriority.ts` in the right rank.

### 4. Monetization never enters this layer

Gates for Silicon Pro live at the **player action / UI** layer only. Nothing in `engine/` may read
an entitlement — free and Pro runs must produce identical simulations. See the
`paywall-compliance` skill.

## When the pin fails

Work in this order — the cause is nearly always #1 or #2:

1. **Unseeded randomness.** `grep -rn "Math.random\|Date.now()\|new Date()" src/engine/`. Should be
   empty. In `src/state/` it's allowed only outside the tick path.
2. **A new field that isn't optional**, or a read that doesn't tolerate `undefined` — so the
   do-nothing run now takes a different branch.
3. **A salt collision.** Two streams sharing a salt fire together and shift each other's state.
4. **Drawing from the sim RNG for a side-channel roll.** Shifts every later draw.
5. **Iteration order** over a `Set`/`Map`/`Object.keys` whose insertion order changed.
6. **Floating-point drift** from reordered arithmetic. Money is **integer cents** via the `Money`
   branded type (`engine/money.ts`) — never `number`, never `toFixed` round-trips.

## Before committing

- [ ] `npm test` — the determinism pin is green
- [ ] `npm run typecheck` — clean
- [ ] New salt recorded in `CLAUDE.md`
- [ ] New state field is optional, and every read handles its absence
- [ ] New interrupt gates on `interruptQuiet` + the full `!pendingX` chain, and stamps
      `lastInterruptWeek`
- [ ] New balance numbers live in `engine/balance.ts`, not inline
