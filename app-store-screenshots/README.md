# App Store screenshots

Finished, branded marketing screenshots for the App Store listing — headline + a live
in-app capture + the wordmark, on the app's dark/blue brand background.

## `6.7/` — iPhone 6.7" (1290 × 2796)
The standard required iPhone screenshot size; App Store Connect scales it for smaller devices.

| # | Screen | Headline |
|---|--------|----------|
| 01 | Design Lab (device back, live render) | **Design every detail** |
| 02 | Launch — stats, price, margin | **Time the market** |
| 03 | Industry leaderboard | **Race rivals to #1** |
| 04 | Real-time 3D HQ | **Garage to global empire** |
| 05 | Research / era roadmap | **Own the frontier** |

## Regenerating

```bash
npm run dev                 # serve the app
node scripts/shots.mjs      # restages a rich save + recomposes every frame
```

Needs Playwright once: `npm i -D playwright && npx playwright install chromium`.
To target another size (e.g. 6.9" 1320×2868 or 6.5" 1242×2688), change `SIZE` at the top of
`scripts/shots.mjs`. The script stages a paused late-game save, so the numbers always look rich.
