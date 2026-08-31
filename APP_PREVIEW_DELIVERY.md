# App Preview delivery — Silicon: Tech Tycoon

**Status: NOT submission-ready. Not a submission blocker.**

An App Preview video is **optional** on the App Store. Screenshots alone satisfy the media
requirement for a version submission, and this repo already ships screenshots — the authoritative
upload set is `app-store-screenshots/store/` (10 frames, 1284x2778, in upload order per
`appstore/APP_STORE_METADATA.md`), plus `app-store-screenshots/ipad/` (10 frames, 2064x2752).
Note `app-store-screenshots/6.7/` holds only 5 frames and is NOT the set the checklist names.
If the preview slot is left empty,
the app can still be submitted and reviewed. Everything below is about shipping a preview *well*,
not about unblocking release.

This document was written from measurements taken in this repo, not from the existing
`app-store-video/README.md`. Where a number could not be measured, or an Apple requirement could not
be verified with certainty, that is stated explicitly rather than guessed.

---

## 1. Every video asset in the repo

A full sweep of `app-store-video/`, `app-store-screenshots/`, `public/`, `resources/`, `dist/` and
`appstore/` for `.mp4 .webm .mov .m4v .avi .mkv .gif` found **exactly two video files**, both in
`app-store-video/`. There is no video in `public/`, `resources/`, `dist/` or `appstore/`
(`resources/` holds only PNG icon/splash art; `public/` holds `.glb` furniture models).

### Measurement method — read this before trusting the numbers

`ffprobe`, `ffmpeg`, `mediainfo`, `exiftool` and `mp4info` are **all absent** from this environment
(`which` returned nothing for each). The only ffmpeg binary anywhere on this machine is Playwright's
bundled build at `/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`, and it is deliberately minimal —
`-encoders` lists exactly one video encoder (`libvpx`, VP8) and `-muxers` lists exactly one relevant
muxer (`webm`). **No H.264 encoder and no MP4 muxer exist here.**

So every property below was read by parsing the container byte structure directly (ISO-BMFF box tree
for the MP4, EBML element tree for the WebM) with purpose-written Python parsers. Container metadata
is authoritative for format, codec, dimensions, duration, frame rate and track layout. It cannot tell
you what the picture *shows* — see the "what I could not determine" note under each asset.

### Asset A — `app-store-video/Silicon-TechTycoon-promo.mp4`

| Property | Measured value | How |
| --- | --- | --- |
| File size | 9,665,893 bytes (9.22 MiB) | `ls -l` |
| Container | MP4 / ISO-BMFF — `ftyp` major brand `isom`, minor 512, compatible `isom iso2 avc1 mp41` | `ftyp` box |
| Video codec | **H.264 / AVC** — sample entry `avc1`; `avcC` profile_idc 100 (**High**), level_idc 50 (**Level 5.0**) | `stsd` → `avc1` → `avcC` |
| Resolution | **1080 × 2340** (coded size in `avc1`; `tkhd` display size also 1080.0 × 2340.0, so no display-matrix scaling) | `stsd` / `tkhd` |
| Aspect ratio | **1080:2340 = 3:6.5 = 19.5:9 portrait** (2.16667:1) | arithmetic |
| Duration | **29.040 s** (`mvhd` timescale 1000, duration 29040; `mdhd` timescale 12800, duration 371712 → 29.0400 s — the two agree) | `mvhd` + `mdhd` |
| Frame rate | **25.000 fps, constant** — `stts` has a single entry: 726 samples × delta 512 at media timescale 12800 (12800 ÷ 512 = 25); 726 frames ÷ 29.04 s = 25.000 | `stts` |
| Frame count | 726 (`stsz` sample_count 726, matching `stts`) | `stsz` |
| Audio track | **NONE.** `moov` contains exactly one `trak`, whose `hdlr` is `vide` / "VideoHandler". There is no `soun` track and no `mp4a` sample entry anywhere in the file. | `moov` box tree |
| Faststart | **Yes** — `moov` at byte offset 32, `mdat` at 8898, so the index precedes the media | box offsets |
| Bitrate (derived) | ≈ 2.66 Mbit/s (9,656,995-byte `mdat` ÷ 29.04 s) | arithmetic |

**Provenance — this file is stale, and here is the evidence.** `git log` for this exact path shows
its only commit is `1eb6884` (2026-07-08), *"Ship the promo as H.264 MP4 too (App Store Connect / iOS
format)"*, which added the file and touched nothing else but the README. The WebM was subsequently
rewritten by `7ba5373` (2026-07-28), *"Put the Vault in the promo…"*, which changed
`Silicon-TechTycoon-promo.webm`, `scripts/promo-video.mjs` and `scripts/stage-promo-video.mjs` — and
**did not touch the `.mp4`**. The MP4 therefore predates the Vault beat and every recorder fix made
with it. The repo is now at version **1.3.0** (`package.json`, and `MARKETING_VERSION = 1.3.0` in
`ios/App/App.xcodeproj/project.pbxproj`), so the committed MP4 is the cut from two releases ago. The
two files also differ measurably in duration (29.040 s vs 29.080 s) and frame count (726 vs 727),
which is consistent with them being different takes rather than transcodes of one another.

**What I could NOT determine about this file:** its picture content. With no H.264 decoder available
I cannot render a frame, so I cannot *visually* confirm the absence of the Vault beat. That claim
rests on the commit history above, which is strong provenance evidence but is not a frame-level
verification.

### Asset B — `app-store-video/Silicon-TechTycoon-promo.webm`

| Property | Measured value | How |
| --- | --- | --- |
| File size | 9,528,439 bytes (9.09 MiB) | `ls -l` |
| Container | **WebM** (EBML `DocType` = `webm`, DocTypeVersion 2) | EBML header |
| Video codec | **VP8** (`CodecID` = `V_VP8`) | `Tracks` → `TrackEntry` |
| Resolution | **1080 × 2340** (`PixelWidth` 1080, `PixelHeight` 2340; no `DisplayWidth`/`DisplayHeight` override present) | `Video` element |
| Aspect ratio | **19.5:9 portrait** (2.16667:1) | arithmetic |
| Duration | **29.080 s** (`Duration` 29080.0 at `TimestampScale` 1,000,000 ns = 1 ms) | `Info` element |
| Frame rate | **25.000 fps** — `DefaultDuration` 40,000,000 ns = 40 ms per frame; confirmed by counting 727 frames across 21 clusters ÷ 29.080 s = 25.000 | `TrackEntry` + block scan |
| Frame count | 727 blocks, 21 of them keyframes | full SimpleBlock scan |
| Audio track | **NONE.** `Tracks` contains exactly one `TrackEntry`, `TrackType` = 1 (video). No `A_*` codec, no `Audio` element. | `Tracks` element |
| Muxer | `Lavf61.1.100` (FFmpeg's libavformat) | `MuxingApp` / `WritingApp` |
| Bitrate (derived) | ≈ 2.62 Mbit/s | arithmetic |

**This is the current cut** (committed 2026-07-28, in the same commit as the Vault recorder changes)
and it is the one worth shipping — but WebM is not an accepted App Store Connect format, so it
cannot be uploaded as-is.

**What I could NOT determine about this file:** its picture content, for the same reason — the only
ffmpeg present can encode VP8 but I have no way to render a frame to an image I can inspect here.

### Source footage and the generation pipeline

There is **no separate source/master footage in the repo.** The two files above are the only video
assets, and the intermediate raw take (`/tmp/silicon-promo-vid/silicon-promo.webm`, 540 × 1170) is
written to `/tmp` and never committed. `app-store-video/` holds only these two files and a README.

The video *is* regenerable from the app itself, by a committed two-stage pipeline
(`npm run promo:video`, `package.json` scripts `promo:stage` + `promo:video`):

1. **`scripts/stage-promo-video.mjs`** builds a thriving save (hero device on the ready shelf, back
   catalogue tuned so the hero reads as a *hit*) and writes it to `/tmp/silicon-promo.json`. It ends
   with a HERO CHECK that recomputes the hero's effective score against the live hit bars and fails
   loudly if the verdict is not `hit`.
2. **`scripts/promo-video.mjs`** drives headless Chromium via `playwright-core` against a locally
   served build (`SHOTS_URL`, default `http://localhost:5200`), records **one continuous take** at
   the app's native 540 × 1170, then runs a single ffmpeg pass that both time-compresses to
   `PROMO_TARGET_SECS` (default 29) via `-itsscale` and upscales 2× to 1080 × 2340 with
   `scale=…:flags=lanczos`, encoding `-c:v libvpx -b:v 3M -crf 8`. It defensively clears all 13
   `pending*` interrupt fields and pushes `lastInterruptWeek` +500 so no decision card can hijack the
   take.

Two honest caveats about calling this "reproducible": the pipeline reliably regenerates *an
equivalent* promo from the live app, but it is a real-time screen recording, so successive runs are
not byte-identical (the committed WebM's 29.080 s vs the MP4's 29.040 s is exactly this). And the
pipeline **only ever emits WebM/VP8** — its hardcoded encoder (`FFMPEG`, default
`/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux`) has no H.264 encoder and no MP4 muxer, so there is no
path within this repo's tooling that produces an App Store-acceptable file. The MP4-producing step
has to happen on a machine with a full ffmpeg.

---

## 2. Apple's App Preview requirements

I have separated what I can state with confidence from what I cannot. **Do not treat any number
marked NEEDS OWNER VERIFICATION as authoritative** — check it against Apple's own "App preview
specifications" page in the App Store Connect Help before encoding the final master.

### Confident

- **An App Preview is OPTIONAL.** Screenshots are the required media for a version; previews are an
  optional addition. Omitting the preview does not block submission or review.
- **Accepted containers: `.mov`, `.m4v`, `.mp4`.** **WebM is not accepted** and App Store Connect
  will reject it at upload.
- **Duration: 15–30 seconds.** Both current assets (~29.0 s) sit inside this window.
- **Up to 3 previews** per localization per device family.
- **Content rule:** a preview must be captured from the app itself and show actual app usage. This
  promo is recorded from the live game, which satisfies that.
- **Audio is optional**, and previews autoplay **muted** on the product page, so the preview must
  read correctly with no sound. Both current assets have no audio track at all — that is acceptable,
  not a defect.

### NEEDS OWNER VERIFICATION — I will not state numbers I cannot support

- **Exact accepted pixel dimensions per device family.** Apple publishes a specific list of accepted
  preview resolutions per device size class (iPhone 6.9"/6.7"/6.5", iPad 13", etc.), and I cannot
  reproduce that table with certainty. Look it up before encoding. **The one thing I can state
  firmly from measurement: 1080 × 2340 is not the native resolution of any iPhone.** Modern 19.5:9
  iPhones are 1170 × 2532, 1179 × 2556, 1284 × 2778 and 1290 × 2796 — and 1080 × 2340 is not even
  exactly the same ratio as any of them (2.16667 vs 2.16410 / 2.16794 / 2.16355 / 2.16744). So the
  current master will need scaling, and a hair of padding or crop, to land on an accepted frame.
  Whatever accepted size the owner confirms is the number that goes into the command in §3.
- **Required/accepted frame rate.** Apple's guidance names a specific frame rate for previews (30 fps
  is the figure commonly cited) and I am not certain whether other rates are accepted. **Both current
  assets measure 25.000 fps**, which may or may not be acceptable — verify, and if 30 fps is
  required, add `-r 30` to the encode (see §3).
- **Codec/bitrate/audio codec specifics** beyond "H.264 in an MP4/MOV container works." Apple also
  accepts ProRes 422 masters, and specifies audio codec/channel/bitrate expectations for previews
  that have audio. Not applicable here (no audio), but verify if audio is ever added.

### Why the current assets are not submission-ready

| Asset | Blocking problem |
| --- | --- |
| `Silicon-TechTycoon-promo.webm` | Correct, current content — but **WebM is not an accepted container**. Cannot be uploaded. |
| `Silicon-TechTycoon-promo.mp4` | Correct container and codec (H.264 High L5.0 MP4, faststart) — but it is the **1.1.0-era cut**, two releases behind the 1.3.0 app, missing the Vault beat and the recorder fixes. Uploading it would ship the previous release's video. Its 1080 × 2340 frame is also very likely not an accepted preview size (see above). |

So there is **no uploadable, current preview in this repo today.**

---

## 3. The conversion — what could NOT be done here, and the exact command to run

**No conversion was performed in this environment, and none was faked.** The reason is measured, not
assumed: the only ffmpeg on this machine is Playwright's bundled build, whose `-encoders` output
contains exactly one video encoder (`libvpx`, VP8) and whose `-muxers` output contains no `mp4` and
no `mov`. Producing an H.264 MP4 here is impossible. No new `.mp4` has been written, and neither
existing asset has been modified.

### Owner instructions — run once, on any machine with a full ffmpeg

**Source preservation is non-negotiable: never overwrite `Silicon-TechTycoon-promo.webm`, and never
transcode in place.** The WebM is the only copy of the current cut in the repo; the raw 540 × 1170
take it came from lives in `/tmp` and is already gone. The output below is deliberately given a
different name so no command in this document can clobber a source.

Step 0 — confirm the target resolution first, from Apple's App Store Connect "App preview
specifications" page, for the device family you are uploading to (the screenshots in this repo are
1284 × 2778 for 6.7" iPhone and 2064 × 2752 for iPad, so the iPhone preview is the one to cut first).
Set it in the command as `TARGET_W`/`TARGET_H`.

```sh
cd app-store-video

TARGET_W=1290        # ← replace with an Apple-accepted preview width  (VERIFY FIRST)
TARGET_H=2796        # ← replace with an Apple-accepted preview height (VERIFY FIRST)

ffmpeg -i Silicon-TechTycoon-promo.webm \
  -vf "scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease:flags=lanczos,\
pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1" \
  -r 30 \
  -c:v libx264 -profile:v high -level:v 4.2 -preset slow -crf 18 \
  -pix_fmt yuv420p -movflags +faststart -an \
  Silicon-TechTycoon-promo-1.3.0.mp4
```

Notes on each choice, so it can be adjusted knowingly:

- `scale=…:force_original_aspect_ratio=decrease` + `pad` fits the 19.5:9 master inside the target
  frame and pads rather than crops, because the source ratio does not exactly match any iPhone frame.
  If you would rather crop than pad (no black slivers, loses a few pixels of edge), swap
  `decrease`→`increase` and replace the `pad` filter with `crop=${TARGET_W}:${TARGET_H}`.
- `-r 30` normalizes the 25 fps master to 30 fps. **Drop this flag if you verify 25 fps is
  accepted** — retiming 25→30 duplicates frames and can add faint judder to the pans.
- `-an` drops audio deliberately: there is no audio track in the source, and previews autoplay muted.
- `-movflags +faststart` puts the index first, matching the existing MP4's layout.
- `-profile:v high -level:v 4.2` is a conservative, widely compatible choice; the old MP4 was High
  L5.0. Either is fine for playback — this is not a device-decode-constrained delivery.
- Output name carries the version so a future stale-MP4 mixup is self-evident on sight.

Then, before uploading:

1. **Watch it through, end to end.** Sampled frames catch a blank or blocked beat; they do not catch
   pacing, a stuck animation, or a beat that lands wrong. This is the step that has failed before.
2. Confirm the Vault beat is present — that is the difference between the current cut and the stale
   one.
3. Verify the output measures as intended:
   ```sh
   ffprobe -v error -show_entries \
     format=format_name,duration,size:stream=codec_type,codec_name,profile,width,height,r_frame_rate,nb_frames \
     -of default=noprint_wrappers=1 Silicon-TechTycoon-promo-1.3.0.mp4
   ```
   Expect: `format_name` containing `mp4`; one stream only, `codec_type=video`, `codec_name=h264`;
   `width`/`height` equal to the verified target; `duration` ≈ 29.0 (inside 15–30); **no
   `codec_type=audio` stream**.
4. Upload to App Store Connect. If ASC rejects the file, the rejection message names the constraint —
   fix that specific one; do not re-encode blind.
5. Commit the new `-1.3.0.mp4` alongside the WebM. **Leave `Silicon-TechTycoon-promo.webm` in place**
   as the master. Consider deleting the stale `Silicon-TechTycoon-promo.mp4` in the same commit, or
   renaming it `Silicon-TechTycoon-promo-1.1.0-STALE.mp4`, so it can never be picked up by mistake.

### If the cut itself should be re-recorded first

If the 1.2.0-era cut is no longer representative of 1.3.0, regenerate before transcoding:

```sh
npm run build && npm run preview -- --port 5200 &
SHOTS_URL=http://localhost:5200 npm run promo:video
# → /tmp/silicon-promo-vid/Silicon-TechTycoon-promo.webm   (1080×2340, ~29s, VP8)
```

Copy that into `app-store-video/` (replacing the WebM master is fine — it is regenerable and is the
pipeline's own output), then run the transcode above. Watch the console for the HERO CHECK failure
and the lazy-chunk warning; both are described in `app-store-video/README.md`.

---

## 4. Bottom line

- **Does this block submission? No.** App Previews are optional; the screenshots in this repo are
  sufficient media for a version. Ship without a preview if the transcode cannot happen in time.
- **Is a preview ready today? No, and this document does not claim one is.** No Apple-compatible,
  current deliverable exists in the repo. The current cut is in an unacceptable container (WebM/VP8);
  the acceptable-container file is a stale cut from two releases ago and is very likely the wrong
  frame size as well.
- **What makes it ready:** verify the accepted resolution and frame rate against Apple's spec, run
  the §3 command on a machine with a full ffmpeg, watch the result through, verify it with the
  `ffprobe` line above, and upload. One sitting's work — but it needs a real ffmpeg and a pair of
  human eyes, neither of which exists in this environment.
