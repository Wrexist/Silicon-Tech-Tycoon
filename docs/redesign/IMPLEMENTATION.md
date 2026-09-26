# Silicon redesign

## Audit
React 19 + TypeScript + Vite, Capacitor iOS, responsive web. Phone layout up to 540px; rail navigation from 800px, wide layout at 1100px. Existing font retained. Tested viewport evidence is recorded separately; no physical iOS profiling is claimed.

App.tsx owns root navigation and page stack. HQ remains mounted for WebGL; Design now remains mounted after its first visit so unfinished edits survive tab navigation. Existing local save schema and player furniture coordinates are unchanged.

GameState/useGame owns cash in integer cents, research balances/queue, production, staff and progression. Continuous time has pause, normal/fast and skip-to-next-event. The dock exposes these existing operations directly, without a competing turn-based advance button. Modal suspension remains enforced by the simulation. Company and Market share a next-week forecast using total weekly outflow (operating costs, debt service, late-era overhead). History charts use stored actual history, not estimates.

Office uses Three.js / React Three Fiber, procedural animated robots, existing GLB furniture loaders, shared materials, camera rig and automatic placement reservations. Live DeviceRenderer supports player-configurable products and remains the authoritative product preview.

Read CLAUDE.md, DEV.md, imagegen and game-development-studio skills. No applicable AGENTS.md found. User white-card direction supersedes the older glass treatment. Existing unrelated untracked files were preserved. game-dev CLI is unavailable; the existing renderer/toolchain is used directly.

## Implementation checklist
- [x] Reuse: five baseline screenshots at 390x844, same showcase save.
- [x] Refine: semantic tokens, compact resource header, consistent cobalt selection, accessible button sizes.
- [x] Build in code: measured bottom dock reserves its actual height including safe area.
- [x] Refine: continuous time controls; pause works on the first tap.
- [x] Refine: Office scene, summaries, objective, editor access and reset camera.
- [x] Build in 3D: wall-mounted windows; shared pale oak/muted blue materials.
- [x] Reuse: owned furniture, automatic workstation grouping and animation systems.
- [x] Refine: Design stages reflect existing mechanics, actionable fit advice, separate production, persistent in-session draft.
- [x] Refine: Research balance, committed progress, queue, refund explanation and prerequisite states.
- [x] Refine: Market valuation definition, history, standing and secondary ownership actions.
- [x] Refine: Company identity, matched weekly financial cards, recorded growth and team management.
- [x] Refine: include new WebP artwork in offline PWA precaching.
- [x] Generate: engineer/designer/marketer portraits and two research illustrations; inspected alpha and small-size quality.
- [x] Reuse: researcher uses orange identity; HR uses blue identity. Purple/yellow experiments remain unintegrated originals.
- [x] Reuse: live device SVG, achievements and native empty-state icons; no duplicate raster generation.

## Asset provenance
assets.json contains exact prompts, references, source paths, alpha checks and integration paths. Seven separate GPT generations were made; five active 256px WebPs are integrated. Originals and a review strip are in artifacts/redesign-implementation/generated-originals and asset-review.png. No generated UI text or flat office replacement is used.

## Capture notes
Before/after captures use the same staged showcase fixture, not a player save. Values are simulation-derived from that fixture; existing seeded history may differ from its current valuation. Viewport screenshots show the first visible content; full captures include all management actions. Real saved room styles are now respected by the light renderer, so a brick-selected save remains brick instead of being repainted for the mockup.

## Limits
Physical iPhone performance, native iOS build/signing and true device safe-area behavior require a device/macOS environment. Software-rendered browser captures cannot establish frame-rate readiness. Drafts survive navigation within a session; this change does not add cross-reload draft storage. Existing saved placement was preserved rather than relocating furniture to match the reference composition.
