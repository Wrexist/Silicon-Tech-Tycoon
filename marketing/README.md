# marketing/

Ad-creative kit built from **real in-game screenshots** — for App Store, Instagram/Facebook,
TikTok, and paid/social banners.

- **`GUIDE.md`** — start here. The full asset map + channel-by-channel ad-campaign playbook.
- **`VIDEO_SCRIPTS.md`** — shot-by-shot Reels / TikTok / App Preview gameplay cuts.
- **`asset-studio.html`** — open in a browser to preview every creative, switch the CTA (Apple badge
  or pill) and edit the logo label.
- **`assets/`** — the exported PNGs (2×; icon + iPad frames at exact size). `assets/badges/` has the
  Apple App Store badge (black + white SVG); `assets/_device/` holds the device-only screenshot crops
  the compositor uses as hero images.

Covers App Store & Play icon, Instagram/Facebook feed + portrait, Stories/Reels/TikTok, landscape
banners + 16:9, and **iPad** (App Store 13" portrait + landscape showcase) — all from real gameplay.

Regenerate the exported PNGs (Chromium pre-installed; else `npm i -D playwright && npx playwright install chromium`):

```sh
node scripts/crop-device-shots.mjs      # crop app-store screenshots → assets/_device/
node scripts/export-marketing.mjs       # composite → assets/*.png at every size
```
