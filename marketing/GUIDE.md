# Silicon: Tech Tycoon — Marketing Asset Kit & Ad Playbook

Ad creatives built from **real in-game screenshots** — the Design Lab, the 3D factory floor, the
live industry leaderboard, your 3D HQ, the Silicon Awards — each composited full-bleed under the
**game logo**, a feature headline and a call to action, sized for every channel. Plus the tool to
regenerate or restyle any of it.

> **IP rule (from `STORE_LISTING.md`):** everything here is fictional. No real brand, company, or
> product names. Keep it that way if you edit copy.

---

## 1. What's in this kit

```
marketing/
├── asset-studio.html      ← open in a browser: preview every creative, switch CTA/logo, edit label
├── GUIDE.md               ← this file
├── VIDEO_SCRIPTS.md       ← shot-by-shot Reels/TikTok/App-Preview gameplay cuts
└── assets/
    ├── icon-1024x1024.png            ← App Store / Play icon (exactly 1024²)
    ├── design-square … factory-square … market-square … office-square      ┐ IG/FB feed (1080²)
    ├── design-portrait … factory-portrait                                  ┘ IG portrait (1080×1350)
    ├── design-story … factory-story … market-story … office-story …        ┐ Stories / Reels /
    ├── research-story … awards-story                                        ┘ TikTok (1080×1920)
    ├── market-banner-1200x628 … design-header-1500x500                      ┐ Landscape banners
    ├── design-landscape-1920x1080 … market-landscape-1920x1080              ┘ + 16:9 (YouTube/display)
    ├── hq-ipad-portrait-2048x2732 … design-ipad-portrait-2048x2732          ┐ iPad — App Store 13"
    ├── market-ipad-landscape-2732x2048                                      ┘ + iPad landscape showcase
    ├── badges/                       ← Apple "Download on the App Store" badge (black + white SVG)
    └── _device/                      ← device-only crops of the screenshots (hero source images)
```

Most PNGs are exported at **2× the labelled size** (retina-sharp). Exact-size exports (no upscale):
the **icon** (1024²) and the **iPad App Store** frames (2048×2732 / 2732×2048), because the stores
require precise dimensions. The device, logo lockup, palette and glass all track the game's own
design tokens (`src/design/tokens.css`), so the ads and the app read as one brand.

**Call to action.** Every creative ships with the real **Apple “Download on the App Store” badge**
(`assets/badges/`). In the studio you can switch the CTA to a "Download now" accent pill instead
(e.g. for pre-launch teasers or Android). The badge is the sanctioned developer artwork for
promoting your own app — for pixel-exact brand compliance you can also drop in the official badge
from Apple's *Marketing Guidelines*.

**Each feature has its own accent** pulled from the app's function colours — Design = green,
Factory = amber, Market = blue, HQ = violet, Awards = gold — so the campaign is varied but coherent.

---

## 2. The Asset Studio & regenerating

Open **`marketing/asset-studio.html`** in a browser (works offline) to preview the full set and
tweak the **call-to-action** text and **logo label** live.

The exported PNGs are produced by a two-step, reproducible pipeline (Chromium is pre-installed; for
a normal checkout run `npm i -D playwright && npx playwright install chromium` once):

```sh
# 1. crop the finished App Store screenshots down to the device (hero images)
node scripts/crop-device-shots.mjs

# 2. composite each device shot with the logo + feature headline + CTA, at every size
node scripts/export-marketing.mjs
```

Step 1 only needs re-running if you regenerate the underlying screenshots in
`app-store-screenshots/` (see `app-store-screenshots/store/README.md`). To change a headline,
accent, or which screenshot a format uses, edit the `FEATURES` / `FORMATS` / `ASSETS` config at the
top of `asset-studio.html`, then re-run step 2.

---

## 3. Channel spec — which file goes where

| File pattern | Pixels (PNG is 2×) | Use it for |
|--------------|--------------------|------------|
| `icon` | 1024 × 1024 | App Store & Google Play **app icon** (stores mask the corners — don't pre-round). |
| `*-square` | 1080 × 1080 | Instagram/Facebook **feed post & square ad** — the safe default everywhere. |
| `*-portrait` | 1080 × 1350 | Instagram **portrait feed** — tallest allowed in-feed, best organic reach. |
| `*-story` | 1080 × 1920 | Instagram/Facebook **Story & Reel**, **TikTok**, YouTube **Shorts**. |
| `*-banner` | 1200 × 628 | Meta/Google **display & link ads**; also your website/OG share image. |
| `*-header` | 1500 × 500 | **X**, LinkedIn, YouTube channel banner. |
| `*-landscape` | 1920 × 1080 | **YouTube** ads, App Preview poster frame, 16:9 display. |
| `*-ipad-portrait` | 2048 × 2732 | **App Store iPad 13"** screenshot slot (real iPad capture). |
| `*-ipad-landscape` | 2732 × 2048 | iPad landscape showcase — App Store landscape slot / site hero. |

Feature angle by screenshot: **design** = "Design every detail", **factory** = "Build the line",
**market** = "Race rivals to #1", **office** = "Garage to global empire", **research** = "Own the
frontier", **awards** = "Win the industry".

---

## 4. App Store Connect — listing & product pages

**Icon.** Upload `assets/icon-1024x1024.png` (no alpha, no rounding — already correct).

**Screenshots.** Your primary set is the live-engine captures in `app-store-screenshots/` — keep
those. The kit's feature posters are for **social/paid**, and any `*-portrait` (1080×1350) can also
seed a **Custom Product Page** variant to A/B a different hook.

Screenshot upload order for the 6.7" set (shown left→right in search):
1. Design every detail 2. Time the market 3. Race rivals to #1 4. Garage to global empire 5. Own the frontier

**Custom Product Pages (free A/B lever).** In App Store Connect → *Custom Product Pages*, make 2–3
variants leading with different feature angles, and point each Apple Search Ads campaign at the
matching page to compare tap-through.

**iPad.** Your primary iPad App Store screenshots are `*-ipad-portrait` (2048×2732, real iPad
captures). The `*-ipad-landscape` showcase suits the App Store's landscape slot or a website hero.
These are exported at exact size (no upscale) so they upload without resampling.

**Store badge.** The creatives carry the real Apple badge (`assets/badges/`). For pixel-exact brand
compliance on the listing itself you can also use the official artwork from Apple's *Marketing
Guidelines* (developer.apple.com → App Store marketing).

---

## 5. Instagram & Facebook (Meta Ads Manager)

1. **Meta/Business account** → *Ads Manager* → Create.
2. **Objective:** *App promotion* (App installs). Connect the app (must be live or in a test track).
   Pre-launch, run *Traffic* → App Store URL to warm an audience.
3. **Placements:** *Advantage+ placements* — you have every size it needs:
   - Feed → `*-square` (1080²) or `*-portrait` (1080×1350)
   - Stories/Reels → `*-story` (1080×1920)
   - Right column / Search → `*-banner` (1200×628)
4. **Creative:** upload 3–5 different **features** as separate ads (Design, Factory, Market, HQ) and
   let Meta find the winner. Real-gameplay creatives out-convert mockups — that's the whole point of
   this kit.
5. **Budget:** start **$15–30/day per ad set**, 3–4 day learning window. Kill creatives under ~0.8%
   CTR; scale the winners.
6. **Audience:** interest-based — *mobile games, simulation games, tycoon/management games, business
   simulation*. Add a lookalike once installs come in.

**Safe area for Stories/Reels:** keep the top ~250px and bottom ~250px clear of critical text — the
`*-story` creatives park the logo and CTA inside the safe zone, but the platform UI (profile, CTA
sticker) overlaps the extreme edges.

---

## 6. TikTok, Reels & Shorts

The `*-story` creatives are the **hook frame and closing CTA card**; sandwich 6–15s of real
gameplay between them. Full shot-by-shot cuts (15s hero, factory, progression, rival-tension) plus
the App Store App Preview spec are in **`marketing/VIDEO_SCRIPTS.md`** — ready to record against.

---

## 7. Apple Search Ads

The fastest paid channel for a paid app.

- **Search Match on**, plus exact-match on the keywords in `STORE_LISTING.md`
  (`simulation, tycoon, business game, startup, management, idle empire`).
- Point each campaign at the **Custom Product Page** whose angle matches the keyword theme
  (e.g. the "Race rivals to #1" page for competitive terms).
- Start **$10–20/day**, bid near Apple's suggestion, prune high-spend/no-install terms after ~1 week.

---

## 8. Copy bank

**Feature headlines** (already wired per screenshot; the emphasised word takes the accent):

- Design every **detail.** · Build the **line.** · Race rivals to **#1.**
- Garage to **global empire.** · Own the **frontier.** · Win the **industry.**

**Support lines** used in the creatives:

- Chip, screen, camera, finish — you choose it all.
- Lay conveyors and run a real 3D production floor.
- Read the market, time your launch, climb the board.
- Grow a living 3D HQ, desk by desk.

**Short ad primary text (Meta)**

- Design the chip, the screen, the whole device — then launch it into a living market and race six
  rivals to #1. Premium. Offline. No ads.
- Most tycoon games hand you a factory. Silicon hands you the drawing board: pick every part, read
  the market, time your launch. Build the empire.

**Long description** — see `STORE_LISTING.md` (paste verbatim into App Store Connect).

---

## 9. Pre-flight checklist before you spend a dollar

- [ ] App icon uploaded (1024², no alpha) and matches the ad creatives' mark.
- [ ] App Store screenshots uploaded in order; a `*-portrait` added as a Custom Product Page variant.
- [ ] Privacy Policy + Support URLs live (App Store rejects without them — see `STORE_LISTING.md`).
- [ ] Meta pixel/SDK or Apple attribution set up so you *measure* installs, not just clicks.
- [ ] 3+ feature creatives per channel queued for A/B.
- [ ] Official Apple badge swapped in anywhere a store badge is shown.
- [ ] Budgets capped for the first learning week; a kill rule written down before launch.
