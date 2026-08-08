# App Store screenshots — 6.7" (1284 × 2778)

The v1.2.0 marketing set, in upload order. Each frame is a live capture of the real game engine
composed into the shared tilted-titanium marketing frame (dark gradient, two-tone headline, iPhone
frame, wordmark).

Order follows `APP_STORE_FEATURING.md`: **lead with the Vault**, because the redacted dossier board
is the one frame that reads as a promise rather than a status readout, and the first three are what
most people ever see in search.

| # | File | Headline | Shows |
|---|------|----------|-------|
| 1 | `01-vault.png` | Eighteen files you were **never told about** | The Vault mid-hunt — a decrypted file with its progress bar, two opened files in gold, and a sealed one still redacted with "Run down the lead" |
| 2 | `02-factory.png` | Build the **line** | The 3D factory — packed production floor, conveyors, robot arms, a live order + boost |
| 3 | `03-design.png` | Design every **detail** | The Design Lab — 3D device preview, fit score, build + design language, trait chips |
| 4 | `04-market.png` | Race rivals to **#1** | The industry leaderboard — a dozen rivals by valuation, you climbing past them |
| 5 | `05-office.png` | Garage to **global empire** | The real-time 3D HQ — a Campus-tier office (the room grows with the facility), team at their desks, lounge + greenery |
| 6 | `06-awards.png` | Win the **industry** | The Silicon Awards — a clean sweep of Device / Design / Value of the Year |
| 7 | `07-strike.png` | Answer every **rival** | A rival strike duel — cut price, counter-campaign, or hold the line |
| 8 | `08-research.png` | Research on your **terms** | Timed research on the live progress ring + the "Up next" queue |
| 9 | `09-global.png` | Take it **global** | Regional licensing — each region's taste + your live standing |
| 10 | `10-premium.png` | Free to play. **No dark patterns.** | Free download, no ads / timers / loot boxes, Pro optional — over the lavish 3D office |

**Frame 10 must never name a price.** It used to read "$8.99 once", which outlived the paid era and
was rejected under **Guideline 2.3.7 (Accurate Metadata)** — the app is a free download with a
Silicon Pro subscription. A screenshot also cannot know the localized price StoreKit will charge, so
describe the model (see `MONETIZATION.md`) and let the store show the number.

## Regenerating

```sh
npm run build                     # dist/ must be current — the shooter serves it
npm run shots:stage:showcase      # stages the lavish Campus save + overlay payloads
node scripts/shots-refresh.mjs    # renders all 10 frames → .newfeat-shots/store/
cp .newfeat-shots/store/*.png app-store-screenshots/store/
```

`SHOTS_ONLY="vault,factory"` re-captures just those frames while you iterate on one; the rest keep
their existing raws in `.newfeat-shots/store-raw/`.

Order and captions track `appstore/APP_STORE_METADATA.md` §11.
