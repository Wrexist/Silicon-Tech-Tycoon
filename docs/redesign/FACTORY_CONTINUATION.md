# Factory and design-library follow-up — 2026-09-24

## Implemented

- Factory is part of the main Office/Factory navigation from week zero, before the first product. Previously it appeared after production started or in era two.
- Owned production lines no longer require a later era. Their purchase prices, running costs and production effects are unchanged. Advanced contract lines retain their era requirements.
- The Machine shop offers owned-line purchases, with affordability checks and idle upkeep disclosed. Company also exposes the same management action from the start.
- Factory uses separate layout rows for the order, interactive 3D scene, tools and build/action controls. Collapsing an order preserves its product name, units, progress and remaining weeks. Camera fitting handles portrait/landscape and expanded floors. Saved placements and finishes are untouched.
- Design Lab supports 12 named snapshots per company/run. Save, open, rename and confirmed deletion work locally; opening a design first preserves the working draft. Full storage, invalid records and quota failures do not silently discard the working design. The existing active-draft autosave is retained.

## Money and progression

New companies start with $100,000. Entering the workshop is free; its existing starter Intake and Packer remain included. Belts cost $400 per tile and additional machines cost $6,000–$18,000. These placed objects are distinct from buying an owned production line.

| Owned line | Purchase | Weekly upkeep, including idle weeks | Access |
| --- | ---: | ---: | --- |
| Homeline 1 | $900,000 | $9,000 | Any era, when affordable |
| GigaFab | $9,000,000 | $60,000 | Any era, when affordable |

Previously Homeline required era two and GigaFab era three. Neither now requires a fixed week or an era milestone. There is no save migration or change to existing ownership.

## Verification and evidence

- Production TypeScript/Vite build and typecheck passed.
- Browser checks passed for week-zero navigation, unaffordable/affordable purchases, exact Homeline cash deduction, ownership after reload, named draft restoration/rename/deletion/reload and quota failure.
- Layout checks passed at 320×568, 390×844 with 130% text, 430×932 and 820×1180, in view and build modes. No page errors; order status remains visible and controls reserve scene space.
- Screenshots and machine-readable checks: `artifacts/factory-continuation/qa/`. Matching baseline and initial new captures: `before/` and `after/` in the same directory. These are browser captures of test companies, not the player's save.
- Unit tests cover early access, acquisition rules, snapshot validation/recovery/capacity and camera bounds. Full suite: 206 files / 2,146 tests passed (`npm test -- --maxWorkers=2`, `tests-retry.log`). The first run encountered an unexpected worker exit and was not accepted as a clean pass.

## Generated / limitations

No new raster artwork was required or generated in this follow-up. The factory remains real interactive geometry; previously integrated artwork is retained. Screenshots use desktop Chromium software rendering. Physical-device performance, native iOS lifecycle behavior and purchase restoration remain unverified on this Windows workstation. The named library is local to this device, not cloud synced.
