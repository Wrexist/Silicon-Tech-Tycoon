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

- [ ] PR merged into `main`
- [ ] Waited ~1 minute for Pages to rebuild
- [ ] `https://wrexist.github.io/Silicon-Tech-Tycoon/` loads
- [ ] `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/` loads
- [ ] `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/` loads ← **new page, check it specifically**

If Pages isn't enabled: repo **Settings → Pages → Deploy from a branch → `main` → `/docs`**.

*I could not verify these from the build environment — outbound network to github.io is blocked here.
You have to open them yourself.*

---

## Phase 1 — Verify the build number (2 min, do not skip)

`isFoundingBuild()` grants **permanent free Pro** to anyone whose original download was a build
*below* `FIRST_FREE_BUILD`. Ship a number at or under that line and every new free downloader is
detected as a paid-era customer and gets Pro forever, for nothing.

- [ ] `grep FIRST_FREE_BUILD src/state/pro.ts` → **5**
- [ ] Xcode → target → General → Build → **5**
- [ ] Xcode → Version → **1.3.0**, and `package.json` version matches

Both were set in this PR. You are only confirming nothing drifted.

**Forever after:** increment the build number every release; leave `FIRST_FREE_BUILD` at 5 permanently.

---

## Phase 2 — Store copy (30 min, or a decision)

The old description claimed the game was *"complete and winnable with a single purchase"* and that
Creative Mode was *"the only in-app purchase, ever."* Both are false now. Shipping them next to a
free app with subscriptions is a **Guideline 2.3.1** rejection.

- [ ] `appstore/localizations/en-US/description.txt` — ✅ already rewritten in this PR
- [ ] `appstore/localizations/en-US/release_notes.txt` — ✅ already written for v1.3.0
- [ ] **Decide on the other 38 locales** (they still carry the translated old claim):
  - **Option A** — translate both files into each locale. Safest, ~30–60 min with a translator.
  - **Option B** — ship **en-US only** this release, re-enable other storefronts once translated.
    An inaccurate localized description is a rejection *in that storefront*.
- [ ] `node appstore/localizations/validate.mjs --all` → ✓ for every locale you're shipping

Detail: `appstore/SUBSCRIPTION_GUIDE.md` § Step 2.

---

## Phase 3 — Assets (1–2 h, only if you want them current)

Not blocking, but they are now slightly wrong.

- [ ] **Screenshot 10** is captioned *"Premium. Complete. Yours."* (`10-premium.png`) — reads oddly
      next to a **Free** price. Recaption or replace.
- [ ] Consider one screenshot showing the paywall or the Time Machine — the headline new things.
- [ ] **App preview video:** `app-store-video/` ships the 1.2.0 cut as **WebM only**, and the
      committed `.mp4` is still the **1.1.0** cut. App Store Connect accepts `.mov` / `.m4v` /
      `.mp4` — not WebM — so a transcode is required either way. See `app-store-video/README.md`,
      then watch it through before uploading.

---

## Phase 4 — Build and upload (20 min)

```bash
npm ci && npm test && npm run typecheck && npm run build && npx cap sync ios
```

- [ ] All three green (1631 tests, determinism pin included)
- [ ] Xcode → **Product → Archive → Distribute App → App Store Connect → Upload**
- [ ] TestFlight shows **1.3.0 (5)** and finishes processing
- [ ] Install that TestFlight build on a real iPhone before going further

---

## Phase 5 — App Store Connect (45 min)

Full field-by-field values in `appstore/SUBSCRIPTION_GUIDE.md` Steps 4–9. Summary:

### 5a — Products
- [ ] **Pricing and Availability → Free** (do this *with* this submission, not before — a free build
      with no paywall live is a window where you give the paid game away)
- [ ] Subscription **group** created, identifier exactly **`silicon_pro`**
      *(a mismatch here means subscribers pay and get nothing — verify the spelling)*
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
- [ ] License Agreement URL → `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/`
- [ ] Privacy Policy URL → `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`
- [ ] Support URL live
- [ ] Categories: **Simulation** (primary), **Strategy** (secondary)
- [ ] Age rating → **4+**
- [ ] App Privacy → **Data Not Collected** (still true — StoreKit 2 direct, no third-party SDKs)
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
- [ ] Build 1.3.0 (5) selected
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
