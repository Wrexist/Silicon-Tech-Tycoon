# Launch checklist — v1.3.0 (free + Silicon Pro)

**Everything you have to do after merging the free-to-play PR, in the order you do it.**

This is the one page you work through. It pulls together the steps that live in
`appstore/SUBSCRIPTION_GUIDE.md`, `BUILD_IOS.md`, `appstore/APP_STORE_METADATA.md` and
`STORE_LISTING.md` — links out for the detail rather than repeating it, so there is only ever one
source of truth per step.

Rough total: **half a day of work**, plus 1–3 days waiting on App Review.

> **The two that cost you real money if you skip them:** Phase 1 (build number) and Phase 5b
> (grace period). Everything else costs you a rejection and a resubmit, which is only time.

---

## Phase 0 — Immediately after the merge (5 min)

The paywall links to `/terms/`, and that page only exists once this is on `main`. GitHub Pages
serves from `main`, so **until the merge lands, the Terms link in your purchase flow is a 404** — the
single most common Guideline 3.1.2 rejection.

> ### ✅ RESOLVED — verified live on 2026-08-29
>
> This is no longer a blocker. `docs/terms/index.html` **is present on `origin/main`**
> (`git cat-file -e origin/main:docs/terms/index.html`), Pages is serving it, and all four URLs
> below were fetched and returned **HTTP 200**. The deployed privacy page is byte-identical to
> `docs/privacy/index.html` (8,344 bytes), so nothing is stale. The paywall's link constants
> (`src/components/Paywall.tsx:47–48`) point at exactly these URLs, and the Terms page contains a
> real "Silicon Pro — subscription terms" section.
>
> Re-run the four checks only if Pages settings or the `docs/` tree change.

- [x] PR merged into `main` — `docs/terms/index.html` confirmed on `origin/main`
- [x] Waited ~1 minute for Pages to rebuild
- [x] `https://wrexist.github.io/Silicon-Tech-Tycoon/` loads — **200**
- [x] `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/` loads — **200**
- [x] `https://wrexist.github.io/Silicon-Tech-Tycoon/support/` loads — **200**
- [x] `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/` loads — **200** ← the 3.1.2 page

If Pages isn't enabled: repo **Settings → Pages → Deploy from a branch → `main` → `/docs`**.

---

## Phase 1 — Verify the build number (2 min, do not skip)

`isFoundingBuild()` grants **permanent free Pro** to anyone whose original download was a build
*below* `FIRST_FREE_BUILD`. Ship a number at or under that line and every new free downloader is
detected as a paid-era customer and gets Pro forever, for nothing.

- [ ] `grep FIRST_FREE_BUILD src/state/pro.ts` → **5**
- [ ] Xcode → Version → **1.3.0**, and `package.json` version matches

**The build number depends on how you ship:**

| Route | Build number | Check |
|---|---|---|
| `ios-testflight-capacitor.yml` (the normal path — no Mac needed) | the workflow's **run number**, ~69 at the time of writing | Nothing to set. The run now *refuses to build* if that number is below `FIRST_FREE_BUILD`, so a reset counter fails loudly instead of giving Pro away |
| Archiving locally in Xcode | whatever `CURRENT_PROJECT_VERSION` says (**5** in `project.pbxproj`) | 5 is fine *if* no 1.3.0 build is already uploaded at 5 or above; otherwise raise it. Must be ≥ 5 either way |

Either way the number must be **≥ 5** — anything below it is read as a paid-era download. Above the
line, the exact value only has to be unique and increasing within a marketing version.

**Forever after:** the build number increments every release; leave `FIRST_FREE_BUILD` at 5 permanently.

---

## Phase 2 — Store copy (30 min, or a decision)

The old description claimed the game was *"complete and winnable with a single purchase"* and that
Creative Mode was *"the only in-app purchase, ever."* Both are false now. Shipping them next to a
free app with subscriptions is a **Guideline 2.3.1** rejection.

**Re-verified 2026-08-14 against the files on disk — this item was out of date, and the remaining
work is much smaller than it says below.** Checked by keyword sweep across all 39 locale folders,
not by reading every translation end to end:

- [x] **`description.txt` — done in all 39 locales.** Every one of them now describes the free
      download and Silicon Pro; none still carries the "complete and winnable with a single
      purchase" claim. There is **no reason to ship en-US only**, and doing so would cost you 38
      storefronts for a problem that is already fixed.
- [x] **`release_notes.txt` — now done in all 39 locales.** They were still the v1.2 notes (the
      Vault / fifth era) in 38 storefronts, which would have re-announced the last release instead
      of the one thing worth saying: the game is free now. Translated in this pass.
      *Machine-translated, matching the terminology already used in each locale's description.
      Worth a native speaker's skim on your top storefronts before you submit — but nothing here is
      a compliance claim, so a clumsy phrase costs polish, not a rejection.*
- [ ] `node appstore/localizations/validate.mjs --all` → ✓ for every locale you're shipping
      *(passing as of this audit — all 39 ✓)*

Detail: `appstore/SUBSCRIPTION_GUIDE.md` § Step 2.

---

## Phase 3 — Assets (1–2 h, only if you want them current)

Re-verified 2026-08-14 — most of this was already done. Only the video is genuinely outstanding.

- [x] **Screenshot 10 is already fixed** — verified in this pass. Both `store/10-premium.png` and
      `ipad/10-premium.png` now read *"Free to play. No dark patterns."* with no price anywhere.
      Nothing to do.
- [ ] Consider one screenshot showing the Time Machine — the headline new thing.
      ⚠ **Not the paywall.** `scripts/shoot-paywall-design.mjs` renders it beautifully and it is
      tempting, but the paywall displays **prices**, and a price baked into a marketing asset is
      exactly the Guideline 2.3.7 rejection this app already took once (screenshot 10 still
      advertising "$8.99 once"). Those renders are for App Store Connect's per-subscription *App
      Review Screenshot* field, where a price is required — never for the store gallery.
- [ ] **App preview video:** `app-store-video/` ships the 1.2.0 cut as **WebM only**, and the
      committed `.mp4` is still the **1.1.0** cut. App Store Connect accepts `.mov` / `.m4v` /
      `.mp4` — not WebM — so a transcode is required either way. See `app-store-video/README.md`,
      then watch it through before uploading.

---

## Phase 4 — Build and upload (20 min)

```bash
npm ci && npm test && npm run typecheck && npm run build && npx cap sync ios
```

- [ ] All three green (1,707 tests as of 2026-08, determinism pin included)
- [ ] **The Swift compiles.** `npm test` never touches `ios/**`, and three past releases were burned
      on trivial Swift errors. Open the PR (the `iOS build check` workflow runs automatically on any
      PR touching `ios/**`) **or** dispatch `ios-build-check.yml` by hand, and wait for it to go
      green *before* spending 40 minutes on the TestFlight run.
- [ ] Xcode → **Product → Archive → Distribute App → App Store Connect → Upload**
- [ ] TestFlight shows **1.3.0** with the build number from Phase 1 (the CI run number, or whatever you archived locally) and finishes processing
- [ ] Install that TestFlight build on a real iPhone before going further

---

## Phase 5 — App Store Connect (45 min)

Full field-by-field values in `appstore/SUBSCRIPTION_GUIDE.md` Steps 4–9. Summary:

### 5a — Products
- [ ] **Pricing and Availability → Free** (do this *with* this submission, not before — a free build
      with no paywall live is a window where you give the paid game away)
- [ ] Subscription **group** created, reference name **`silicon_pro`**
      *(this used to be load-bearing: the StoreKit 2 path looked the group up by that literal
      string, but App Store Connect indexes groups by a numeric identifier it assigns, so a
      mismatch would have read every subscriber as "no subscription". The plugin now asks the store
      which group its own Pro products are in, so the name is a label again. RevenueCat — the
      active backend — resolves by entitlement and never used it at all.)*
- [ ] `com.wrexist.silicon.pro.yearly` — $19.99/yr, in the group, ranked above monthly
- [ ] `com.wrexist.silicon.pro.monthly` — $3.99/mo, in the group
- [ ] **7-day free trial** (Introductory Offer → Free → 1 week → all countries) on **both**
- [ ] `com.wrexist.silicon.pro.lifetime` — $29.99, **Non-Consumable**, *not* in the group,
      **Family Sharing ON** (cannot be turned on retroactively)
- [ ] Legacy `com.wrexist.silicon.sandbox` left **live** — deleting it breaks restores for people
      who bought it

### 5b — Settings that quietly earn or lose money
- [ ] **Billing Grace Period → ON**, longest available. ~⅓ of churn is a failed card; with this on,
      Apple keeps the subscriber entitled while it retries and the app's "problem with your payment"
      strip has something to fire on. Without it they silently vanish.
- [ ] **Small Business Program** enrolled (15% commission instead of 30%)

### 5c — Metadata
- [ ] **Terms of Use (EULA) link in the DESCRIPTION text** — the last two lines of every
      `appstore/localizations/<locale>/description.txt`. Without it the submission is auto-rejected
      under 3.1.2 (it happened to build 70 — `appstore/REJECTION_3.1.2_EULA.md`). There is no
      License Agreement *URL* field; leave App Information on Apple's standard EULA
- [ ] Privacy Policy URL → `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`
- [ ] Support URL live
- [ ] Categories: **Simulation** (primary), **Strategy** (secondary)
- [ ] Age rating → **4+**
- [ ] App Privacy → declare **Purchase History + Device ID**, both *app functionality*, both **not
      linked to the user** and **not used for tracking** (RevenueCat processes purchases). Must match
      `ios/App/App/PrivacyInfo.xcprivacy` and `docs/privacy/` exactly — see
      `appstore/REVENUECAT_SETUP.md`
- [ ] Description / what's-new pasted **from `appstore/localizations/`**, not from the .md files

---

## Phase 6 — Sandbox test on a real device (30 min) — this gates submission

Simulator can't do StoreKit sandbox properly. Settings → Developer → **Sandbox Apple Account**,
sign in with a sandbox tester, then run **every** row. A product attached to the review build that
can't complete is a Guideline 2.1 rejection.

| Check | Expected |
|---|---|
| Founding offer after naming the company | Appears once; relaunching doesn't repeat it |
| Prices on the paywall | **Localized from the store** — switch the sandbox region and confirm they change |
| Trial line | Only on the recurring rows, only while the tester is eligible |
| Buy Yearly | Sheet → confirm → paywall closes → gated content unlocks immediately |
| **Cancel the sheet** | **No error banner.** Nothing granted, nothing said |
| Restore Purchases (paywall *and* Settings) | Recovers the subscription on a fresh install |
| Settings → Manage subscription | Opens Apple's native sheet |
| Airplane mode → open paywall | "The store didn't answer" retry card, **not** a buy button |
| Airplane mode + active subscription | Pro **still works** — must not lapse offline |
| Era-3 wall | Free: opens paywall. After subscribing: continues **into the era ceremony** |
| Lifetime after purchase | Row shows `OWNED`, can't be bought twice |
| Let a sandbox sub expire | Gates re-lock (sandbox clock: 1 month ≈ 5 min) |

General device smoke test while you're there:

- [ ] Safe areas OK on notch / Dynamic Island / home indicator
- [ ] Haptics fire on launch and milestones
- [ ] No crash when backgrounded mid-tick
- [ ] Save/load survives a force-quit

> **Founding Owner cannot be tested here.** The receipt reports version `"1.0"` for every sandbox
> and TestFlight install, so the native side only reports a build number in production — otherwise
> every tester would be grandfathered into free Pro and the paywall would never appear. Expect the
> paywall as a *normal free player* on these builds. Grandfathering is verified after release
> (Phase 8).

---

## Phase 7 — Submit (10 min)

- [ ] All **three** Pro products attached to the version
- [ ] The 1.3.0 build you just uploaded is selected (see Phase 1 for which number to expect)
- [ ] **App Review Information → Notes** — paste the block from
      `appstore/SUBSCRIPTION_GUIDE.md` § Step 11. It tells the reviewer what's free, what Pro adds,
      that nothing purchasable affects the simulation, where the paywall and cancel path are, and
      that paid-era customers are grandfathered.
- [ ] Read the **Go / no-go** checklist at the bottom of the subscription guide
- [ ] Submit for Review

**If rejected**, it is almost always one of four things, all already handled — but re-check the live
pages: a dead legal link · a price that isn't the most prominent element on its row · a missing
subscription length · a trial presented as a toggle.

---

## Phase 8 — After it's live

**Week one**
- [ ] Confirm a real (non-sandbox) purchase completes on the live build
- [ ] Confirm a paid-era customer gets **Founding Owner** automatically — ask someone who owns the
      old paid version to update and check Settings → Silicon Pro
- [ ] Watch App Store Connect → **Subscriptions** for trial-start and trial→paid conversion

**Then, highest return per hour and needs no code:**
- [ ] **Win-back offers** on both recurring SKUs (ASC → the subscription → Win-Back Offers). Apple
      decides eligibility and surfaces them on your product page and the user's Subscriptions page
      with zero app changes. Reported recovery runs 15–20% of otherwise-lost revenue.

**Watch for, and act on:**
- Refund rate and churn on the first charge. Trials convert **silently** by your decision — if
  either looks bad over the first few hundred trials, restoring the reminder is one branch in
  `ProNudge.tsx` keyed on `onTrial` + `trialDaysRemaining()`.
- Free-tier retention. Free players can't reach the IPO (it's behind the era wall), so the free
  experience has no ending. If retention sags, a small Growth-Era terminal beat beats moving
  `FREE_TIER.maxEra` — see `MONETIZATION.md` §9.

**Tuning levers, in order of expected value:** yearly price → `FREE_TIER.maxEra` → founding-offer
placement → lifetime price. `MONETIZATION.md` §8 has the reasoning.

---

## If something goes wrong

| Symptom | Do this |
|---|---|
| Purchases broken / products not propagating | Set `NATIVE_PRO_WIRED = false` in `src/state/proStore.ts`, ship a patch. Purchase UI hides itself and the catalog reports unavailable — no dead buttons. |
| Someone reports lost Pro | Settings → **Restore purchases** first. Entitlement is tied to the Apple ID, not the save. |
| Paid-era customer not recognised | They need iOS 16+ for `AppTransaction`. Restore Purchases is the fallback. If it still fails, grant manually via a promo code. |
| Storefront rejected for description | That locale's copy still has the old "single purchase" claim (Phase 2). Fix that locale and resubmit. |

**Never** lower `FIRST_FREE_BUILD`, and **never** delete the legacy `com.wrexist.silicon.sandbox`
product.

---

## Reference

| Doc | For |
|---|---|
| `appstore/SUBSCRIPTION_GUIDE.md` | Field-by-field App Store Connect setup, sandbox matrix, review notes |
| `MONETIZATION.md` | Why the model looks like this, and every tuning lever |
| `BUILD_IOS.md` | Xcode / Capacitor build details |
| `appstore/APP_STORE_METADATA.md` | Every metadata field and the screenshot order |
| `.claude/skills/paywall-compliance/SKILL.md` | Audit checklist when you next touch the paywall |
