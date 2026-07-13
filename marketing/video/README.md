# marketing/video/ — TikTok / Reels / Shorts B-roll

Five ready-to-post vertical **MP4** clips (**1080×1920, 30fps, H.264**), rendered from **real
in-game footage** with smooth Ken-Burns motion, clean crossfades and a logo + App Store end card.
They are
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

## Format

**H.264 `.mp4`** (High profile, yuv420p, `+faststart`) — upload straight to TikTok, Reels, Shorts,
or import into any editor / iPhone Photos. 1080×1920, 30fps.

Re-render or restyle any time with `node scripts/render-video.mjs` — it emits MP4 when an
H.264-capable ffmpeg is on the machine (a system `ffmpeg`, `$FFMPEG`, or
`npm i -D @ffmpeg-installer/ffmpeg`), and falls back to `.webm` otherwise. Tweak the scenarios,
Ken-Burns motion and end card at the top of that script or in `animation.html`.
