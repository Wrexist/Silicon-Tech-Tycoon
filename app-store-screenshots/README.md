# App Store screenshots

Finished, branded marketing screenshots for the App Store listing. Each frame is a headline +
a live in-app capture (in the app's **dark** theme, for a cohesive premium look) wrapped in a
realistic device frame + the wordmark, all on the app's dark/blue brand background — at the exact
App Store pixel dimensions.

## `store/` — iPhone 6.7" (1284 × 2778)
The primary iPhone set: 10 immersive frames, each live screen composed into a 3D-perspective,
tilted titanium-iPhone marketing frame (status bar, dynamic island, depth + floor glow). This is
the required 6.7" slot; App Store Connect scales it for smaller iPhones.

| #  | Screen | Headline |
|----|--------|----------|
| 01 | The Vault — the redacted dossier board | **Eighteen files you were never told about** |
| 02 | Factory Mode — the 3D line, live order | **Build the line** |
| 03 | Design Lab (live device render)        | **Design every detail** |
| 04 | Industry leaderboard                   | **Race rivals to #1** |
| 05 | Real-time 3D HQ                        | **Garage to global empire** |
| 06 | The Silicon Awards ceremony            | **Win the industry** |
| 07 | Rival Strike duel                      | **Answer every rival** |
| 08 | Research — live ring + queue           | **Research on your terms** |
| 09 | Regional licensing + standings         | **Take it global** |
| 10 | Real-time 3D HQ                        | **Free to play. No dark patterns.** |

Lead with 01–03: the Vault board is the one frame that reads as a promise rather than a status
readout, and search thumbnails only ever show the first three. See `store/README.md` for what each
frame contains and how to regenerate one.

## `ipad/` — iPad 13" (2064 × 2752)
The iPad set: 10 screens composed into a 3D-tilted **aluminium iPad** frame (uniform slim bezels,
front camera, depth + floor glow). 2064 × 2752 is the largest required iPad slot (13" iPad,
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
| 10 | Real-time 3D HQ                   | **Free to play. No dark patterns.** |

**These are marketing renders, not submission assets.** `ios/App/App.xcodeproj/project.pbxproj`
sets `TARGETED_DEVICE_FAMILY = "1"` — the app ships iPhone-only, so App Store Connect never asks for
an iPad screenshot slot. They are useful for a press kit or a featuring pitch and nothing else.
They also render the older ten-screen line-up (the same one `shots:store:legacy` produces), so they
predate the Vault, the Autonomy Era and Nemesis Duels. If iPad support is ever enabled, refresh
these before relying on them.

## `6.7/` — iPhone 6.7" (1284 × 2778), legacy hero set
An earlier 5-frame hero set (`scripts/shots.mjs`). Kept for reference; `store/` supersedes it.

## Regenerating

The iPhone set is self-contained — the shooter serves `dist/` in-process, so there is no preview
server to start and nothing to keep running alongside it.

```bash
npm run build                       # dist/ must be current — the shooter serves it
npm run shots:stage:showcase        # lavish Campus save + overlay payloads → /tmp/silicon-showcase*.json
npm run shots:store                 # all 10 iPhone frames → .newfeat-shots/store/
rm -f app-store-screenshots/store/*.png     # cp overwrites by name; it does NOT remove
cp .newfeat-shots/store/*.png app-store-screenshots/store/
```

`SHOTS_ONLY="vault,factory"` re-captures just those frames and leaves the rest on their existing
raws in `.newfeat-shots/store-raw/` — use it while iterating on one frame.

The iPad set is the older two-process pipeline and still needs a server:

```bash
npm run build
npm run preview -- --port 5199 &
npm run shots:stage                 # rich late-game save → /tmp/silicon-stage.json
npm run shots:ipad                  # iPad set → app-store-screenshots/ipad/
```

`shots:store:legacy` (`scripts/shots-store.mjs`) is the superseded iPhone line-up
(design / market / leaderboard / hq / decorate / research / finance / people / team / premium) —
the same ten screens `shots:ipad` renders, and NOT what ships in `store/`. That shared line-up is
why the iPad set and the legacy iPhone set always match each other and never match `store/`. `shots:features` likewise
predates the current set: the factory, awards and rival-strike frames it added are now frames 02,
06 and 07 of the main shooter.

The showcase save decorates the factory (upgraded machines, decor props, painted walls), leaves one
build on the line so the conveyor animates, and leaves the Vault mid-hunt (3 files open, several
rumoured, the rest sealed) so frame 01 shows all four card states at once.

Needs Chromium via `playwright-core` (a devDependency). The scripts auto-detect the pre-installed
Chromium at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`, or set `SHOTS_CHROME=/path/to/chrome`
and `SHOTS_URL` to override. The staged save pauses a late-game state so the numbers always read rich.

To target another size, change `SIZE` at the top of the relevant script (`shots-refresh.mjs` for
iPhone, `shots-ipad.mjs` for iPad — the iPad `CAP` capture viewport must stay ≤ 540px wide and match
the screen's aspect).
