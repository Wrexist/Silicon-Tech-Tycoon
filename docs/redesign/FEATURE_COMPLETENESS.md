# Feature completeness and Factory review — 2026-09-23

Scope: compare the redesign with its parent implementation, inspect action wiring, and open the current built application's main panels in an isolated week-28 showcase. This is a reachability review, not proof that every late-game branch and native purchase succeeds.

## Features retained

| Area | Present functionality | Evidence |
|---|---|---|
| Office | Staff interactions, furniture editor, objectives, operations, upgrades and activity | HQ source and preceding editor/placement browser checks |
| Design | Components, materials/colour, camera/specs, pricing, prototype testing, manufacturing and launch | Four panels opened; advanced supply/factory and production-wizard actions remain wired in source |
| Research | Projects, component tiers, active work, queue/refunds, prerequisites, finishes/lenses and keynote | Both panels opened; queue/cancellation previously exercised; optional sinks remain in source |
| Market | Standing, product performance, successors, demand, geographic markets, ownership and stock trading | Three panels opened; contextual sheets/actions retained |
| Company | Financials/history, hiring, roles, training and Platform division | Overview/Team/Platform opened; Platform founding prerequisites remain explicit |
| Progress/settings | Goals, roadmap, mastery, Vault, founder history, achievements, scenarios, challenges, museum, help, save export/import/recovery and purchases | Navigation and source wiring inspected; paid/era gates intentionally remain |
| Factory | Production order, floor editing, belts, machines, auto-routing, undo, decor, assembly upgrades, expansion, layout saving/loading, stats, boost and side orders | Factory opened; Stats/Style/Build captured; remaining actions inspected in FactoryMode and reducers |

No clearly removed core feature was found in this scope. Some controls are conditional on era, researched technology, existing products or entitlement; a locked feature is not an absent implementation. The old unchecked TASK.md milestones are not reliable evidence that a feature is missing today.

## Two fixes made during this review

1. Factory used `burn()` while Company/Market used the fuller weekly outflow. Its displayed surplus could omit debt payments and late-era overhead. Factory now uses the shared `weeklyFinancials` calculation and explicitly labels forecast outflow/cash surplus.
2. Factory's Upgrades help incorrectly directed players to Company. It now points to Office upgrades, where those controls actually live.

## Remaining improvements, not missing core mechanics

- Factory framing leaves substantial empty space on a portrait phone; the scene and controls need a dedicated visual pass. Existing player-selected materials must remain respected.
- The collapsed Current order header hides the product, progress and ETA. A compact always-visible summary would make production easier to monitor.
- A library of multiple named product drafts would be useful. Current persistence deliberately holds one active draft per company/run, with backup recovery and undo/redo.

Factory screenshots: `artifacts/redesign-implementation/feature-audit/factory-floor.png`, `factory-order.png`, `factory-build.png`, `factory-stats.png`, `factory-style.png` and `factory-overview.png`. These are actual browser renders of a staged company, not concept artwork or the player's save.

Physical-device performance, native purchase restoration and iOS lifecycle behavior remain outside the evidence available on this Windows machine.

## Validation

Production TypeScript/Vite build passed; full Vitest suite: 204 files / 2,140 tests passed. Existing shared-financial tests cover debt payments and late-era overhead. The 12 main panels opened without page errors; the Progress hub was also reached. Factory captures produced no page errors. No real player save was changed.
