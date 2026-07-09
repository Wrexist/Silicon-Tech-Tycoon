# App Store screenshots — 6.7" (1284 × 2778)

The v1.1.0 marketing set, in upload order. Each frame is a live capture of the real game engine
composed into the shared tilted-titanium marketing frame (dark gradient, two-tone headline, iPhone
frame, wordmark).

| # | File | Headline | Shows |
|---|------|----------|-------|
| 1 | `01-factory.png` | Build the **line** | The 3D factory — packed production floor, conveyors, robot arms, live order + boost |
| 2 | `02-office.png` | Garage to **global empire** | The real-time 3D HQ — a Campus-tier office (the room grows with the facility), team at their desks, lounge + greenery |
| 3 | `03-design.png` | Design every **detail** | The Design Lab — 3D device preview, fit score, build + design language, trait chips |
| 4 | `04-market.png` | Race rivals to **#1** | The industry leaderboard — a dozen rivals by valuation, you climbing past them |
| 5 | `05-research.png` | Research on your **terms** | Timed research on the live progress ring + the "Up next" queue |
| 6 | `06-awards.png` | Win the **industry** | The Silicon Awards — a clean sweep of Device / Design / Value of the Year |
| 7 | `07-strike.png` | Answer every **rival** | A rival strike duel — cut price, counter-campaign, or hold the line |
| 8 | `08-global.png` | Take it **global** | Regional licensing — each region's taste + your live standing |
| 9 | `09-premium.png` | Premium. **Complete.** Yours. | One-time price, no ads / no loot boxes, offline — over the lavish 3D office |

## Regenerating

```sh
npm run build                     # dist/ must be current — the shooter serves it
npm run shots:stage:showcase      # stages the lavish Campus save + overlay payloads
node scripts/shots-refresh.mjs    # renders all 9 frames → .newfeat-shots/store/
cp .newfeat-shots/store/0*.png app-store-screenshots/store/
```

Order and captions track `appstore/APP_STORE_METADATA.md` §11.
