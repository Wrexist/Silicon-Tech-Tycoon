# Release-Candidate Readiness — store metadata & screenshots

Companion to **`PRIVACY_DISCLOSURE_INPUTS.md`** (privacy/manifest side). This document covers
App Store Connect **metadata readiness** and the **screenshot capture plan**.

Statuses: **VERIFIED** (repo content exists and is quoted) · **NEEDS OWNER** (a decision or an
account-side action only the owner can make) · **MISSING** · **BLOCKED**.

No marketing copy was invented here. Every "exists" row quotes the file it came from.

---

## 1. Terms / EULA link — Guideline 3.1.2

**Status: VERIFIED — RESOLVED. Not a blocker.**

`LAUNCH_CHECKLIST.md` Phase 0 warned that the paywall's Terms link would 404 "until the merge
lands." That merge has landed, and the live pages were fetched during this audit:

| URL | HTTP |
|---|---|
| `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/` | **200** |
| `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/` | **200** |
| `https://wrexist.github.io/Silicon-Tech-Tycoon/support/` | **200** |
| `https://wrexist.github.io/Silicon-Tech-Tycoon/` | **200** |

Evidence chain:

- **Page exists in the repo** — `docs/terms/index.html`, 131 lines, with real sections:
  *The short version · Licence · **Silicon Pro — subscription terms** · If you bought Silicon before
  it became free · Your game data · Acceptable use · Disclaimer and liability · Changes to these
  terms · Apple's standard licence · Contact*.
- **Page is on the branch Pages serves** — `git cat-file -e origin/main:docs/terms/index.html`
  succeeds. `docs/.nojekyll` present.
- **The paywall links to it** — `src/components/Paywall.tsx:47`
  `const TERMS_URL = "https://wrexist.github.io/Silicon-Tech-Tycoon/terms/";`
  rendered further down as a real anchor
  (`<a className="pwl__legal-link" href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms of Use</a>`),
  with the Privacy Policy anchor beside it.
- **The description text carries the link too** — the automated 3.1.2 check reads the description,
  not the paywall. `appstore/APP_STORE_METADATA.md` §4 ends with the required two lines, and
  `appstore/localizations/validate.mjs` fails any locale that loses them.

**NEEDS OWNER:** the description block currently points EULA at Apple's standard EULA URL while the
paywall points at the project's own `/terms/` page. Both satisfy 3.1.2. `SUBSCRIPTION_GUIDE.md:264`
notes an intent to move all 39 descriptions to `…/Silicon-Tech-Tycoon/terms/` — confirm which one
you want to ship, then make the 39 localized descriptions agree with the paywall.

---

## 2. Metadata readiness — field by field

| Field | Status | Value in repo (quoted) | Source |
|---|---|---|---|
| **App name** | VERIFIED | `Silicon: Tech Tycoon` (20/30) | `APP_STORE_METADATA.md` §1 |
| **Subtitle** | VERIFIED | `Design, sell, run your empire` (29/30) | §1 |
| **Promotional text** | VERIFIED ⚠ conflict | §2: *"The biggest update yet: build a 3D factory line, turn a rival into your nemesis, take your company public, and expand worldwide. Design devices down to the chip."* (159/170) | `APP_STORE_METADATA.md` §2 |
| ↳ *conflicting value* | **NEEDS OWNER** | `STORE_LISTING.md` carries a **different** promo text: *"The premium tech-company sim — design devices, time the market, grow from garage to empire."* (90) — and it still says "premium", which contradicts the free-to-download model | `STORE_LISTING.md` §Identity |
| **Description** | VERIFIED | Full ~3,600-char body, ends with the mandatory Terms + Privacy lines | §4; canonical copy in `appstore/localizations/en-US/description.txt` |
| **Keywords** | VERIFIED ⚠ conflict | §3: `business,simulation,management,idle,factory,empire,startup,strategy,mogul,magnate,builder,ceo,gadget` (100/100) | `APP_STORE_METADATA.md` §3 |
| ↳ *conflicting value* | **NEEDS OWNER** | `STORE_LISTING.md` has a **different** 94-char string: `business,simulation,management,idle,startup,manager,phone,gadget,empire,strategy,money,builder` | `STORE_LISTING.md` §Keywords |
| **What's New** | VERIFIED | v1.3.0 notes present; canonical copy in `appstore/localizations/en-US/release_notes.txt` | §5 |
| **Support URL** | VERIFIED | `https://wrexist.github.io/Silicon-Tech-Tycoon/support/` — live, 200 | §10 (corrected this pass) |
| **Privacy Policy URL** | VERIFIED | `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/` — live, 200 | §10 (corrected this pass) |
| **Marketing URL** | VERIFIED | `https://wrexist.github.io/Silicon-Tech-Tycoon/` — live, 200 | §10 |
| **Age rating** | VERIFIED | All content questions **None** → **4+**; Simulated Gambling **None**; Contains Ads **No** | §7 |
| **Category** | VERIFIED | Primary **Games → Simulation**, Secondary **Games → Strategy** | §1, §11b |
| ↳ *conflicting value* | **NEEDS OWNER** | `STORE_LISTING.md` lists only "Primary: Games / Subcategory 1: Simulation" — no secondary | `STORE_LISTING.md` §Category |
| **Pricing** | VERIFIED | Base price **Free**, all countries, Small Business Program **Enroll** | §6 |
| **Silicon Pro — display names** | VERIFIED | `Silicon Pro Yearly` · `Silicon Pro Monthly` · `Silicon Pro Lifetime`; group display name `Silicon Pro` | `appstore/SUBSCRIPTION_GUIDE.md:172,192,202,239` |
| **Silicon Pro — descriptions** | VERIFIED | Yearly/Monthly: *"Unlock the Platform and AI eras, every scenario, New Game+, Ascension, Creative Mode, the Vault and the Museum. Renews yearly/monthly."* Lifetime: *"Everything in Silicon Pro, permanently. A one-time purchase — it never renews."* | `SUBSCRIPTION_GUIDE.md:193,203,240` |
| **Silicon Pro — pricing** | VERIFIED | `pro.yearly` $19.99/yr · `pro.monthly` $3.99/mo · both 7-day trial · `pro.lifetime` $29.99 non-consumable, Family Sharing on · legacy `sandbox` $2.99 kept live, not offered | §6 |
| **App Review notes** | VERIFIED | Full paste-ready block incl. IAP walkthrough and "no account required" | §9 |
| **Localizations** | VERIFIED | 39 ASC locales in `appstore/localizations/`, validated by `validate.mjs --all` | §11b item 8 |
| **App preview video** | **BLOCKED (owner action)** | `app-store-video/` ships the 1.2.0 cut as **WebM only**; the committed `.mp4` is still the **1.1.0** cut. ASC accepts `.mov`/`.m4v`/`.mp4`, **not WebM** — a transcode is required, then a watch-through | §12 checklist |
| **Build/version numbers** | **NEEDS OWNER** | `package.json` version `1.3.0`. `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` must be bumped and the build number strictly higher than the last uploaded on this train | §12 checklist |

**Recommended resolution for the three conflicts:** treat `appstore/localizations/` as canonical
(the §12 checklist already says "paste from there, not from this file"), `APP_STORE_METADATA.md` as
the working doc, and **`STORE_LISTING.md` as superseded**. It carries an older, pre-free-to-play
promo line and a different keyword string; shipping from it would reintroduce "premium" language the
1.3.0 release deliberately removed. Owner should either delete it or mark it historical.

---

## 3. Screenshot tooling — what already exists

**Committed artifacts**

| Set | Count | Dimensions | Verdict |
|---|---|---|---|
| `app-store-screenshots/store/` | 10 (`01-vault` … `10-premium`) | **1284 × 2778** (measured on all ten) | The submission set, already in upload order |
| `app-store-screenshots/ipad/` | 10 | 2064 × 2752 | ⚠️ **CORRECTED 2026-08-31** — the project ships **universal** (`TARGETED_DEVICE_FAMILY = "1,2"`, `project.pbxproj:341,363`), so App Store Connect **DOES** require an iPad set. These frames are also captured at a 540×720 viewport and scaled full-bleed, which is not how the app renders on iPad (a centered 540px column). See `DEVICE_SUPPORT_DECISION.md` |
| `app-store-screenshots/6.7/` | 5 | 1284 × 2778 | Superseded legacy hero set (`scripts/shots.mjs`) |

**⚠ Size-label discrepancy (flag, not fixed — owner decision).**
`app-store-screenshots/README.md` calls `store/` *"iPhone 6.7" (1284 × 2778) … the required 6.7"
slot"*, while `APP_STORE_METADATA.md` §11 calls the same files *"Apple's **6.5"** display class — not
6.7", which is what this doc used to call it."* **The two repo docs contradict each other about the
same ten files.** The measured fact is 1284 × 2778; that exact resolution appears in Apple's spec
table under more than one display class, which is why both labels look defensible. The actionable
point is unaffected by the label: re-rendering at **1290 × 2796** yields a source that serves the
largest current iPhone classes and lets ASC scale *down* to everything else rather than up-rez a
smaller source. That is a **one-line change** — `SIZE` at `scripts/shots-refresh.mjs:18`
(`const SIZE = { w: 1284, h: 2778 };`). Confirm the required slot in the live ASC UI before
re-rendering; do not take either repo doc's label as authoritative.

**Pipeline (iPhone — self-contained, no preview server)**

```bash
npm run build                    # dist/ must be current — the shooter serves it in-process
npm run shots:stage:showcase     # lavish Campus save + overlay payloads → /tmp/silicon-showcase*.json
npm run shots:store              # → .newfeat-shots/store/   (scripts/shots-refresh.mjs)
rm -f app-store-screenshots/store/*.png
cp .newfeat-shots/store/*.png app-store-screenshots/store/
```

- `SHOTS_ONLY="vault,factory"` re-captures only those frames; the rest keep their existing raws in
  `.newfeat-shots/store-raw/`. Use it while iterating on one frame.
- Chromium via `playwright-core`; auto-detected at `/opt/pw-browsers/chromium-*/chrome-linux/chrome`,
  or override with `SHOTS_CHROME` / `SHOTS_URL`.
- The showcase save decorates the factory, leaves one build on the line so the conveyor animates,
  and leaves the Vault mid-hunt (3 open, several rumoured, rest sealed) so frame 01 shows all four
  card states at once.

**Two staging mechanisms exist in `scripts/shots-refresh.mjs`:**
1. **`mut:`** — mutate the staged save before load. Used to force interrupt overlays, e.g.
   `s.pendingAwards = overlays.awards` (awards frame), `s.pendingStrike = overlays.strike` (strike).
2. **`shoot:`** — drive the page with Playwright: `tab(p,"Design")`, `subtab(p,"Style")`,
   `openVault(p)`, `openFactory(p)`, `dismissLaunch(p)`, scroll-into-view + settle waits.

**Other shooters:** `shoot-vault`, `shoot-nemesis`, `shoot-eureka`, `shoot-community`,
`shoot-regional`, `shoot-staffmoment`, `shoot-office-factory`, `shoot-glass-popups`,
`shoot-paywall-for-asc` (ASC review-notes evidence), `shots-hero`, `shots-diff` (before/after
compare), `audit-screens` (broad screen sweep — the only script that already touches **Museum**).

---

## 4. Capture plan

Apple requires **one iPhone set**; everything else is scaled by ASC. Render the master set once at
the largest confirmed slot, then let ASC downscale. iPad is **not required** for this app.

### 4a. Ship-as-is set (already captured — re-render only if `SIZE` changes)

| # | Device size | Screen | Game state needed | How to stage it | Visual goal | Caption (burned on frame) |
|---|---|---|---|---|---|---|
| 01 | iPhone master | **The Vault** — redacted dossier board | Vault mid-hunt: 3 open, several rumoured, rest sealed | `shots:stage:showcase` + `openVault(p)` | Four card states visible at once; reads as a *promise*, not a readout | **"Eighteen files you were never told about"** |
| 02 | iPhone master | **Factory Mode** — 3D line | Upgraded machines, decor props, painted walls, one build on the line so the conveyor animates | showcase save + `openFactory(p)` | Motion + density; the "you built this" shot | **"Build the line"** |
| 03 | iPhone master | **Design Lab** — live 3D device | All components pushed to top tier, Style subtab, back view | `shoot:` loop clicks every `button[aria-label="Higher tier"]` ×5, then `subtab("Style")` + "View back" | Hero product render, the core fantasy | **"Design every detail"** |
| 04 | iPhone master | **Market** — industry leaderboard | Late-game standings, player climbing | `tab("Market")`, scroll `.mkt__board` into centre | Named rivals, a ladder to climb | **"Race rivals to #1"** |
| 05 | iPhone master | **HQ 3D office** | Campus-era office, furnished, populated | `tab("Office")` + 2.6s settle for the 3D scene | Warm, alive, characterful | **"Garage to global empire"** |
| 06 | iPhone master | **Silicon Awards** ceremony | Awards overlay open | `mut:` → `s.pendingAwards = overlays.awards`, 1.6s settle | Ceremony glamour; aspiration | **"Win the industry"** |
| 07 | iPhone master | **Rival Strike** duel | Strike overlay + a rival release in state | `mut:` → `s.pendingStrike` + push `overlays.rivalRelease` | Conflict, a decision to make | **"Answer every rival"** |
| 08 | iPhone master | **Research** ring + queue | Active project mid-progress, queue populated | `tab("Research")`, scroll `.rd__active` into centre | Progression systems on display | **"Research on your terms"** |
| 09 | iPhone master | **Market → Demand** regions | Several regions licensed, standings visible | `tab("Market")` + `subtab("Demand")`, scroll `.mkt__region-list` | Scale; a world map of ambition | **"Take it global"** |
| 10 | iPhone master | **HQ 3D office** (reuse) | Same as 05 | `tab("Office")` + 2.4s settle | Closing value statement | **"Free to play. No dark patterns."** |

> **Frame 10 is the compliance-critical one.** It is the only frame making a commercial claim, and it
> already caused a **Guideline 2.3.7** rejection in 1.3.1 when it still showed the paid era's
> "$8.99 once." **Never put a price in a screenshot** — screenshots cannot know the localized price
> StoreKit charges. Describe the model only. This rule is in-line in `scripts/shots-refresh.mjs`
> above the `premium` frame; keep it there.

### 4b. Candidate upgrades — moments the current set does **not** capture

The brief named three moments worth considering. Here is their true staging status:

| Candidate | Tooling status | What staging would take | Why it might earn a slot |
|---|---|---|---|
| **Launch reveal** | **No shooter captures it.** Every existing script *dismisses* it (`dismissLaunch(p)`). It is **emitter-driven**, not a state field — `src/design/launchReveal.ts`, via `buildLaunchReveal`/`emitLaunchReveal` (`src/state/useLaunchProduct.ts:10`) — so the `mut:` trick used by awards/strike **will not work**; there is no `pendingLaunchReveal` to set | A new `shoot:` step that either performs a real launch in-page or calls the emitter through `page.evaluate` | The single highest-emotion moment in the game: the payoff for the whole design→launch loop. Strong candidate to replace frame 10's duplicate office shot |
| **Device Museum** | Only `scripts/audit-screens.mjs` visits it; no marketing shooter | A `tab`/nav helper plus a save with a deep back-catalogue (the showcase save is late-game, so likely already sufficient) | A shelf of devices *you* designed — the best "look what I built" proof in the app, and it is Pro content worth advertising |
| **Rival profile** | **No shooter at all** — zero matches for `openRival`/`rivalProfile` in `scripts/` | A new open-rival helper; `shoot-nemesis.mjs` is the closest existing precedent to crib from | Rivals have doctrines and arcs; a profile card sells "living opponents" better than the leaderboard does |

**Recommendation.** The current ten are strong and correctly ordered (search thumbnails only ever
show the first three, and 01–03 lead with Vault / Factory / Design — the most distinctive frames).
The one clear weakness is that **frames 05 and 10 are the same screen**. If any single change is
made, replace **frame 10's** office reuse with the **launch reveal**, keeping the
"Free to play. No dark patterns." caption on it — the caption is the compliance-relevant part, the
underlying screen is not. That costs one new `shoot:` helper and no re-ordering.

**Do not capture anything from this plan without first settling the `SIZE` question in §3** —
otherwise the new frame renders at a resolution the rest of the set may be about to leave.

---

## 5. Outstanding blockers and owner decisions

| # | Item | Status |
|---|---|---|
| 1 | App preview video is WebM (1.2.0) + a stale 1.1.0 `.mp4`; ASC accepts neither as-is | **BLOCKED — owner** (transcode + watch through) |
| 2 | `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` bump, build number strictly higher | **NEEDS OWNER** |
| 3 | Screenshot slot: confirm required class in live ASC; decide whether to re-render at 1290 × 2796 | **NEEDS OWNER** |
| 4 | Promo text / keywords / secondary category conflict between `STORE_LISTING.md` and `APP_STORE_METADATA.md` | **NEEDS OWNER** (recommend retiring `STORE_LISTING.md`) |
| 5 | EULA target: Apple standard URL (descriptions) vs project `/terms/` (paywall) — pick one, align 39 locales | **NEEDS OWNER** |
| 6 | Refund-verify endpoint's no-retention claim — source is outside this repo | **NEEDS OWNER** (see `PRIVACY_DISCLOSURE_INPUTS.md` §2.1) |
| 7 | Privacy pages dated "July 2026" — re-date at submission? | **NEEDS OWNER** |
