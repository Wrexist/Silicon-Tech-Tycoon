# marketing/video/ — TikTok / Reels / Shorts B-roll

Five ready-to-post vertical clips (**1080×1920, 30fps**), rendered from **real in-game footage**
with smooth Ken-Burns motion, clean crossfades and a logo + App Store end card. They are
deliberately **text-light** so you can **talk over them** or drop your own captions on top — the
cut *is* the story; you supply the voice.

| File | Length | Vibe | Viral hook to say / caption over it |
|------|--------|------|--------------------------------------|
| `silicon-make-launch-win` | ~11s | Design → factory → #1, the full arc | "POV: you run a phone company. Design it → build the line → pass every rival." |
| `silicon-climb` | ~9s | Slow push into the live leaderboard | "Watching myself climb from #13 to #1 is *so* satisfying." |
| `silicon-factory` | ~9s | Pan across the running 3D factory | "This tycoon game has a **real 3D factory** you build yourself." |
| `silicon-empire` | ~9s | Push into the living 3D HQ + team | "From a one-room garage to a global HQ — the glow-up." |
| `silicon-awards` | ~9s | The awards clean-sweep, gold grade | "I swept the tech awards — Device, Design **and** Value of the Year." |

Full shot lists and more hook variants are in **`../VIDEO_SCRIPTS.md`**.

## How to use

1. Drop a clip into **CapCut / Premiere / DaVinci Resolve / InShot** as your base track.
2. Record your **voiceover** (or add trending audio) and burn **captions** — keep them in the safe
   zone (top/bottom ~250px) so the platform UI doesn't cover them.
3. Hook in the first 1.5s: pair the clip's opening motion with the line above.
4. Export vertical and post. The end card already has the App Store CTA.

## Format note (important)

These are **VP8 `.webm`** — that's the only codec this build environment can encode. Every desktop
editor above imports webm directly and exports MP4 for you. If you need an **MP4 (H.264)** first
(e.g. to upload raw to TikTok or iPhone Photos), convert with one command:

```sh
ffmpeg -i silicon-climb-1080x1920.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart silicon-climb.mp4
```

(or drop the webm into any free online converter). Re-render from source any time with
`node scripts/render-video.mjs` — tweak the scenarios/motion at the top of that script or in
`animation.html`.
