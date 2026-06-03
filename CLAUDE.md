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

## Monetization (LOCKED) — $8.99 premium, complete & winnable
The base game is whole with zero purchases. v1 IAP = **Sandbox/Creative mode unlock only**.
DLC expansions + cosmetics are scaffolded but ship post-launch. No progression gates,
currency sales, speed-ups, loot boxes, or ads. Ever.

## IP discipline
No real brand/company/product names anywhere (no "iPhone", no real chip names). Fictional
components only. Ship-blocker rule.
