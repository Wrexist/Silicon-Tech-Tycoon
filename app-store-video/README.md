# Promo video — Silicon: Tech Tycoon

`Silicon-TechTycoon-promo.webm` — a ~29s portrait promo (1080×2340, VP8/WebM) for the App Store
preview slot, ads, and social. Recorded from the **live game** (real 3D office, real launch reveal,
real celebration) with hype text overlays baked in.

## Beats

1. **Brand intro** — logo + "Build the empire behind every device."
2. **Living office** — the reactive 3D studio ("Run a studio that's alive").
3. **Design** — the Design Lab crafting a device ("Craft iconic devices").
4. **Factory** — the decorated production line ("Build it on your own line").
5. **The perfect launch** — a real hit reveal: **91/100, "It's a hit!", 4 in a row**, confetti.
6. **The team celebrates** — the whole office cheers with emotes ("Your whole team celebrates").
7. **The empire** — #1 of 13, **$4.13B** net worth ("Build a billion-dollar empire").
8. **End card** — "Coming to iPhone & iPad."

## Regenerate

```sh
npm run build && npm run preview -- --port 5200 &   # serve the built app
npm run promo:video                                 # stage save + record + compress
# → /tmp/silicon-promo-vid/Silicon-TechTycoon-promo.webm  (copied here)
```

Under the hood: `scripts/stage-promo-video.mjs` stages a thriving save with a guaranteed-hit device
on the ready shelf; `scripts/promo-video.mjs` drives a headless Chromium (Playwright), records the
continuous take, and time-compresses it to ~29s with the bundled ffmpeg (`-itsscale`, no re-encode).
Set `PROMO_TARGET_SECS` to change the final length.

## App Store Connect note

App Store Connect app previews must be **H.264 `.mov`/`.mp4`** (not WebM). This environment's ffmpeg
only encodes VP8/WebM, so the deliverable here is WebM (fine for web, Android, and most ad
platforms). To upload to App Store Connect, transcode once on any machine with a full ffmpeg:

```sh
ffmpeg -i Silicon-TechTycoon-promo.webm -c:v libx264 -pix_fmt yuv420p -crf 18 \
       -vf "scale=1080:1920" -an Silicon-TechTycoon-promo.mp4
```

(App Store preview specs accept 1080×1920 portrait; adjust the scale/crop to the exact device slot.)
