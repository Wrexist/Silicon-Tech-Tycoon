# Silicon Pro — App Store Connect setup

Everything you have to do **outside the code** to ship the free-to-download build with the Silicon
Pro subscription. The code side is already done; this is the half only you can do.

For *why* the model looks like this — the free/Pro line, pricing rationale, the levers — read
[`MONETIZATION.md`](../MONETIZATION.md). For the legacy Creative Mode IAP see
[`IAP_GUIDE.md`](./IAP_GUIDE.md) (it stays live for the people who bought it; you no longer sell it).
Purchases now run through RevenueCat — its dashboard config, the Xcode SPM steps, the sandbox matrix
and the App Privacy answers are in [`REVENUECAT_SETUP.md`](./REVENUECAT_SETUP.md).

> **The single rule that causes rejections here:** if a product is *attached to the review build*,
> App Review will tap it, and it must complete. Never attach a SKU you haven't tested in sandbox.

---

## The whole thing, in order

Work top to bottom — the numbers below match the section headings exactly. Steps 0–3 are repo and
Xcode work; 4–9 are App Store Connect; 10 is the device test that gates submission; 11 is submit.
Nothing here is optional.

| # | Step | Where | Done when |
|---|---|---|---|
| 0 | Merge the PR and let GitHub Pages rebuild | GitHub | `/terms/` loads in a browser |
| 1 | Confirm the build number vs `FIRST_FREE_BUILD` | Xcode + `pro.ts` | Both read **5** |
| 2 | Update the App Store description + release notes | `appstore/localizations/` | Validator passes, no "single purchase" claim left |
| 3 | Build and upload | Xcode | Build 5 (1.3.0) processed in TestFlight |
| 4 | Set the app price to **Free** | ASC → Pricing | Price schedule shows Free |
| 5 | Create the subscription **group** | ASC → Monetization → Subscriptions | Group id is exactly `silicon_pro` |
| 6 | Create the two auto-renewable subscriptions | ASC → inside that group | Monthly + Yearly both "Ready to Submit" |
| 7 | Add the 7-day free trials | ASC → each recurring SKU | Introductory Offer on both |
| 8 | Create Pro Lifetime (Non-Consumable) | ASC → In-App Purchases | Family Sharing ON |
| 9 | Legal links + billing grace period | ASC → Description + App Information | EULA link in the description, URLs load, grace period ON |
| 10 | **Sandbox-test every row on a real device** | iPhone | Every row in the Step 10 table passes |
| 11 | Attach all three products, paste review notes, submit | ASC | Submitted |

Then read the **Go / no-go** checklist at the bottom before you actually hit Submit.

After launch: win-back offers — highest return per hour, and needs no code.

---

## Key facts

| Thing | Value |
|---|---|
| App price | **Free** (changed in App Store Connect → Pricing) |
| Subscription group | **`silicon_pro`** — reference name *Silicon Pro* |
| Yearly SKU | `com.wrexist.silicon.pro.yearly` — **$19.99/year**, 7-day free trial |
| Lifetime SKU | `com.wrexist.silicon.pro.lifetime` — **$29.99**, Non-Consumable (⚠ **not** in the group) |
| Monthly SKU | `com.wrexist.silicon.pro.monthly` — **$3.99/month**, 7-day free trial |
| Legacy SKU | `com.wrexist.silicon.sandbox` — keep live, **stop offering**; honoured forever |
| Code seam | `src/state/pro.ts` (products) · `src/state/proStore.ts` (store) · `src/components/Paywall.tsx` (UI) |
| Kill switch | `NATIVE_PRO_WIRED` at the top of `proStore.ts` — ships **`true`** |
| Native plugin | `ios/App/App/SiliconStoreKit.swift` — StoreKit 2, wrapped by RevenueCat's native iOS SDK (`SiliconStoreKit+RevenueCat.swift` · `RevenueCatConfig.swift`); setup in `REVENUECAT_SETUP.md` |
| First free build | `FIRST_FREE_BUILD` in `pro.ts` — **must equal the CFBundleVersion you ship free** |

⚠ **The group id `silicon_pro` must match `PRO_SUBSCRIPTION_GROUP` in `pro.ts` exactly.** If it
doesn't, `subscriptionStatus` returns nothing, every subscriber's purchase resolves to "no
subscription", and they pay without getting Pro. Verify this against the live dashboard before every
pricing change.

---

## Step 0 — Merge first, then wait for GitHub Pages

**Do this before anything else.** The paywall links to
`https://wrexist.github.io/Silicon-Tech-Tycoon/terms/`, and that page only exists on this branch.
GitHub Pages serves from `main`, so **until the PR is merged the Terms link is a 404** — and a dead
legal link in the purchase flow is the single most common Guideline 3.1.2 rejection.

1. Merge the PR into `main`.
2. Wait ~1 minute for Pages to rebuild.
3. Open all three in a browser and confirm they load:
   - `https://wrexist.github.io/Silicon-Tech-Tycoon/`
   - `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`
   - `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/`

If Pages isn't enabled yet: repo **Settings → Pages → Deploy from a branch → `main` → `/docs`**
(see `docs/README.md`).

---

## Step 1 — Confirm the build number matches `FIRST_FREE_BUILD`

**This is the most expensive thing on this page to get wrong.** `isFoundingBuild()` grants permanent
free Pro to anyone whose ORIGINAL download was a build *below* `FIRST_FREE_BUILD`. If the free build
ships with a number at or below that line, **every new free downloader is detected as a paid-era
customer and gets Pro forever, for nothing.**

Already done in this PR — just verify both still read **5**:

| Where | Value | Check |
|---|---|---|
| `ios/App/App.xcodeproj` → `CURRENT_PROJECT_VERSION` | `5` | Xcode → target → General → Build |
| `src/state/pro.ts` → `FIRST_FREE_BUILD` | `5` | `grep FIRST_FREE_BUILD src/state/pro.ts` |

The paid era shipped builds **1–4** (1.0.3→2, 1.1.0→3, 1.2.0→4), so 5 is the first free build.
Marketing version is now **1.3.0**.

**Rules from here on:** never lower `FIRST_FREE_BUILD`, and never ship a build number below it. Every
future build just increments `CURRENT_PROJECT_VERSION` and leaves `FIRST_FREE_BUILD` at 5 forever.

> **Grandfathering is production-only, by design.** `AppTransaction.originalAppVersion` reports
> `"1.0"` on *every* sandbox and TestFlight install, which would parse to build 1 and read as a
> paid-era owner — giving free Pro to every tester and making the paywall untestable on the builds
> you most need to test it on. `originalPurchase()` therefore only reports a build number when the
> receipt's environment is production. Consequence for you: **you cannot verify Founding Owner in
> sandbox or TestFlight.** Verify it after release against a real paid-era Apple ID — it is a
> week-one item in `LAUNCH_CHECKLIST.md` Phase 8.
A test enforces the floor (≥ 5) but cannot know your actual Xcode build number — that's this step.

---

## Step 2 — Fix the store copy (a rejection risk if you skip it)

The old description told users the game was *"complete and winnable with a single purchase"* and that
Creative Mode was *"the only in-app purchase, ever."* Both are now false. Shipping that alongside a
free app with subscriptions is a **Guideline 2.3.1 (accurate metadata)** rejection.

**English is already rewritten** in this PR:
- `appstore/localizations/en-US/description.txt` — final section now describes the free tier and
  Silicon Pro honestly.
- `appstore/localizations/en-US/release_notes.txt` — new v1.3.0 notes.

**✅ Done: all 38 other locales.** Every `appstore/localizations/*/description.txt` used to end with a
translated "single purchase / only in-app purchase, ever" claim. All 38 now end with the same two
sections as en-US — a free-to-play section (each locale's own "no ads / no timers / no currencies"
list, then the Garage + Growth eras free with a daily challenge, offline) and a **SILICON PRO**
section (the Pro eras/modes, monthly or yearly with a trial, Pro Lifetime as the one-time option,
and "nothing you can buy changes the simulation in your favour"). No description names a price.

```bash
node appstore/localizations/validate.mjs --all   # ✓ for all 39
```

**⚠ Still to do: `release_notes.txt` in the other 38 locales** still carries the v1.2.0 body. It makes
no purchase claim, so it is stale rather than inaccurate — but "What's New" not mentioning that the
app went free is a wasted slot in 38 storefronts. Translate `en-US/release_notes.txt` when you can.

**✅ Done: screenshot 10.** It advertised *"$8.99 once"*, which is what got 1.3.1 rejected under
**Guideline 2.3.7 (Accurate Metadata)** — the app is a free download with a subscription. It now
reads *"Free to play. No dark patterns."* over a line about Pro being optional. **Never put a price in
a screenshot**: the render cannot know the localized amount StoreKit charges, and it becomes a false
claim the moment the model moves. See `appstore/APP_STORE_METADATA.md` §11.

---

## Step 3 — Build and upload

`npm run build && npx cap sync ios`, then Xcode → **Product → Archive → Distribute App**. Confirm
TestFlight shows **1.3.0 (5)** before continuing.

---

## Step 4 — Make the app free

App Store Connect → your app → **Pricing and Availability** → Price Schedule → **Free**.

Do this **with** the free build's submission, not before: a free app with no paywall shipped is a
window where you're giving the paid game away.

---

## Step 5 — Create the subscription group

**Monetization → Subscriptions → Create** a group:

- **Reference Name:** `Silicon Pro`
- **Group identifier:** must be **`silicon_pro`** (see the warning above)
- **Localized group display name:** `Silicon Pro` — this is what users see in
  Settings → Subscriptions when they cancel. Add it for every locale you ship.

Both recurring SKUs go in this group. That makes monthly↔yearly a **crossgrade** (Apple prorates)
rather than a double charge, and means the 7-day trial is claimable **once per Apple ID per group** —
which is exactly why the paywall asks the store for eligibility instead of assuming.

---

## Step 6 — Create the two auto-renewable subscriptions

For each, inside the `silicon_pro` group:

### Pro Yearly
| Field | Value |
|---|---|
| Product ID | `com.wrexist.silicon.pro.yearly` |
| Reference Name | `Silicon Pro Yearly` |
| Duration | **1 Year** |
| Price | **$19.99** (USD base; let Apple auto-fill other storefronts) |
| Display Name | `Silicon Pro Yearly` |
| Description | `Unlock the Platform and AI eras, every scenario, New Game+, Ascension, Creative Mode, the Vault and the Museum. Renews yearly.` |

### Pro Monthly
| Field | Value |
|---|---|
| Product ID | `com.wrexist.silicon.pro.monthly` |
| Reference Name | `Silicon Pro Monthly` |
| Duration | **1 Month** |
| Price | **$3.99** |
| Display Name | `Silicon Pro Monthly` |
| Description | `Unlock the Platform and AI eras, every scenario, New Game+, Ascension, Creative Mode, the Vault and the Museum. Renews monthly.` |

**Rank the group** so Yearly is the higher service level. Apple uses rank to decide what counts as an
upgrade vs. a downgrade.

---

## Step 7 — Add the free trials

For **each** recurring SKU → **Subscription Prices → Introductory Offers → Create**:

- Type: **Free**
- Duration: **1 week**
- Countries: **all**
- No end date

> ⚠ `FREE_TRIAL_DAYS = 7` in `pro.ts` drives the paywall copy ("Start my 7 days free trial", "no
> payment due now"). **The store performs the actual trial.** If App Store Connect says 3 days and
> the code says 7, the paywall is making a false claim — a Guideline 3.1.2 rejection. Change both
> together, store first.

If you decide **not** to offer trials, set `hasTrial: false` on both products in `pro.ts`. The
paywall drops all trial framing automatically; it never invents a trial the store didn't confirm.

---

## Step 8 — Create the Lifetime purchase

**Monetization → In-App Purchases → Create → Non-Consumable.** *Not* inside the subscription group —
it is a one-time purchase, not a subscription tier.

| Field | Value |
|---|---|
| Product ID | `com.wrexist.silicon.pro.lifetime` |
| Reference Name | `Silicon Pro Lifetime` |
| Price | **$29.99** |
| Display Name | `Silicon Pro Lifetime` |
| Description | `Everything in Silicon Pro, permanently. A one-time purchase — it never renews.` |
| **Family Sharing** | **On** (it's non-consumable, and turning it on later is not retroactive) |

---

## Step 9 — Legal links and the billing grace period

Guideline 3.1.2 wants the Terms of Use (EULA) and the Privacy Policy in **three** places, and they
are three separate jobs. Miss the first one and the submission is rejected by an automated check
before a human opens the build — that is what happened to 1.3.0 (build 70), see
[`REJECTION_3.1.2_EULA.md`](./REJECTION_3.1.2_EULA.md).

**1. In the App Description text itself — the one that gets you rejected.**
The last two lines of every localized description are:

```text
Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/
```

That first URL is **Apple's standard EULA**, which is what this app uses. `validate.mjs` fails any
locale whose description loses either line, so pasting from `appstore/localizations/` is enough —
just don't hand-edit them out in App Store Connect. (If you ever switch to a *custom* EULA, you must
instead paste its full text into ASC → App Information → **License Agreement**, and swap the URL in
all 39 descriptions to `…/Silicon-Tech-Tycoon/terms/`.)

**2. In App Store Connect's own fields.** App Information → **Privacy Policy URL** →
`https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`. There is no EULA *URL* field — the
License Agreement section only offers Apple's standard agreement or a pasted custom one, which is
why job 1 exists.

**3. In the purchase flow.** Already done: `TERMS_URL` / `PRIVACY_URL` in `Paywall.tsx` render as
links under the buy buttons. The paywall points at the app's own `/terms/` page, which restates the
subscription terms in plain language — that is allowed alongside the standard EULA, and it is the
page a player actually reads.

**Confirm every URL loads before submitting** — GitHub Pages must be enabled on `/docs` (see
`docs/README.md`). A dead legal link is a rejection, and it's the most common one.

If you use a custom domain later, update the two constants in `Paywall.tsx`, the privacy URL in all
39 descriptions, and `EULA_URL` / `PRIVACY_URL` in `appstore/localizations/validate.mjs` at the same
time.

### Turn the billing grace period ON — same screen, don't skip it

App Store Connect → **App Information → Billing Grace Period → On** (pick the longest available).

Roughly a third of subscription churn is involuntary: an expired card, a declined charge. With a
grace period Apple keeps the subscriber entitled while it retries for up to 60 days, and the app
already detects it (`inGracePeriod`) and shows a quiet "there's a problem with your payment" strip
that opens the manage-subscription sheet. **Without it turned on, those subscribers silently lose
access and churn** — and the strip the app ships has nothing to fire on.

---

## Step 10 — Test in sandbox before you attach anything

On a real device (the simulator can't do StoreKit sandbox properly):

1. Settings → Developer → **Sandbox Apple Account** → sign in with a sandbox tester.
2. Install a TestFlight or debug build and run through **every** row:

| Check | Expected |
|---|---|
| Founding offer appears after naming the company | Yes, once. Killing and reopening the app doesn't repeat it |
| Prices | **Localized from the store**, not `$19.99` hardcoded — switch the sandbox account's region to confirm |
| "Includes a 7 days free trial" | Only on the recurring rows, only while the tester is eligible |
| Buy Yearly | Sheet appears → confirm → paywall closes → gated content unlocks immediately |
| **Cancel the sheet** | **No error banner.** Nothing is granted, nothing is said |
| Restore Purchases (paywall + Settings) | Recovers the subscription on a fresh install |
| Settings → Manage subscription | Opens Apple's native sheet |
| Airplane mode → open paywall | "The store didn't answer" retry card, **not** a buy button |
| Airplane mode with an active sub | Pro still works — it must not lapse offline |
| Era-3 wall | Free: opens the paywall. After subscribing: continues **into the era ceremony** |
| Lifetime after purchase | Row shows `OWNED` and can't be bought twice |

Sandbox subscriptions renew on an accelerated clock (1 month ≈ 5 minutes, 1 year ≈ 1 hour), which is
also how you test the lapse path: let one expire and confirm gates re-lock.

---

## Step 11 — Submit

1. Attach **all three** products to the version.
2. **App Review Information → Notes** — paste something like:

   > Silicon: Tech Tycoon is free to download and free to play. The full design → launch → market
   > loop, the Garage and Growth eras, and a daily challenge are available without any purchase and
   > without ads or timers.
   >
   > Silicon Pro (auto-renewable, monthly or yearly, with a 7-day free trial, or a one-time Lifetime
   > purchase) unlocks additional game content: the Platform and AI eras, all scenarios, New Game+,
   > Ascension, the Platform Division, Creative Mode, the Vault and the Device Museum. Nothing
   > purchasable changes the simulation in the player's favour — Pro unlocks content and modes only.
   >
   > The paywall appears once after onboarding (skippable) and at the specific locked features. It
   > shows each plan's title, length and billed price, links to Terms of Use and Privacy Policy, and
   > offers Restore Purchases. Manage/cancel is reachable from Settings → Silicon Pro → Manage
   > subscription.
   >
   > The app has no accounts, no login, no analytics and no tracking, and the game's saves stay on
   > the device. Purchases use StoreKit 2 through RevenueCat, which is why App Privacy declares
   > Purchase History and an anonymous Device ID — both app functionality, neither linked to the
   > user nor used for tracking.
   >
   > This app was previously a paid download. Customers who purchased it are detected via
   > AppTransaction and granted permanent access at no cost ("Founding Owner").

3. Submit. If the paywall is rejected, the fix is almost always one of: a dead legal link, a price
   that isn't the most prominent element on its row, a missing subscription length, or a trial
   presented as a toggle. All four are already handled — but re-check the live pages.

---

## Win-back offers (after launch, no code required)

Once you have your first churned subscribers, configure **Win-Back Offers** on each recurring SKU
(App Store Connect → the subscription → Win-Back Offers → Create). Apple decides eligibility and
surfaces the offer on your product page, on the user's Subscriptions page, and in the App Store —
**with no app changes at all**. Reported recovery from properly-handled lapsed subscribers runs
15–20% of otherwise-lost revenue, which makes this the highest return-per-hour item on this page.

The app already does its half: someone who has subscribed on this device before gets a *Welcome
back* paywall instead of the first-time sales pitch (`RETURNING_COPY`). It deliberately claims **no
discount** — if you configure a win-back price, StoreKit's own sheet shows it, and our UI never
states a price the store didn't give us.

*(Optional, later: iOS 18's `Product.PurchaseOption.winBackOffer` can present the offer inside the
app's own purchase flow too. Not wired — the store-side version needs no code and carries no risk of
showing an ineligible user a price they can't have.)*

## Go / no-go — the last read before you hit Submit

Every line here is a real rejection or a real revenue leak. None are theoretical.

**Will lose money if wrong**
- [ ] Xcode build number is **5**, `FIRST_FREE_BUILD` is **5** (Step 1)
- [ ] App price set to **Free** — and set *with* this submission, not before
- [ ] Billing grace period **ON**
- [ ] Legacy `com.wrexist.silicon.sandbox` still live in ASC (deleting it breaks restores)

**Will get rejected if wrong**
- [ ] `/terms/` and `/privacy/` both load in a browser *right now* (Step 0)
- [ ] **Every localized description ends with the Terms of Use (EULA) + Privacy Policy lines**
      (`node appstore/localizations/validate.mjs --all` passes — it now checks this)
- [ ] Privacy Policy URL filled in under App Information
- [ ] Description no longer claims "single purchase" or "only in-app purchase, ever" (Step 2)
- [ ] All three products attached to the version, and all three tested in sandbox (Step 10)
- [ ] App Review notes pasted (Step 11)
- [ ] App Privacy declares **Purchase History + Device ID** (app functionality, not linked, not used
      for tracking) and matches `PrivacyInfo.xcprivacy` and `docs/privacy/` — see `REVENUECAT_SETUP.md`

**Confirmed on a device, not assumed**
- [ ] Prices shown are the store's localized strings, not `$19.99` from the fallback
- [ ] Cancelling the StoreKit sheet shows **no** error
- [ ] Airplane mode + active subscription ⇒ Pro still works
- [ ] Restore recovers the subscription on a fresh install

**Repo state**
- [ ] `npm test` green (determinism pin included), `npm run typecheck` clean
- [ ] `node appstore/localizations/validate.mjs --all` prints ✓ for every locale you are shipping

---

## After launch

- **Don't delete the legacy Creative Mode IAP.** Removing it can break restores for people who own
  it. Leave it live and simply never offer it again (the app already doesn't).
- **Watch App Store Connect → Subscriptions** for trial→paid conversion and churn. There is no
  in-app analytics by design (see `MONETIZATION.md` §9), so this is your only instrument.
- **Before any price change:** change it in App Store Connect first, let it propagate, then update
  the fallbacks in `pro.ts`. Existing subscribers keep their price unless you explicitly opt them
  into the new one — Apple will ask.
