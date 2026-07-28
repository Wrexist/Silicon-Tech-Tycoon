# Promo video — Silicon: Tech Tycoon

A ~29s portrait promo (1080×2340) for the App Store preview slot, ads, and social. Recorded from
the **live game** (real 3D office, real Vault board, real launch reveal, real celebration) with hype
text overlays baked in.

> ## ⚠ The `.mp4` here is the OLD 1.1.0 cut — do not upload it
>
> `Silicon-TechTycoon-promo.webm` is the current **1.2.0** cut (Vault beat, restored hit reveal).
> `Silicon-TechTycoon-promo.mp4` is the **1.1.0** cut and has no Vault beat. App Store Connect accepts
> `.mov`, `.m4v` and `.mp4` — but not WebM — so the only file here it would take is the stale one,
> and uploading as-is would ship the previous release's video.
>
> This environment's ffmpeg is a VP8/WebM-only build — no H.264 encoder, no MP4 muxer — so the
> transcode cannot happen here. Run it once on any machine with a full ffmpeg:
>
> ```sh
> ffmpeg -i Silicon-TechTycoon-promo.webm -c:v libx264 -preset slow -crf 18 \
>        -pix_fmt yuv420p -movflags +faststart -an Silicon-TechTycoon-promo.mp4
> ```
>
> Then **watch it through once** before uploading. The frames below were verified by sampling, which
> catches a blank or blocked beat but not pacing.

## Beats

1. **Brand intro** — logo + "Build the empire behind every device."
2. **Living office** — the reactive 3D studio ("Run a studio that's alive").
3. **The Vault** — the redacted dossier board, mid-hunt: an opened file, a decrypting one, and a
   sealed one still behind "Run down the lead" ("Eighteen files nobody told you about"). Placed
   early on purpose — `APP_STORE_FEATURING.md` argues the Vault is a better cold hook than a
   conveyor belt, and the first seconds are where viewers decide.
4. **Design** — the Design Lab device card, live 3D render ("Craft iconic devices").
5. **Factory** — the decorated production line ("Build it on your own line").
6. **The perfect launch** — a real hit reveal: **91/100, "It's a hit!"**, confetti.
7. **The team celebrates** — the whole office cheers with emotes ("Your whole team celebrates").
8. **The empire** — #1 of 13, **$4.07B** net worth ("Build a billion-dollar empire").
9. **End card** — "Coming to iPhone & iPad."

## Regenerate

```sh
npm run build && npm run preview -- --port 5200 &   # serve the built app
SHOTS_URL=http://localhost:5200 npm run promo:video # stage save + record + compress
# → /tmp/silicon-promo-vid/Silicon-TechTycoon-promo.webm  (copy here, then transcode as above)
```

`scripts/stage-promo-video.mjs` stages a thriving save with the hero device on the ready shelf;
`scripts/promo-video.mjs` drives a headless Chromium (Playwright), records the continuous take, and
time-compresses it to ~29s with the bundled ffmpeg (`-itsscale`, no re-encode). Set
`PROMO_TARGET_SECS` to change the final length.

## Three things that will silently ruin a take

The recording is **one continuous shot** with no retries, so anything that goes wrong is baked in and
only shows up on playback. All three of these have actually happened:

- **A pending interrupt.** Any decision card owns the screen for the rest of the take — it covers the
  HUD, so every later `nav()` silently misses and the remaining beats all record the same card. The
  recorder clears every `pending*` and pushes `lastInterruptWeek` forward; keep that list in step with
  `scripts/shots-refresh.mjs`.
- **A lazy chunk losing the race.** Every non-initial screen is code-split, so a fixed sleep after
  `nav()` can record a blank screen. `nav()` waits for each screen's own markup and warns if it never
  appears — watch the console for that warning.
- **The hero not being a hit any more.** Since 1.2.0 the hit bar rises with the company's own track
  record, so a hero matching its predecessors reads "Solid performer" and the promo's climax is gone.
  `stage-promo-video.mjs` ends with a HERO CHECK that prints the effective score against the live
  bars and fails loudly if the verdict isn't `hit`. If it fires, widen the gap between the back
  catalogue and the hero rather than editing around it.
