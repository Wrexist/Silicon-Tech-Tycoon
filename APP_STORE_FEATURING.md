# Getting Featured on the App Store — Silicon: Tech Tycoon

A complete, optimized playbook for nominating **Silicon: Tech Tycoon** for App Store
featuring, plus a ready-to-paste nomination filled field-by-field.

> Honest odds read up front (this is the senior-reviewer take, not a sales pitch):
> Silicon is **genuinely strong** on the two highest-weighted editorial criteria — **UI
> design** and **uniqueness** (the live parametric device render + code-drawn 3D HQ are
> exactly the "hard to describe, obvious in a 30-second demo" hook editors look for) — and
> it nails Apple's **privacy** and **no-dark-patterns** values. It is **weak** where Apple's
> editorial machine pushes hardest: it's a Capacitor WKWebView wrapper, so it showcases
> **no native Apple technologies** (no widgets, Live Activities, Game Center, Metal, Apple
> silicon story), it's **iPhone-only**, and on day one it has **no ratings** (92% of featured
> apps are 4★+). The plan below leans into the strengths and closes the cheap gaps
> (pre-order, product-page polish, 4★+ via beta, localization) before you file.

---

## 0. TL;DR — do these, in this order

1. **Polish the product page first.** It is itself a *scored* featuring criterion and the one
   thing editors always see. Screenshots already exist (`app-store-screenshots/6.7/`); add a
   15–30s **app preview video** and finalize subtitle/description (`STORE_LISTING.md`).
2. **Set up a pre-order.** Apple actively features pre-order launches; it's the single cheapest
   high-leverage signal we're currently leaving on the table. Flip the nomination's pre-order
   answer to **Yes**.
3. **Earn a 4★+ rating before you're judged.** Run a TestFlight beta, fix what hurts, launch
   clean. A day-one app with no rating is a hard sell; a 4.5★ launch is an easy one.
4. **File the nomination ≥3 weeks out** (aim 6–12 weeks). Type = **App Launch**. Use the
   ready-made text in §7.
5. **Plan a second nomination** (type = *App Enhancements* / *New Content*) timed to your first
   content update — that's when you'll have the ratings to win a feature you can't on day one.
6. **Bigger bets, if budget allows:** one native hook moves the needle most — a **Live Activity**
   for an in-progress build/launch countdown, a **home-screen widget** (net worth / next launch),
   or **Game Center** leaderboards for the industry rank. These are real native work *outside* the
   current web stack — flagged, not assumed.

---

## 1. What "featured" actually means

Featuring is editorial, hand-picked by Apple's App Store editors — you can't buy it. The slots:

| Placement | What it is |
|---|---|
| **Today tab** — App/Game of the Day, editorial stories | The marquee. A full story card with custom art. Rare, high-bar, huge. |
| **Games / Apps tabs** | Themed collections ("Games we love", "Tycoon & management", "Made by indies"). The realistic first target. |
| **Category & sub-category pages** | Simulation / Strategy shelves and "We Love…" rails. |
| **Search "We Also Love These Apps"** | Editorial rail under search results — tied to product-page quality. |
| **Auto-suggested / algorithmic** | Driven by ratings, conversion, retention — *earned*, not nominated. |

The nomination form feeds the **editorial** lanes. It doesn't guarantee anything — it gives the
editors the context to choose you. Most apps never hear back; you watch the dashboard and the store.

---

## 2. The nomination form — where, who, when

- **Where:** App Store Connect → **Apps** → *Silicon: Tech Tycoon* → sidebar **Featuring** →
  **Nominations** → **+** → **Create Nomination**. (The "Get Started" button on Apple's *Getting
  Featured* page leads here.)
- **Who:** your role must be **Account Holder, Admin, App Manager, or Marketing**.
- **When:** **minimum 3 weeks** before your publish date; you may submit **up to ~3 months** ahead
  to reach a wider featuring window. Earlier is better.
- **Individual vs CSV:** create it in the UI to **save as Draft** and edit freely. CSV import
  **auto-submits** (no draft) — don't use it until the text is final.
- **States:** *Drafts* (fully editable) → *Submitted* (everything editable **except** Nomination
  Type and Related Apps) → *Archived*. So lock type/app before submitting.

---

## 3. What the editors score (and the unwritten levers)

Apple's editors weigh **seven criteria**: **user experience, UI design, innovation, uniqueness,
accessibility, localization, and product-page quality.** UI design and uniqueness carry the most
weight. On top of that, the things that quietly decide it:

- **Showcasing Apple technologies** — widgets, Live Activities, Dynamic Island, Game Center,
  SharePlay, Metal, Apple silicon, "Designed for iPad/Mac/Vision Pro". Editors feature apps that
  *sell the platform*. ← our biggest gap.
- **Ratings ≥ 4.0** — ~92% of featured apps clear this bar; below 4.0 you're effectively invisible.
- **Pre-orders & In-App Events** — both are first-class featuring hooks Apple promotes.
- **Topical timing** — line up with an editorial moment (seasonal game collections, hardware
  season, "made by indies"). Don't invent a theme; watch the calendar and time the publish date.
- **Apple's values** — privacy, accessibility, inclusion. ← we're genuinely strong here.
- **A human developer story** — small team, the craft behind it. ← use it.

---

## 4. Silicon's honest fit — strengths vs. gaps

| Editorial criterion | Silicon's standing |
|---|---|
| **UI design** | **Strong.** Premium-by-restraint mandate, 8pt grid, one accent, light+dark, motion discipline. This is the highest-weighted box and we hit it. |
| **Uniqueness / innovation** | **Strong.** Design a device from components → it renders **live** in parametric vector; a real-time **3D HQ drawn entirely in code, zero image assets**. That *is* the 30-second demo. |
| **Accessibility** | **Solid.** Reduced-motion catch-all, focus-visible rings, ARIA/VoiceOver labels on the device canvas, AA contrast both themes, 40px touch targets. Name it explicitly. |
| **Privacy / values** | **Strong.** Collects **no data**, fully offline, no SDKs. "Data Not Collected." Directly on Apple's values. |
| **No dark patterns** | **Strong.** $8.99 complete & winnable, one optional cosmetic Sandbox IAP, no ads/timers/loot boxes/currencies. Editors reward this. |
| **Product-page quality** | **Good, finish it.** Screenshots done; add a preview video; tighten copy. |
| **Localization** | **Weak.** en-US only → narrows the featuring window to English regions. Each added locale opens a regional lane. |
| **Apple-tech showcase** | **Weak.** Capacitor WKWebView wrapper uses haptics only — no widgets/Live Activities/Game Center/Metal. The "Platforms" field is iPhone-only. This is the real ceiling. |
| **Ratings** | **N/A day one.** No reviews yet → see the beta-then-launch plan. |

**Net:** a realistic target is a **Games-tab / Simulation-collection** feature, especially around
a topical moment or your first update — not Game of the Day on day one. The pre-order + 4★+ launch
+ product-page polish are what get you into the room. One native hook is what would get you onto the
Today tab later.

---

## 5. Pre-nomination optimization checklist (ordered by leverage)

**Cheap, do before filing:**
- [ ] **Finalize the product page** — it's scored and always seen. Upload the 5 screenshots in
      order (`STORE_LISTING.md §Screenshots`); set subtitle, promo text, keywords.
- [ ] **Produce a 15–30s app preview video** — Design Lab live render → Market/Leaderboard →
      3D HQ → New Game+ IPO. No audio needed. This is the strongest single product-page upgrade.
- [ ] **Set up a pre-order** (App Store Connect → Pricing & Availability) → answer pre-order **Yes**.
- [ ] **Run a TestFlight beta** to reach **4★+** before launch; fix the top complaints.
- [ ] **Add ≥1–2 localizations** (even just store-listing metadata) to widen the featuring window.
- [ ] **Privacy & support URLs live** (`STORE_LISTING.md` has the copy) — editors check them.

**Bigger bets (native work outside the Capacitor web stack — real cost, highest ceiling):**
- [ ] **Live Activity / Dynamic Island** for an in-progress build or launch-week countdown.
- [ ] **Home-screen widget** — company net worth, next launch, industry rank.
- [ ] **Game Center** leaderboards mapped to the existing industry-rank meta.
- [ ] **iPad support** (currently iPhone-only, portrait-only) → opens the iPad featuring lane.

> Any one of the native hooks materially raises odds because it gives editors a *platform* reason
> to feature you. None are required to file — but they're the difference between "nice indie sim"
> and "app that shows off iOS."

---

## 6. Assumptions baked into the draft below

- This is the **day-one v1.0 launch** → Nomination Type = **App Launch**.
- **Worldwide** availability, **simultaneous** (not market-first) — matches `STORE_LISTING.md`.
- **iPhone-only** (iPad documented as unsupported in v1).
- **en-US** only today.
- **No In-App Event, no pre-order yet** — but the draft flags the recommended pre-order = Yes path.
- Anything in `<angle brackets>` is a **placeholder you must fill** (Apple ID, dates, live URLs).

---

## 7. THE NOMINATION — ready to paste

### Field-by-field

| Field | Value to enter |
|---|---|
| **Nomination ID** | *(leave blank — new nomination)* |
| **Related Apps** | `<your numeric Apple ID — App Store Connect → App Information → Apple ID>` |
| **Nomination Name** *(internal, ≤60)* | `Silicon: Tech Tycoon — v1.0 App Launch` |
| **Nomination Type** | **App Launch** |
| **Nomination Description** *(≤1,000)* | *paste block A below* |
| **Publish Date (Start)** | `<YYYY-MM-DD>` — your planned launch, **≥3 weeks out** (aim 6–12 wks) |
| **Publish Date (End)** | `<YYYY-MM-DD>` — same day if fixed, or end of your launch window |
| **Relevant Countries or Regions** | *(leave pre-populated = worldwide; or lead with* `USA` *for a focused push)* |
| **Launch in certain markets first?** | **No** *(worldwide simultaneous; set Yes→USA only if doing a US-first push)* |
| **Submit a new In-App Event?** | **No** *(none in v1 — adding one later is a featuring lever)* |
| **Platforms** | **iOS (iPhone)** |
| **Related In-App Events** | *(none)* |
| **Localization** | `en-US` *(add more to widen the window)* |
| **Supplemental Materials** *(≤5 URLs)* | see list below |
| **Does this app include a pre-order?** | **No** today — **change to Yes** once you set up the pre-order (recommended) |
| **Helpful Details** *(≤500)* | *paste block B below* |

### Block A — Nomination Description *(≤1,000 chars; this draft = 934)*

```
Silicon: Tech Tycoon is a premium tech-company sim where you don't just watch numbers — you design the products. Pick the chip, display, battery, frame material and camera array, choose a finish and colour, and watch a phone, tablet or laptop render live in a crisp parametric vector preview. Then walk a real-time 3D headquarters that grows from a one-room garage to a global campus — every pixel drawn in code, zero image assets.

Read a living market, time each launch to the week, set your price, and race six rival companies to #1 — then take the company public in a New Game+ IPO that carries a legacy bonus into your next run.

It's complete and winnable for one fair price: no ads, no timers, no loot boxes, no energy, no currencies — and one optional cosmetic Sandbox unlock. It collects no data whatsoever and runs fully offline. Built by a small indie team obsessed with premium design, fluid motion and real accessibility.
```

### Block B — Helpful Details *(≤500 chars; this draft = 481)*

```
Our signature is parametric rendering — every device and the whole 3D office are generated from code as the player designs them, so the app ships zero image assets. It's a restraint-first take on a genre full of dark patterns: one purchase, fully offline, zero data collection, no ads or timers. We sweated accessibility — reduced-motion, focus-visible rings, VoiceOver labels on the device canvas, AA contrast in light and dark. Happy to share a TestFlight build or a guided demo.
```

### Supplemental Materials — provide up to 5 (each must be **live** before you submit)

1. `https://wrexist.com/silicon` — marketing / landing page *(create + host)*
2. `<app-preview-video-url>` — the 15–30s preview *(produce; host on the page or a direct link)*
3. `<press-kit-or-screenshots-url>` — media folder *(can reuse `app-store-screenshots/`)*
4. `<testflight-public-link>` — public beta build *(create in TestFlight; lets editors play it)*
5. `https://wrexist.com/silicon/privacy` — privacy policy *(reinforces the no-data story)*

> All five are optional, but a **TestFlight link + a preview video** are the two that most help an
> editor actually evaluate a game. Don't submit dead links — a broken URL reads as unfinished.

---

## 8. Second nomination — the one you'll actually win

Day-one apps have no ratings, and ratings are a near-gate. So plan the **real** featuring push for
your **first content update**, when you'll have reviews proving 4★+:

- **Type:** *App Enhancements* (a meaningful feature/era drop) or *New Content*.
- **Timing:** file ≥3 weeks before the update ships; tie it to a topical games moment if one fits.
- **Lead with:** the new thing **plus** your now-public 4★+ rating and any press/awards.
- **Add a hook if you built one:** a Live Activity, widget, or Game Center board turns this into a
  "showcases iOS" story — the kind that reaches the Today tab.

Keep the launch nomination *and* this one in the dashboard; they're different moments.

---

## 9. After you submit

- A green success banner appears; the nomination moves to **Submitted**. You can keep editing every
  field except Type and Related Apps.
- **Expect silence.** Apple rarely confirms a feature ahead of time and gives no feedback on passes.
  Watch the store and your analytics around the publish window.
- **Don't re-spam.** One strong nomination per moment. Update the existing one if plans change.
- **Marketing assets:** once featured (or anytime), use Apple's official *Marketing Resources* and
  the "Available on the App Store" badge / app-icon generator — follow Apple's marketing guidelines.

---

## Sources

- [Nominate your app for featuring — App Store Connect Help](https://developer.apple.com/help/app-store-connect/manage-featuring-nominations/nominate-your-app-for-featuring/)
- [Nominations template (CSV field reference) — App Store Connect Help](https://developer.apple.com/help/app-store-connect/reference/nominations-template/)
- [Enhancements to the App Store featuring process — Apple Developer News](https://developer.apple.com/news/?id=nx3eotat)
- [Featuring Nominations Live in App Store Connect — Gummicube](https://www.gummicube.com/blog/featuring-nominations-live-in-app-store-connect)
- [Apple's editorial featuring criteria (2026) — AppScreenshotStudio](https://appscreenshotstudio.com/blog/get-featured-on-the-app-store-2026-nominations-guide)
- [How to get your app featured on the App Store — Apptweak](https://www.apptweak.com/en/aso-blog/how-to-get-your-app-featured-on-the-app-store)

> Apple's featuring program and form change over time — re-check the two Apple Developer Help links
> above before you file, and verify the keyword/character limits against the live form.
