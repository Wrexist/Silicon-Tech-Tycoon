# App Store screenshots

Finished, branded marketing screenshots for the App Store listing. Each frame is a headline +
a live in-app capture (in the app's **dark** theme, for a cohesive premium look) wrapped in a
realistic device frame + the wordmark, all on the app's dark/blue brand background — at the exact
App Store pixel dimensions.

## `store/` — iPhone 6.7" (1284 × 2778)
The primary iPhone set: 10 immersive frames, each live screen composed into a 3D-perspective,
tilted titanium-iPhone marketing frame (status bar, dynamic island, depth + floor glow). This is
the required 6.7" slot; App Store Connect scales it for smaller iPhones.

## `ipad/` — iPad 13" (2064 × 2752)
The iPad set: the same 10 screens composed into a 3D-tilted **aluminium iPad** frame (uniform slim
bezels, front camera, depth + floor glow). 2064 × 2752 is the largest required iPad slot (13" iPad,
portrait); App Store Connect scales it to the 12.9"/11" slots. The app is a phone-width UI, so each
screen is captured at its designed max width (a clean 3:4 capture) and shown full-bleed in the iPad.

| #  | Screen | Headline |
|----|--------|----------|
| 01 | Design Lab (live device render)   | **Design every detail** |
| 02 | Launch — price, margin, demand    | **Read the market** |
| 03 | Industry leaderboard              | **Race rivals to #1** |
| 04 | Real-time 3D HQ                   | **Garage to global empire** |
| 05 | Studio decorator (furniture shop) | **Make it yours** |
| 06 | Research doctrines                | **Choose your doctrine** |
| 07 | Financing / debt                  | **Master your finances** |
| 08 | Talent poaching event             | **Keep your best people** |
| 09 | Team morale & roster              | **Grow a real team** |
| 10 | Real-time 3D HQ                   | **Premium. Complete. Yours.** |
| 11 | Factory Mode — decorated 3D line  | **Build the line** |
| 12 | The Silicon Awards ceremony       | **Win the industry** |
| 13 | Rival Strike duel                 | **Answer every rival** |
| 14 | Side Order — client commission    | **Take the contract** |

Lead the carousel with 01–04; 05–10 add depth/progression signal; 11–14 showcase the newest
systems (the buildable 3D factory floor, the annual awards, rival-launch duels, and contract work).

## `6.7/` — iPhone 6.7" (1284 × 2778), legacy hero set
An earlier 5-frame hero set (`scripts/shots.mjs`). Kept for reference; `store/` supersedes it.

## Regenerating

```bash
npm run build                       # build the production app
npm run preview -- --port 5199 &    # serve it
npm run shots:stage                 # stage a rich late-game save → /tmp/silicon-stage.json
npm run shots:store                 # iPhone set 01–10 → app-store-screenshots/store/
npm run shots:ipad                  # iPad set  → app-store-screenshots/ipad/

# New-feature frames 11–14 (factory, awards, rival strike, side order):
npm run shots:stage:showcase        # rich save + overlay payloads → /tmp/silicon-showcase*.json
npm run shots:features              # frames 11–14 → app-store-screenshots/store/
```

`shots:features` reuses the exact same 3D marketing frame as `shots:store`; it captures the
buildable factory floor plus the transient overlays (the Silicon Awards ceremony, a Rival Strike
duel, a Side-Order commission), which `stage-showcase.mjs` synthesises from real products/rivals so
every card renders with live device art. The showcase save decorates the factory (upgraded machines,
decor props, painted walls) and leaves one build on the line so the conveyor animates.

Needs Chromium via `playwright-core` (a devDependency). The scripts auto-detect the pre-installed
Chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`, or set `SHOTS_CHROME=/path/to/chrome`
and `SHOTS_URL` to override. The staged save pauses a late-game state so the numbers always read rich.

To target another size, change `SIZE` at the top of the relevant script (`shots-store.mjs` for
iPhone, `shots-ipad.mjs` for iPad — the iPad `CAP` capture viewport must stay ≤ 540px wide and match
the screen's aspect). `SHOTS_ONLY="decorate,hq"` (iPad script) re-captures just those frames while
iterating.
