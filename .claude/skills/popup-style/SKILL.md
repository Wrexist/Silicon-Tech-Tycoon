---
name: popup-style
description: Build or restyle any popup, modal, sheet, overlay, interrupt card or paywall in Silicon so it matches the house liquid-glass standard. Use whenever creating a new full-screen card or touching an existing one's CSS, and when a popup looks wrong — blurry background, dull edges, hardcoded colours, or a card that doesn't catch the light like the others.
---

# The liquid-glass popup standard

Every popup, modal, sheet and interrupt overlay in Silicon uses **one** material. New ones match it;
old ones get fixed when touched. Rule #1 of the project is the premium mandate — a popup that misses
this reads as a different, cheaper app.

## The three rules

### 1. The CARD is the glass

The popup card itself carries the frosted material — not a wrapper, not the scrim:

```css
.xyz__card {
  position: relative;                          /* required for the edge reflection */
  background: var(--glass-modal);              /* or a faint accent/positive/negative radial tint over it */
  backdrop-filter: blur(20px) saturate(190%) brightness(1.04);
  -webkit-backdrop-filter: blur(20px) saturate(190%) brightness(1.04);
  border: 1px solid var(--glass-modal-edge);   /* tint with the popup's accent where it has one */
  box-shadow:
    inset 0 1.5px 0 0 var(--glass-modal-rim),
    0 24px 70px -24px rgba(0, 0, 0, 0.5);      /* + an accent glow where it has one */
}
```

Inner tiles and wells use `var(--glass-well)` + `var(--glass-well-edge)`. CTAs use the scoped glass
button rules in `primitives.css` — translucent accent, specular sheen, soft focus halo, **no hard
offset ring**.

Tinting for an accented popup (see `eurekaMoment.css`, `paywall.css`):

```css
background:
  radial-gradient(130% 80% at 50% -10%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 62%),
  var(--glass-modal);
border-color: color-mix(in srgb, var(--accent) 24%, var(--glass-modal-edge));
```

### 2. The scrim is CLEAR — never blur the background

The area *around* the card stays sharp so the game shows through. Only a light dim for focus:

```css
.xyz__scrim {
  position: absolute; inset: 0;
  background: color-mix(in srgb, var(--bg) 30%, transparent);   /* NO backdrop-filter */
}
```

The card's own `backdrop-filter` already frosts what is directly behind it — **that** is the glass.
Putting `backdrop-filter: blur()` on a scrim is the single most common way this standard gets
broken, and it turns the whole screen to mud.

### 3. Register the edge reflection

Centred popup cards get their light-catching rim from the shared `…__card::after` rule at the
**bottom of `src/design/primitives.css`**. Add your new card's selector to **both** lists there (the
`position: relative` list and the `::after` list). Forgetting this is why a new card looks flat
beside the others.

Bottom sheets (`.ds-sheet`) show only their top edge, so their
`inset 0 1.5px 0 0 var(--glass-modal-rim)` top rim *is* their reflection — that's enough.

## Non-negotiables

- **Tokens only** (`src/design/tokens.css`). No hardcoded colours, no off-grid spacing — the scale
  is 8pt (`--sp-*`), radii are `--r-*`, type is `--fs-*`.
  ⚠ `--spring-bounce` is referenced in some older CSS but **is not defined** — use
  `var(--spring-gentle)` or add the token deliberately.
- **Lucide icons only.** No emoji anywhere in the product UI.
- **Motion:** `animation: … var(--spring-gentle) both`, and always a
  `@media (prefers-reduced-motion: reduce) { animation: none; }` escape.
- **Accessibility:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the title,
  `tabIndex={-1}`, and `useDialogFocus(ref, true)` from `design/primitives.tsx`. Escape closes.
  Call `registerAppOverlay()` in an effect so lower layers (Factory mode) defer Escape to you.
- **Safe areas:** pad with `env(safe-area-inset-top/bottom)` on the container.
- **Z-index:** interrupt overlays sit around 58–60; check neighbours before picking, and rank new
  full-screen interrupts in `design/interruptPriority.ts`.

## Deliberate exception

The full-screen milestone takeovers — `.bankrupt`, `.era-modal`, and the `.ipo` win in `App.css` —
are a different "fill the screen with a themed gradient" celebration style **on purpose**. Leave
them alone.

## Reference implementations

`eurekaMoment.css` (accent-tinted with a positive variant) · `paywall.css` (gold prestige tint) ·
`awardsCeremony.css` · `rivalStrike.css`.
