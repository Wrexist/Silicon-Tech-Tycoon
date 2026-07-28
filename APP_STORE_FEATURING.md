# Getting Featured on the App Store — Silicon: Tech Tycoon (v1.2.0)

A complete, optimized playbook for nominating **Silicon: Tech Tycoon** for App Store
featuring on the **1.2.0 major update**, plus a ready-to-paste nomination filled field-by-field.

> Honest odds read up front (senior-reviewer take, not a sales pitch):
> **1.2.0 is a stronger nomination than 1.1.0 was, and for a reason that has nothing to do with
> feature count.** Two things moved. First, the **store listing is now localized into all 39 App
> Store locales** — that was the single "Weak" row in the 1.1.0 fit table, and it gated the featuring
> window to English regions. Every locale is a regional lane that did not exist before, and it is the
> cheapest lever on this page that has already been pulled. Second, the headline feature is finally
> an *editorial* story rather than a systems one: **The Vault** — eighteen classified dossiers whose
> unlock conditions are hidden, revealing themselves in stages from a redaction block to a whisper to
> the exact terms. "A progression system that won't tell you its own rules" is a sentence an editor
> can use; "we added six systems" is not.
>
> The signature demo is unchanged and still the best asset: **live parametric device render + a
> code-drawn 3D HQ + a 3D factory line you build machine by machine**, all generated from code with
> **zero image assets**. 1.2.0 adds a genuine **fifth era** past the IPO with two new device
> categories, so the "there's so much here" case is now measured rather than asserted — a full run is
> hundreds of launches deep.
>
> **The ceiling is unchanged and you should not pretend otherwise:** it is a Capacitor WKWebView
> wrapper, so it showcases **no native Apple technologies** (no widgets, Live Activities, Game Center,
> Metal), and it is **iPhone-only**. Also note precisely what the localization is: **App Store listing
> metadata, not the app**. The game UI is English. That widens the store's reach and the featuring
> window; it is not a product claim, and putting "39 languages" in front of an editor who then opens
> an English-only build would cost you more than it buys.

---

## 0. TL;DR — do these, in this order

1. **File this as an App Enhancements nomination, not App Launch.** 1.2.0 is a major content drop and
   you have ratings from 1.0 → 1.1.0 — this is the featuring lane you can realistically win. Use §7.
2. **Upload all 39 localized listings before you file.** They are already written
   (`appstore/localizations/`, `validate.mjs --all` must print ✓ for every one). This is the biggest
   single change to your case since 1.1.0 and it is *already done* — it only counts once it is live
   in App Store Connect, and it widens the regions an editor can place you in.
3. **Refresh the product page for 1.2.0.** It is itself a *scored* criterion. Lead the screenshots
   with **The Vault** (the redacted dossier board is the most arresting single frame in the app),
   then the Factory Mode 3D line, then Design Lab's live render.
4. **Add the Silicon Awards as an In-App Event.** The in-game annual ceremony maps 1:1 to an App
   Store In-App Event — its own search + Today/Games surface and a first-class featuring hook.
5. **Lead with your live rating.** If you're at **4.0★+**, put it front-and-centre; if a recent
   release dinged it, run a quick TestFlight pass on 1.2.0 and fix the top complaints before filing.
6. **File the nomination ≥3 weeks before the 1.2.0 publish date** (aim 6–12 weeks). Type =
   **App Enhancements**. Tie the date to a topical games moment if one fits.
7. **Bigger bets, if budget allows:** one native hook is what reaches the **Today tab** — a
   **Live Activity** for an in-progress build / factory run, a **home-screen widget** (net worth /
   next launch / industry rank), or **Game Center** leaderboards for the rank meta. Real native work
   *outside* the current web stack — flagged, not assumed. With localization now shipped, this is the
   **only** remaining Weak row, and therefore the whole of the Today-tab gap.

---

## 1. What "featured" actually means

Featuring is editorial, hand-picked by Apple's App Store editors — you can't buy it. The slots:

| Placement | What it is |
|---|---|
| **Today tab** — App/Game of the Day, editorial stories | The marquee. A full story card with custom art. Rare, high-bar, huge. |
| **Games / Apps tabs** | Themed collections ("Games we love", "Tycoon & management", "Made by indies"). The realistic first target. |
| **Category & sub-category pages** | Simulation / Strategy shelves and "We Love…" rails. |
| **In-App Events surfaces** | Events get their own cards in search, on your product page, and in curated Today/Games event rails. New, and directly nominable. |
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
- **When:** **minimum 3 weeks** before your 1.2.0 publish date; you may submit **up to ~3 months**
  ahead to reach a wider featuring window. Earlier is better.
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
  **This is where filing on an update (vs. day one) helps most** — you have reviews now.
- **In-App Events & pre-orders** — first-class featuring hooks Apple promotes. The Awards unlock the
  **Silicon Awards** event; a pre-order no longer applies (already live).
- **Topical timing** — line up with an editorial moment (seasonal game collections, hardware season,
  "made by indies"). Don't invent a theme; watch the calendar and time the publish date.
- **Apple's values** — privacy, accessibility, inclusion. ← we're genuinely strong here.
- **A human developer story** — small team, the craft behind it. ← use it.

---

## 4. Silicon's honest fit at 1.2.0 — strengths vs. gaps

| Editorial criterion | Silicon's standing at 1.2.0 |
|---|---|
| **UI design** | **Strong.** Premium-by-restraint mandate, 8pt grid, one accent, light+dark, motion discipline, and a new liquid-glass modal system across the app. Highest-weighted box — we hit it. |
| **Uniqueness / innovation** | **Strong.** Design a device → it renders **live** in parametric vector; a real-time **3D HQ**; a **3D factory line you build machine-by-machine** — all drawn in code, **zero image assets**. New in 1.2.0, **The Vault**: a progression layer that hides its own rules and reveals them in stages. That last one is the first feature here that is a *story* rather than a system, which is what editorial copy needs. |
| **Content depth / replayability** | **Strong, and now measured rather than asserted.** 1.2.0 adds a genuine **fifth era** past the IPO with two new device categories and a new component tier on every line. A full run is hundreds of launches and five eras deep, with the endgame ladder landing where the earlier ones run out instead of leaving a flat stretch. |
| **Accessibility** | **Strong.** A dedicated pass this release — VoiceOver labels across menus/dialogs, focus that returns where you left it, a colour-blind-safe "in demand" indicator, reduced-motion catch-all, AA contrast both themes, 40px targets. Name it explicitly. |
| **Privacy / values** | **Strong.** Collects **no data**, fully offline, no SDKs. "Data Not Collected." Directly on Apple's values. |
| **No dark patterns** | **Strong.** $8.99 complete & winnable, one optional cosmetic Sandbox IAP, no ads/timers/loot boxes/currencies. Editors reward this. |
| **Product-page quality** | **Good — refresh for 1.2.0.** Lead the screenshots with **The Vault's redacted dossier board** (the most arresting single frame in the app), then Factory Mode, then the live device render. Paste the copy from `appstore/APP_STORE_METADATA.md`; add/refresh a preview video. |
| **In-App Events** | **New lever.** The annual Silicon Awards maps directly to a nominable event — set one up. |
| **Localization** | **Was the one Weak row — now shipped.** All **39 App Store locales** have written, validated listing metadata (name, subtitle, promo, keywords, description, What's New) in `appstore/localizations/`. Every locale is a regional featuring lane that did not exist at 1.1.0. **Caveat to state plainly if asked: this is store-listing localization; the app UI is English.** Do not imply otherwise to an editor who can open the build. |
| **Apple-tech showcase** | **Weak (unchanged) — and now the ONLY weak row.** Capacitor WKWebView wrapper uses haptics only — no widgets/Live Activities/Game Center/Metal. iPhone-only. With localization closed, this is the entire remaining gap between a Games-tab collection and the Today tab. |
| **Ratings** | **Now an asset, if ≥4.0★.** Filing on an update means you have reviews — lead with them. |

**Net:** a realistic target is a **Games-tab / Simulation-collection** feature or an **In-App Events
rail**, and for the first time that target is **not limited to English storefronts** — the 39
localized listings open regional collections that were unreachable at 1.1.0. The case is otherwise
carried by the ratings, the depth, and the Vault as the editorial hook. One native hook remains the
single thing standing between this and a Today-tab conversation.

---

## 5. Pre-nomination optimization checklist (ordered by leverage)

**Cheap, do before filing:**
- [ ] **Upload all 39 localized listings to App Store Connect.** Already written and validated in
      `appstore/localizations/` — run `node appstore/localizations/validate.mjs --all` and confirm 39
      ✓ first. Written, but **not live until pasted into ASC**, and it counts for nothing until it is.
      Highest-leverage item on this list *because the work is already done*.
- [ ] **Refresh the product page for 1.2.0** — it's scored and always seen. Screenshot order:
      **The Vault** → Factory Mode → Design Lab live render → Market/rivalry → 3D HQ → Awards. Paste
      the subtitle, promo text, keywords, description and What's New from `appstore/localizations/`.
- [ ] **Add the Silicon Awards In-App Event** (App Store Connect → Features → In-App Events) and set
      "Submit a new In-App Event?" = **Yes** on the nomination.
- [ ] **Refresh the app preview video** to open on **The Vault** (redacted board → a file decrypting),
      then the Factory Mode 3D line → Design Lab live render → IPO. No audio needed. Strongest single
      product-page upgrade, and the Vault opening is a better cold hook than a conveyor belt.
- [ ] **Confirm you're at 4.0★+** — if a recent release dinged it, run a TestFlight pass on 1.2.0 and
      fix the top complaints before filing.
- [ ] **Privacy & support URLs live** (`appstore/APP_STORE_METADATA.md §10`) — editors check them.

**Bigger bets (native work outside the Capacitor web stack — real cost, highest ceiling):**
- [ ] **Live Activity / Dynamic Island** for an in-progress build, factory run, or launch-week countdown.
- [ ] **Home-screen widget** — company net worth, next launch, industry rank.
- [ ] **Game Center** leaderboards mapped to the existing industry-rank meta.
- [ ] **iPad support** (currently iPhone-only, portrait-only) → opens the iPad featuring lane.
- [ ] **Localize the app itself** (not just the listing). The 39 listings put you in front of those
      storefronts; an English-only build is what you convert them with. This is the natural follow-on
      now that the metadata exists, and it is the honest version of the "39 languages" claim.

> Any one of the native hooks materially raises odds because it gives editors a *platform* reason to
> feature you. None are required to file — but they're the difference between "deep indie sim" and
> "app that shows off iOS."

---

## 6. Assumptions baked into the draft below

- This is the **1.2.0 major content update** → Nomination Type = **App Enhancements**.
- The app is **already live** (1.0 → 1.1.0 shipped), so pre-order does **not** apply and you have
  **ratings** to lead with.
- **Worldwide** availability, **simultaneous** update (not market-first).
- **iPhone-only** (iPad documented as unsupported).
- **39 App Store locales** for the listing; the **app UI is en-US only**. State the first, never
  imply the second.
- **Silicon Awards In-App Event recommended** — the draft flags the Yes path; set it up in ASC first.
- Anything in `<angle brackets>` is a **placeholder you must fill** (Apple ID, dates, live URLs).

---

## 7. THE NOMINATION — ready to paste

### Field-by-field

| Field | Value to enter |
|---|---|
| **Nomination ID** | *(leave blank — new nomination)* |
| **Related Apps** | `<your numeric Apple ID — App Store Connect → App Information → Apple ID>` |
| **Nomination Name** *(internal, ≤60)* | `Silicon: Tech Tycoon — v1.2.0 Major Update` |
| **Nomination Type** | **App Enhancements** |
| **Nomination Description** *(≤1,000)* | *paste block A below* |
| **Publish Date (Start)** | `<YYYY-MM-DD>` — your 1.2.0 release, **≥3 weeks out** (aim 6–12 wks) |
| **Publish Date (End)** | `<YYYY-MM-DD>` — same day if fixed, or end of your update window |
| **Relevant Countries or Regions** | *(leave pre-populated = worldwide; or lead with* `USA` *for a focused push)* |
| **Launch in certain markets first?** | **No** *(worldwide simultaneous)* |
| **Submit a new In-App Event?** | **Yes** *(the Silicon Awards — set it up in ASC first; strong featuring lever)* |
| **Platforms** | **iOS (iPhone)** |
| **Related In-App Events** | `Silicon Awards` *(once created)* |
| **Localization** | *all 39 ASC locales — paste from `appstore/localizations/` before filing* |
| **Supplemental Materials** *(≤5 URLs)* | see list below |
| **Does this app include a pre-order?** | **No** *(already live — pre-order doesn't apply to an update)* |
| **Helpful Details** *(≤500)* | *paste block B below* |

### Block A — Nomination Description *(≤1,000 chars; this draft = 990)*

```
Silicon: Tech Tycoon's fifth era arrives, and with it a progression layer that refuses to explain itself. You still design every product down to the chip — processor, display, battery, materials, camera — and watch it render live in parametric vector, then build the 3D factory line that makes it, machine by machine. Every pixel is drawn from code; the app ships zero image assets.

New in 1.2.0, The Vault: eighteen classified dossiers whose unlock conditions are hidden. Each opens on something you did without being asked, and reveals itself in stages — a redaction block, then a whisper, then the exact terms, then the reward. You can buy the intelligence. You can never buy the deed.

Past the IPO lies the Autonomy Era, a genuine fifth age with two new device categories. Your arch-rival calls you out in multi-week duels. Employees have names and lives; rivals fight each other, not just you.

Still a premium single purchase — no ads, no timers — collecting no data, fully offline.
```

### Block B — Helpful Details *(≤500 chars; this draft = 491)*

```
Our signature is parametric rendering: every device, the 3D factory line and the 3D office are generated from code as you play, so the app ships zero image assets. The Vault is the new hook — a progression system that hides its own rules and unredacts them in stages, demoable in 20 seconds. Store listings now cover all 39 App Store locales (the app UI remains English). One purchase, offline, no data collected, no dark patterns, full accessibility pass. Happy to share a TestFlight build.
```

### Supplemental Materials — provide up to 5 (each must be **live** before you submit)

1. `https://wrexist.com/silicon` — marketing / landing page, updated for 1.2.0 *(create + host)*
2. `<app-preview-video-url>` — the 1.2.0 preview opening on The Vault *(produce; host on the page)*
3. `<press-kit-or-screenshots-url>` — media folder *(reuse `app-store-screenshots/`, add the new shots)*
4. `<testflight-public-link>` — public beta of the 1.2.0 build *(lets editors play the new content)*
5. `https://wrexist.com/silicon/privacy` — privacy policy *(reinforces the no-data story)*

> All five are optional, but a **TestFlight link + a preview video** are the two that most help an
> editor actually evaluate a game. Don't submit dead links — a broken URL reads as unfinished.

---

## 8. The next nomination — the Today-tab play

1.2.0 is your strong **App Enhancements** shot, and the localized listings make it the first one
that can land outside English storefronts. To climb from a Games-tab collection toward the
**Today tab**, the next push needs a **platform reason** to feature you — with localization closed,
a native hook is now the *only* remaining gap. Build one and file again on the release that ships it:

- **Type:** *App Enhancements* (the native-hook release) or *New Content* (a new era / device class).
- **The hook:** a **Live Activity / Dynamic Island** in-progress build or factory countdown, a
  **home-screen widget**, or **Game Center** leaderboards on the industry rank. Any one turns the
  story into "showcases iOS" — the kind editors put on Today.
- **Timing:** file ≥3 weeks ahead; tie it to a topical games moment if one fits, and lead with your
  now-higher rating + any press from the 1.2.0 feature.
- **In-app localization + iPad** are the two remaining lanes. The 39 listings already put you in
  front of those storefronts; localizing the build is what converts them.

Keep the 1.2.0 nomination *and* this one in the dashboard; they're different moments.

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
- [Create and submit In-App Events — App Store Connect Help](https://developer.apple.com/help/app-store-connect/manage-in-app-events/overview-of-in-app-events/)
- [Apple's editorial featuring criteria (2026) — AppScreenshotStudio](https://appscreenshotstudio.com/blog/get-featured-on-the-app-store-2026-nominations-guide)
- [How to get your app featured on the App Store — Apptweak](https://www.apptweak.com/en/aso-blog/how-to-get-your-app-featured-on-the-app-store)

> Apple's featuring program and form change over time — re-check the two Apple Developer Help links
> above before you file, and verify the field/character limits against the live form.
