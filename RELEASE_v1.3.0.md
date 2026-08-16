# Releasing v1.3.0 — what YOU have to do

Everything the repo could do is done. This is the part that needs your hands, your Apple account,
and your iPhone, in the order it has to happen.

**Time:** about 2 hours of your attention, spread over a day, plus 1–3 days waiting on App Review.

`LAUNCH_CHECKLIST.md` is the same path in tick-box form with every field value; this page is the
narrative — what to do, and what happens if you get it wrong. Work from whichever you prefer, but
don't work from `SHIP_READINESS.md` (it describes the old $8.99 model and is marked superseded).

---

## Before you start, three things to know

1. **The build number is the one value that can give the product away.** Anything below 5 is read as
   a paid-era download and grants that device Silicon Pro permanently, free. The CI now refuses to
   build if the number is too low, so this is guarded — but it's why Step 3 exists.
2. **No price may appear in any marketing asset.** Not a screenshot, not the description, not a
   release note. The store charges a localized amount the render can't know, and this app has
   already taken a Guideline 2.3.7 rejection for exactly that. Prices belong in App Store Connect's
   own fields and in the App Review notes, nowhere else.
3. **Do the "make it Free" switch WITH this submission, never before it.** A free build with no
   paywall live is a window where you give the paid game away to everyone who downloads it.

---

## Step 1 — Merge, then check the two legal links (5 min)

The paywall links to `/terms/` and `/privacy/`, and GitHub Pages serves those from `main`. **Until
the merge lands, the Terms link inside your purchase flow is a 404** — the single most common
Guideline 3.1.2 rejection, and reviewers do tap it.

1. Merge the branch into `main`.
2. Wait ~1 minute for Pages to rebuild.
3. Open all three in a browser and confirm they render:
   - `https://wrexist.github.io/Silicon-Tech-Tycoon/`
   - `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`
   - `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/`

If Pages isn't on: repo **Settings → Pages → Deploy from a branch → `main` → `/docs`**.

> I could not check these myself — outbound network to `github.io` is blocked from the build
> environment. This one is genuinely on you.

---

## Step 2 — Prove the Swift compiles (10 min, mostly waiting)

`npm test` covers 1,693 tests and never touches a line of Swift. Three previous releases were burned
on trivial Swift compile errors, which is why the repo has a compile-only job.

This release changes `SiliconStoreKit.swift` and `SiliconStoreKit+RevenueCat.swift` (numeric prices
for the paywall's savings badge, and the subscription-group fix), and **none of it has been
compiled** — there is no Mac in this project's toolchain.

- Opening the PR runs **`iOS build check`** automatically (it triggers on any PR touching `ios/**`).
- Or run it by hand: **Actions → iOS build check → Run workflow** on your branch.

**Wait for it to go green before Step 4.** A failure here costs minutes; the same failure discovered
during the TestFlight archive costs forty.

---

## Step 3 — Upload a build (20 min, mostly waiting)

**Actions → iOS TestFlight (Capacitor) → Run workflow**

- `marketing_version`: `1.3.0`
- `build_number`: **leave blank.** It defaults to the workflow's run number (~69), which is above the
  paid-era line. Only fill this in if the run stops and tells you the counter has reset — in that
  case, enter a number higher than anything already in App Store Connect.
- `submit_testflight`: on

Then wait for TestFlight to finish processing, and **install that build on a real iPhone.** Don't
skip it — Step 5 depends on it, and it's the only place the whole thing is real.

*(If you'd rather archive in Xcode: the project ships `CURRENT_PROJECT_VERSION = 5`, which is legal
but must also be higher than any 1.3.0 build already uploaded. The CI path is simpler.)*

---

## Step 4 — Set up App Store Connect (45 min)

Field-by-field values are in `appstore/SUBSCRIPTION_GUIDE.md` Steps 4–9. The shape of it:

**Products**
- Subscription **group**, reference name `silicon_pro`
- `com.wrexist.silicon.pro.yearly` — $19.99/yr, in the group, ranked above monthly
- `com.wrexist.silicon.pro.monthly` — $3.99/mo, in the group
- **7-day free trial** on **both** (Introductory Offer → Free → 1 week → all countries).
  The paywall says "7 days" out loud; if the store says something else, that's a false claim.
- `com.wrexist.silicon.pro.lifetime` — $29.99, **Non-Consumable**, *not* in the group,
  **Family Sharing ON** — this cannot be switched on later
- Leave the legacy `com.wrexist.silicon.sandbox` **live**. Deleting it breaks restores for everyone
  who bought Creative Mode.

**Two settings that quietly earn or lose money**
- **Billing Grace Period → ON**, longest available. Roughly a third of subscription churn is a
  failed card rather than a decision; with this on, Apple keeps the subscriber entitled while it
  retries, and the app's "there's a problem with your payment" strip has something to fire on.
  Without it they just vanish.
- **Small Business Program** — 15% commission instead of 30%. It is free money and takes a minute.

**Metadata**
- License Agreement URL → `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/`
- Privacy Policy URL → `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`
- App Privacy → **Purchase History + Device ID**, both *app functionality*, both **not linked to the
  user** and **not used for tracking**. This is because RevenueCat processes purchases. It must match
  `ios/App/App/PrivacyInfo.xcprivacy` and `docs/privacy/` exactly — they already agree with each
  other, so just copy the answers across.
- Description and What's New: paste from `appstore/localizations/<locale>/`, **not** from the `.md`
  files in the repo root. All 39 locales are current as of this release.
- Per-subscription **App Review Screenshot**: use `.asc-shots/paywall-full.png` (regenerate with
  `npm run build && node scripts/shoot-paywall-for-asc.mjs`). This is the one field where a price is
  required — it is not a marketing asset.

---

## Step 5 — Sandbox test on the real device (30 min) — this gates submission

The simulator can't do StoreKit sandbox properly. On the iPhone: **Settings → Developer → Sandbox
Apple Account**, sign in with a sandbox tester, then run every row. A product attached to the review
build that can't complete is a Guideline 2.1 rejection.

| Check | What you should see |
|---|---|
| Founding offer after naming the company | Appears once; relaunching doesn't repeat it |
| Prices on the paywall | Localized **from the store** — switch the sandbox region and confirm they change |
| `SAVE 58%` badge on the yearly row | Present, and the number matches the two prices actually shown. If the store didn't return numbers it falls back to `BEST VALUE` — that's correct behaviour, not a bug |
| Buy yearly with a trial | Trial starts, paywall closes, the thing you were reaching for happens |
| Cancel the StoreKit sheet | **Nothing.** No error, no red banner, no toast |
| Buy Pro Lifetime | Completes; the row then shows `OWNED` and can't be bought twice |
| Restore Purchases | Recovers an active subscription or Lifetime on a fresh install |
| Terms of Use / Privacy Policy links | Both open real pages |
| Airplane mode + paywall | Retry card, not a dead buy button |
| Airplane mode + active subscription | Pro still works |
| Settings → Manage subscription | Apple's native sheet opens |

Also worth ten minutes: safe areas on a notch/Dynamic Island device, haptics, no crash when
backgrounded mid-tick, and a save that survives a force-quit.

---

## Step 6 — Submit (10 min)

- Attach **all three** Pro products to the version
- Select the 1.3.0 build you uploaded in Step 3
- **Pricing and Availability → Free** — now, with this submission
- **App Review Information → Notes**: paste the block from `STORE_LISTING.md`. It tells the reviewer
  the app is free, what Pro unlocks, and how to test each purchase. Reviewers reject what they can't
  figure out.
- Submit.

---

## Step 7 — After it's live

- Confirm a real (non-sandbox) purchase completes on the live build
- Ask someone who owns the paid version to update and confirm they're recognised as a **Founding
  Owner** automatically — that cohort is small, already converted, and the most likely to review
  the free launch
- Watch **App Store Connect → Subscriptions** for trial starts and trial→paid conversion. With no
  attribution SDK in the app (deliberately), this and RevenueCat's cohorts are your only read on the
  funnel — see `MONETIZATION.md` § ROAS
- Consider **Win-Back Offers** on both recurring SKUs. Apple surfaces them itself, and the app needs
  no code for it

---

## Still open, and your call

Neither blocks submission:

1. **The app preview video.** `app-store-video/` has the 1.2.0 cut as WebM only, and the committed
   `.mp4` is the 1.1.0 cut. App Store Connect takes `.mov`/`.m4v`/`.mp4`, not WebM, so it needs a
   transcode either way. You can ship without a preview video.
2. **A native-speaker skim of the translated release notes.** All 39 locales now describe the free
   launch; the 38 non-English ones were machine-translated in this pass against the terminology each
   locale's description already used. Nothing in them is a compliance claim, so a clumsy phrase costs
   polish, not a rejection — but your biggest storefronts are worth a read.

---

## If something goes wrong

| Rejection | Almost always |
|---|---|
| 3.1.2 "subscription information" | A dead Terms/Privacy link (check Step 1), or a missing length label |
| 2.1 "purchase did not complete" | A product not attached to the version, or not tested in sandbox |
| 2.3.7 "accurate metadata" | A price in a screenshot or description |
| 2.3.1 | Store copy still describing the old paid model |

`.claude/skills/paywall-compliance/SKILL.md` has the full diagnosis table.
