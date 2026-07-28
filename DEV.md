# Silicon: Tech Tycoon — Project Guide

A mid-depth tech-company management sim. You design tech products (phones, tablets,
laptops, …) from components, time the market, price them, launch, earn, and reinvest to
grow from a garage to a global empire.

## RULE #1 — PREMIUM MANDATE (above everything)
The result must look **premium, polished, and clean**. Use the DesignSystem tokens, the
8pt grid, and the motion/microinteraction rules. **Never** hardcode colors/spacing/fonts,
never ship a cramped or unfinished screen, never a blank empty state. If something can't be
made to look polished this session, leave it out and log it — don't ship it rough. A smaller
game that looks impeccable beats a bigger one that looks cheap.

## Design pillars (do not violate)
1. **Premium through restraint** — clean vector, generous whitespace, one tight palette + one accent.
2. **The product IS the toy** — designing a device (parametric render updates live) is the centerpiece.
3. **Meaningful choices over idle waiting** — a sim, not a clicker. Real bets that can fail.
4. **Zero image assets for hero content** — devices/UI/icons are parametric SVG / vector / glyphs, drawn in code.
5. **Readable simulation** — the player always understands *why* a product won or flopped.
6. **Respect the player** — premium monetization, no dark patterns, no nags.

## Stack (web build, ships to iOS via Capacitor)
- Vite + React 19 + TypeScript (strict). Vitest for engine unit tests.
- Parametric **SVG** device renderer (the SwiftUI-Shape strategy, ported to the web).
- `localStorage` persistence with schema versioning (the SwiftData role).
- Capacitor (iOS) + `@capacitor/haptics` for native packaging + haptics.
- **No backend.** Fully offline.

## Architecture (mirror of the original native plan — keep the separation)
```
src/
  engine/      PURE logic, no React/DOM imports — fully unit-testable
    money.ts          money type (integer cents), exact rounding, formatting
    balance.ts        ALL tunable constants in one place
    catalogs.ts       categories + components (single source of truth for content)
    product.ts        a designed product + computed stats + build cost
    market.ts         demand, trends, hype, pricing, launch scoring
    salesCurve.ts     revenue-over-weeks after launch
    competitors.ts    rival company behaviour
    economy.ts        cash, burn, payroll, runway, bankruptcy
    eras.ts           tech-era progression + unlocks
    types.ts          shared engine types
  state/
    useGame.ts        React hook: composes engine, owns the sim tick, persists
  data/               (content tables live in engine/catalogs.ts for v1)
  render/             the signature parametric engine
    deviceStyle.ts    inputs -> visual parameters (the make-or-break mapping)
    squircle.ts       continuous-curvature corner path
    PhoneDevice.tsx, TabletDevice.tsx, DeviceRenderer.tsx
  design/             DesignSystem: tokens.css, tokens.ts, primitives (Card, Button, ...)
  screens/            HQ, DesignLab, Research, Market, Company (staff/facilities/financials)
  App.tsx, main.tsx
```

**Golden rule:** `engine/` imports nothing from React/DOM. The whole simulation is pure TS
and unit-tested. This prevents orchestration bloat and lets the market sim be tuned via tests.

**Protected (no refactor without explicit instruction):** `engine/`, persistence schema +
migrations in `state/useGame.ts`, `render/DeviceRenderer.tsx` + category shapes.

## Quality discipline (every session)
- **END-OF-SESSION CHECK:** code compiles (`npm run typecheck`), tests pass (`npm test`),
  no obvious crashes / non-null-assertion abuse / stray TODOs in what was touched. Fix
  anything *within the current task's scope* before committing.
- Spot an improvement *outside* the current task? **Do not act** — append a one-line note to
  the `## Backlog` in TASK.md.
- Never leave the build broken between sessions. Commit per logical turn.

## Monetization — free download + **Silicon Pro** (full detail in `MONETIZATION.md`)
The app is **free to download and free to play**. Revenue comes from **Silicon Pro**:
monthly / yearly (7-day trial) or a one-time **Lifetime** purchase.

**Pillar #6 is unchanged.** No ads, no timers, no energy, no premium currency, no loot
boxes, no pay-to-win, no nagging — ever. The free tier is a real game (full design →
launch → market loop, the Garage and Growth eras, a daily challenge every day); Pro
unlocks **depth**: the Platform and AI eras, all scenarios, New Game+, Ascension, the
Platform Division, Creative Mode, the Vault and the Museum.

Three rules when touching any of this:
1. **No gate may reach `engine/`.** Every lock sits on a player action or a UI surface, so
   free and Pro runs are byte-identical and the determinism pin can't see monetization.
2. **Pro sells content and modes, never an advantage inside a run.** That's what keeps
   Guideline 3.1.1 off the table and the "no dark patterns" wedge true.
3. **Everyone who bought the $8.99 version keeps everything, forever** (`founding` tier,
   detected from the original download's build number). Never lower `FIRST_FREE_BUILD`.

Code seams: `state/pro.ts` (entitlement) · `state/proGates.ts` (the free/Pro line, one
table) · `state/proStore.ts` (StoreKit) · `components/Paywall.tsx` (the ONE purchase
surface). App Store Connect setup: `appstore/SUBSCRIPTION_GUIDE.md`.

## IP discipline
No real brand/company/product names anywhere (no "iPhone", no real chip names). Fictional
components only. Ship-blocker rule.
