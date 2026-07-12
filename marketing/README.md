# marketing/

Ad-creative kit built from **real in-game screenshots** — for App Store, Instagram/Facebook,
TikTok, and paid/social banners.

- **`GUIDE.md`** — start here. The full asset map + channel-by-channel ad-campaign playbook.
- **`asset-studio.html`** — open in a browser to preview every creative and edit the CTA / logo label.
- **`assets/`** — the exported PNGs (2×; icon is 1024²). `assets/_device/` holds the device-only
  screenshot crops the compositor uses as hero images.

Regenerate the exported PNGs (Chromium pre-installed; else `npm i -D playwright && npx playwright install chromium`):

```sh
node scripts/crop-device-shots.mjs      # crop app-store screenshots → assets/_device/
node scripts/export-marketing.mjs       # composite → assets/*.png at every size
```
