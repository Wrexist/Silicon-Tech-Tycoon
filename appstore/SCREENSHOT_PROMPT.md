# App Store Screenshot Generator — Prompt for Claude

Use this to turn raw app captures into finished, on-brand App Store marketing screenshots
(device frame + branded background + headline caption). Works whether you drop in your own
TestFlight captures **or** use the raw captures in `appstore/screenshots/raw/`.

> **Best source images:** capture on a real iPhone via TestFlight (the 3D HQ renders perfectly
> there). The files in `appstore/screenshots/raw/` are clean fallbacks generated headlessly.

---

## How to use

1. Drop your raw portrait screenshots into a chat with Claude (or point it at
   `appstore/screenshots/raw/`).
2. Paste the **PROMPT** block below.
3. Claude outputs finished `1290×2796` PNGs into `appstore/screenshots/final/` (and, if you
   ask, `1320×2868` for 6.9").

---

## PROMPT (paste this verbatim, with your images attached)

```
You are a senior App Store creative producer. Turn the attached raw iPhone screenshots of
"Silicon: Tech Tycoon" into finished App Store marketing screenshots. Produce one output per
input image.

BRAND (match exactly — it's a premium, restrained, dark management sim):
- Background: a subtle dark vertical gradient from #0f1115 to #161a22 (near-black, no busy
  patterns). Premium through restraint.
- Accent color: #3b82f6 (use ONLY for the headline keyword highlight or a thin underline —
  never flood it).
- Positive/success color (optional accents): #10b981.
- Typography: a clean geometric sans (e.g. SF Pro / Inter), tight tracking, bold headlines.
- Feel: Apple-store premium. Lots of negative space. One idea per screenshot.

CANVAS:
- 1290 × 2796 px (6.7" iPhone), portrait. (Also export 1320 × 2868 if I ask.)
- Safe margins: keep all text ≥ 96px from every edge.

LAYOUT (per screenshot):
- Top third: a punchy 2–5 word HEADLINE (white) with ONE keyword in the accent color.
  Optional one-line subhead in muted grey (#9aa3b2) beneath it.
- Below: the phone screenshot inside a clean modern iPhone frame (thin bezel, rounded
  corners, subtle drop shadow + soft floor reflection). Tilt 0° (straight) for the hero,
  no more than ±6° for others. The device may bleed slightly off the bottom edge.
- Do NOT cover the meaningful UI in the screenshot with the caption.
- No emoji, no clip art, no fake review stars, no Apple logos, no real-world brand/product
  names anywhere (IP rule).

CONSISTENCY:
- Same background, same headline position/size, same device frame across all images so the
  set reads as one cohesive carousel.

OUTPUT:
- Save each as appstore/screenshots/final/NN-name.png at 1290×2796.
- Use the headline + filename I provide for each image (mapping below). If I didn't map an
  image, infer the single clearest selling point from what's on screen and caption it in the
  same voice.

HEADLINE MAP (raw file -> headline / keyword in accent / filename):
- 02-design        -> "Design every DETAIL"        -> 01-design.png
- 03-market        -> "Race six rivals to #1"      (accent: "#1")  -> 02-market.png
- 01-hq            -> "Garage to GLOBAL empire"    (accent: "GLOBAL") -> 03-hq.png
- 04-research      -> "Research the next ERA"       -> 04-research.png
- 06-performance   -> "Know WHY you won"            -> 05-performance.png

Render all of them now.
```

---

## Recommended final set & order (what App Store search shows first)

| # | Source (raw) | Headline | Why it sells |
|---|---|---|---|
| 1 | `02-design.png` | **Design every detail** | The hook — "you design the product," the core fantasy |
| 2 | `03-market.png` | **Race six rivals to #1** | Competition + goal; the leaderboard reads instantly |
| 3 | `01-hq.png` | **Garage to global empire** | The signature 3D HQ — unique, premium visual |
| 4 | `04-research.png` | **Research the next era** | Depth/progression signal |
| 5 | `06-performance.png` | **Know why you won** | "Readable simulation" differentiator |

Alternates available in `raw/`: `03b-market-top.png` (net-worth banner), `05-company.png` (team roster).

---

## Caption voice (keep it tight, premium, benefit-first)

- 2–5 words, one accent keyword, active verbs: *Design. Time. Build. Race. Run.*
- Avoid feature-listing in the headline; let the screenshot carry detail.
- Optional subheads (muted): "Pick the chip, the screen, the camera." / "Time your launch to
  the week." / "Six rivals. One #1 spot." / "Six disciplines. Every era." / "Every launch
  tells you why."

---

## Notes

- App Store Connect only **requires** the 6.7" set; it auto-scales to smaller sizes. Add the
  6.9" (1320×2868) set only if you want pixel-perfect on the newest Pro Max.
- Keep the carousel to **5 images** (Apple shows up to 10, but 5 strong beats 10 noisy).
- If a raw screenshot shows a transient toast or odd state, recapture it — don't ship UI
  chrome that looks like an error.
