# App Store screenshots

Finished, branded marketing screenshots for the App Store listing. Each frame is a headline +
a live in-app capture (in the app's **dark** theme, for a cohesive premium look) wrapped in a
**realistic titanium iPhone frame** (status bar, dynamic island, side buttons, floor glow) +
the wordmark, all on the app's dark/blue brand background.

## `6.7/` — iPhone 6.7" (1284 × 2778)
The standard required iPhone screenshot size; App Store Connect scales it for smaller devices.

| # | Screen | Headline |
|---|--------|----------|
| 01 | Design Lab (device back, live render) | **Design every detail** |
| 02 | Launch — stats, price, margin | **Time the market** |
| 03 | Industry leaderboard | **Race rivals to #1** |
| 04 | Real-time 3D HQ | **Garage to global empire** |
| 05 | Studio decorator (furniture shop) | **Make it yours** |
| 06 | Research / era roadmap | **Own the frontier** |

Lead the carousel with 01–04; 05–06 add depth/progression signal.

## Regenerating

```bash
npm run dev                 # serve the app
node scripts/shots.mjs      # restages a rich save + recomposes every frame
```

Needs Playwright once: `npm i -D playwright && npx playwright install chromium`.
To target another size (e.g. 6.9" 1320×2868 or 6.5" 1242×2688), change `SIZE` at the top of
`scripts/shots.mjs`. The script stages a paused late-game save, so the numbers always look rich.
