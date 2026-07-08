# Silicon Tech Tycoon — working notes

Conventions to follow when working in this repo. (Design rules also live as comments in
`src/design/tokens.css` and `src/design/primitives.css`.)

## Popup / modal style — THE STANDARD (apply to every popup)

Every popup, modal, sheet, and interrupt overlay uses one liquid-glass style. When you build a
new one, or touch an existing one, make it match:

1. **The card is the glass.** The popup card itself carries the frosted material:
   ```css
   background: var(--glass-modal);            /* or a faint accent/positive/negative radial tint over it */
   backdrop-filter: blur(20px) saturate(190%) brightness(1.04);
   -webkit-backdrop-filter: blur(20px) saturate(190%) brightness(1.04);
   border: 1px solid var(--glass-modal-edge);  /* tint with the popup's accent where it has one */
   box-shadow: inset 0 1.5px 0 0 var(--glass-modal-rim), 0 24px 70px -24px rgba(0,0,0,0.5) /*, + accent glow */;
   ```
   Inner tiles/wells use `var(--glass-well)` + `var(--glass-well-edge)`; CTAs use the scoped glass
   button rules in `primitives.css` (translucent accent + specular sheen, soft focus halo, no hard
   offset ring).

2. **The scrim is CLEAR — never blur the background.** The area *around* the card stays sharp so the
   game shows through; only a light dim for focus. Scrims are just:
   ```css
   background: color-mix(in srgb, var(--bg) 30%, transparent);   /* NO backdrop-filter */
   ```
   The card's own `backdrop-filter` already frosts what's directly behind it — that's the glass.
   Do **not** put `backdrop-filter: blur()` on a scrim.

3. **Edge reflection.** Centered popup cards get the light-catching rim from the shared
   `…__card::after` rule at the bottom of `src/design/primitives.css` — add your new card's
   `.x__card::after` to that selector list (and give the card `position: relative`). Bottom sheets
   (`.ds-sheet`) show only their top edge, so their `inset 0 1.5px 0 0 var(--glass-modal-rim)` top rim
   is their reflection — that's enough.

Popups already on this style: celebration, awards, rival strike, rivalry, eureka, community ask,
earnings call, ready-to-launch, launch reveal, decorate tutorial, `.ds-sheet` bottom sheets, and the
scenarios confirm. **Exception:** the full-screen milestone takeovers (`.bankrupt`, `.era-modal`,
`.ipo` win in `App.css`) are a deliberately different "fill the screen with a themed gradient"
celebration style — leave them as-is.

## Hard rules (already enforced across the codebase)

- **Design tokens only** (`src/design/tokens.css`) — no hardcoded colors. 8pt spacing scale.
- **Lucide icons only** — no emoji in the product UI. No real brand names (fictional only).
- **Money is integer cents** via the `Money` branded type (`src/engine/money.ts`).
- **Determinism is sacred.** The engine (`src/engine/*`) is pure; the pinned 160-week reproducibility
  test runs a seed twice and compares. New systems must be gated on optional/backfilled state fields
  and default to no-ops so a do-nothing run stays byte-identical. Side-channel randomness uses a
  DERIVED hash of `(seed, week, salt)` — never the main sim RNG. New "alive" systems follow the
  established pattern: pure engine gated on optional fields → derived-hash interrupt (`pendingX`) →
  opt-in reducer → staged overlay mounted in `App.tsx` (see nemesis / eureka / community / earnings /
  staff moments / regional events). **Pick a fresh salt** for any new derived-hash stream — in use:
  11, 23, 37, 53, 71, 83, 91, 97, 101, 113, 127, 131, 137, 149, 151, 157, 211, 223, 227.
- **Opportunistic full-screen interrupts share a budget.** Any card that fires on its own cadence
  (strike / eureka / community / earnings / rivalry / staff moment / regional event) must gate on
  `interruptQuiet` (≥ `BALANCE.interrupts.minGapWeeks` since `lastInterruptWeek`) AND the full
  `!base.pendingX` chain, and stamp `base.lastInterruptWeek = week` when it fires — so modals never
  cluster. Scheduled ceremonies (year-52 awards) are exempt from the gate but still stamp.
- Run `npm test` (Vitest) before committing; keep the determinism pin green.
