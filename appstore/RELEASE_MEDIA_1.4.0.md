# 1.4.0 store media

The six-image sequence is Office → Factory → Design → Research → Market → Company.
Each image uses the actual production interface and an isolated, engine-built showcase save.
The save has ten staff, an arranged Campus office, coordinated finishes, active production and
a decorated factory. No player saves or purchased furniture are modified by staging.

The in-game changes are separate from staging: upgraded dark offices receive a glazed studio
wall; the factory receives brighter lighting, a quiet grid outside editing and a closer portrait
camera angle. These defaults apply during normal play, including existing saves.

## Reproduce

Run `npm ci`, `npm run build`, `npm run shots:stage:showcase`, then
`node scripts/store-media-1.4.mjs`. Install Chromium with
`npx playwright-core install --with-deps chromium` or set `SHOTS_CHROME`.

Set `MEDIA_VIDEO=1` to capture gameplay frames, then run
`node scripts/encode-store-preview.mjs` with FFmpeg available (`SHOTS_FFMPEG` overrides its path).
Output is under `appstore/release-1.4.0/`:

- `iphone/`: six opaque PNGs, 1320 × 2868; `raw/` preserves unframed captures.
- `ipad/`: six opaque PNGs, 2064 × 2752; `raw/` preserves unframed captures.
- `preview/Silicon-1.4.0-iPhone.mp4`: real gameplay, 886 × 1920, 30 fps, H.264 High 4.0.
- `preview/poster.png`, `preview/ffprobe.json`, and `capture-report.json`: review evidence.

The preview contains five four-second gameplay scenes with short captions. Browser time advances
one frame at a time so software-rendering speed does not change the intended animation speed.
It records an office camera gesture, device front/back control, working factory, and research/team
navigation. Capture and encoding reject static clips. Captions sit above the full game view.
Its stereo AAC track is silent; no soundtrack is invented or licensed by this process.

The workflow's optional `screenshot_run_id` reuses a previously reviewed media artifact while
recapturing the preview. Screenshot files are RGB PNGs without an alpha channel.

The Store media workflow preserves an artifact named `silicon-store-media-1.4.0`. Review every
image and the video before passing that exact run ID to the store-preparation workflow. The
preparation script backs up the existing draft screenshots, uploads replacements, checks Apple's
processing result, and sets their order. It cannot submit or release an app version.
