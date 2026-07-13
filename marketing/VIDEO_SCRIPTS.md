# Silicon: Tech Tycoon — Reels / TikTok / App Preview video scripts

Short, shot-by-shot gameplay cuts for vertical video (1080×1920). All are built from **real
screen recordings** of the game, book-ended by the still creatives in `marketing/assets/` so the
open and close are on-brand.

> **Already rendered:** five clean, motion-graphic B-roll clips are in **`marketing/video/`** (real
> footage, Ken-Burns motion, logo + App Store end card, text-light so you can voice over them). See
> `marketing/video/README.md` for the viral hook per clip and how to convert webm→mp4. Re-render or
> restyle with `node scripts/render-video.mjs`. The scripts below are for fuller edits where you cut
> your own live capture between the stills.

**How to capture gameplay:** on device, iOS Screen Recording (Control Centre) at the highest
resolution; or in the browser build, record the phone-framed viewport. Aim for 60fps, then trim.
Keep the phone in **dark theme** (matches every still in this kit).

**Universal rules**
- **First 1.5s is the whole ad.** Open on motion + a bold claim, never a logo card.
- **On-screen captions always** — 85% of feed video is watched muted. Keep them in the safe zone
  (top/bottom ~250px clear of platform UI).
- **End on the Apple badge + one line.** Use `assets/*-story` frames as the end card.
- Music: licensed upbeat electronic; hits on each cut. No VO required.

Legend: **[SHOT]** = what to record · **CAPTION** = on-screen text · timing in seconds.

---

## Script A — "Design → Launch → #1" (15s, the hero cut)

The core fantasy in one breath: you make a device, you ship it, you pass a rival.

| Time | SHOT (screen-record) | CAPTION | 
|------|----------------------|---------|
| 0.0–2.0 | Design Lab: tap through **chip → screen → camera**, the device render updates live; Fit score ticks up to the high 80s. | **You design the product.** |
| 2.0–4.0 | Colour/finish swap on the device render; the "Striking — lifts demand" chip appears. | Every part. Every detail. |
| 4.0–6.0 | Tap **Next → Launch**; the launch pane slides in, price slider moves, margin updates. | Time the market. |
| 6.0–8.5 | Launch reveal animation → first-week sales counter spinning up, "+$1.2M" pop. | Ship it. |
| 8.5–11.0 | Cut to **Market → leaderboard**; your row animates **past a rival** into #2, valuation climbing. | Race six rivals… |
| 11.0–13.0 | Hold on the leaderboard, your row highlighted, "**$446M to overtake Pomelo for #1**". | …to **#1.** |
| 13.0–15.0 | End card: `assets/market-story` still (or freeze the leaderboard) + Apple badge. | **Silicon: Tech Tycoon** · App Store |

**Hook variants to A/B (swap the 0–2s caption):** "POV: you run a phone company" · "I designed
a phone and sold 4 million" · "This game lets you design the whole phone."

---

## Script B — "Build the line" (12s, the factory flex)

Leads with the 3D factory — the most "wait, what is this?" visual.

| Time | SHOT | CAPTION |
|------|------|---------|
| 0.0–2.0 | Factory: camera orbiting the running 3D line, conveyors moving, robot arms working. | Build a real 3D factory. |
| 2.0–4.5 | Tap **Build**, drag a conveyor, drop a machine; the "**Line builds 45% faster**" chip flashes. | Lay every conveyor. |
| 4.5–7.0 | A **side-order** card: "Aurora Air · 3,414 units"; tap it, progress bar starts. | Take the contract. |
| 7.0–9.5 | Fast-forward: crates output at the end of the line, "**+$301.92K/wk**" ticks. | Bank the fee. |
| 9.5–12.0 | Pull back to the full packed floor + Apple badge end card (`assets/factory-story`). | **Build the line.** · App Store |

---

## Script C — "Garage to empire" (10s, the progression cut)

Best for retargeting — shows depth and the living 3D office.

| Time | SHOT | CAPTION |
|------|------|---------|
| 0.0–2.5 | Early game: tiny one-room office, one avatar at a desk. | Start in a garage. |
| 2.5–5.0 | Hard cut to the **Campus-tier 3D HQ** orbiting — full team of avatars, lounge, greenery. | Grow a living HQ. |
| 5.0–7.5 | Quick montage: hire a candidate → research ring completes → awards "clean sweep" flashes. | Hire. Research. Win. |
| 7.5–10.0 | End on the leaderboard #1 spot or the IPO win screen + Apple badge (`assets/office-story`). | **Garage to global empire.** · App Store |

---

## Script D — "Answer every rival" (8s, the tension cut)

Punchy, conflict-driven — strong for cold TikTok.

| Time | SHOT | CAPTION |
|------|------|---------|
| 0.0–2.0 | A **Rival Strike** interrupt fires: "Meridian launched into your category." | A rival just struck. |
| 2.0–4.5 | The duel screen — your device vs theirs, stats compared; tap **Counter-campaign**. | Cut price. Counter. Or hold. |
| 4.5–6.5 | Outcome card: your device holds #1 in the category, fans up. | Answer every move. |
| 6.5–8.0 | Apple badge end card (`assets/awards-story` or `market-story`). | **Silicon: Tech Tycoon** · App Store |

---

## App Store App Preview (per Apple spec)

- 15–30s, **portrait 1080×1920** (or 886×1920 for the 6.7" slot Apple accepts), H.264/HEVC, 30fps.
- Apple **auto-mutes** and shows it in the screenshot carousel — Script A or C work as-is; make sure
  the value is legible **without audio** (captions do that here).
- Apple requires footage to be **majority real app capture** — these scripts already are.
- Export one, upload in App Store Connect → the video sits before screenshot #1.

## Production checklist

- [ ] Recorded in dark theme, highest resolution, 60fps → trimmed to the beats above.
- [ ] Captions burned in, inside the safe zone, legible muted.
- [ ] Opens on motion in <1.5s; no intro logo card.
- [ ] Ends on the Apple badge + one line (use the matching `assets/*-story` frame).
- [ ] 3 hook variants cut for A/B (see Script A).
- [ ] Exported vertical (Reels/TikTok/Shorts) and, if used, a 1:1 crop for feed autoplay.
