# Silicon Pro — App Store Connect setup

Everything you have to do **outside the code** to ship the free-to-download build with the Silicon
Pro subscription. The code side is already done; this is the half only you can do.

For *why* the model looks like this — the free/Pro line, pricing rationale, the levers — read
[`MONETIZATION.md`](../MONETIZATION.md). For the legacy Creative Mode IAP see
[`IAP_GUIDE.md`](./IAP_GUIDE.md) (it stays live for the people who bought it; you no longer sell it).

> **The single rule that causes rejections here:** if a product is *attached to the review build*,
> App Review will tap it, and it must complete. Never attach a SKU you haven't tested in sandbox.

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
| Native plugin | `ios/App/App/SiliconStoreKit.swift` — StoreKit 2, **no third-party SDK** |
| First free build | `FIRST_FREE_BUILD` in `pro.ts` — **must equal the CFBundleVersion you ship free** |

⚠ **The group id `silicon_pro` must match `PRO_SUBSCRIPTION_GROUP` in `pro.ts` exactly.** If it
doesn't, `subscriptionStatus` returns nothing, every subscriber's purchase resolves to "no
subscription", and they pay without getting Pro. Verify this against the live dashboard before every
pricing change.

---

## Step 0 — Set `FIRST_FREE_BUILD` before you build

1. In Xcode, note the build number you're about to ship (`CURRENT_PROJECT_VERSION`). The paid era
   shipped builds **1–4**, so the first free build must be **5 or higher**.
2. Set `FIRST_FREE_BUILD` in `src/state/pro.ts` to that number.
3. Never lower it afterwards.

Getting this wrong is silent and expensive in both directions: too low strips Pro from customers who
paid $8.99, too high hands Pro to every new free download. A test enforces the floor (≥ 5) but
cannot know your actual build number.

---

## Step 1 — Make the app free

App Store Connect → your app → **Pricing and Availability** → Price Schedule → **Free**.

Do this **with** the free build's submission, not before: a free app with no paywall shipped is a
window where you're giving the paid game away.

---

## Step 2 — Create the subscription group

**Monetization → Subscriptions → Create** a group:

- **Reference Name:** `Silicon Pro`
- **Group identifier:** must be **`silicon_pro`** (see the warning above)
- **Localized group display name:** `Silicon Pro` — this is what users see in
  Settings → Subscriptions when they cancel. Add it for every locale you ship.

Both recurring SKUs go in this group. That makes monthly↔yearly a **crossgrade** (Apple prorates)
rather than a double charge, and means the 7-day trial is claimable **once per Apple ID per group** —
which is exactly why the paywall asks the store for eligibility instead of assuming.

---

## Step 3 — Create the two auto-renewable subscriptions

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

## Step 4 — Add the free trials

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

## Step 5 — Create the Lifetime purchase

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

## Step 6 — Legal URLs (required, and reviewers do tap them)

**App Information:**
- **License Agreement URL** → `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/`
- **Privacy Policy URL** → `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`

Both are also linked **inside the paywall** (`TERMS_URL` / `PRIVACY_URL` in `Paywall.tsx`) because
Guideline 3.1.2 requires them in the purchase flow, not only in the metadata. **Confirm both load
before submitting** — GitHub Pages must be enabled on `/docs` (see `docs/README.md`). A dead link
here is a rejection, and it's the most common one.

If you use a custom domain later, update the two constants in `Paywall.tsx` at the same time.

---

## Step 7 — Test in sandbox before you attach anything

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

## Step 8 — Submit

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
   > The app collects no data and contains no third-party SDKs. Purchases use StoreKit 2 directly.
   >
   > This app was previously a paid download. Customers who purchased it are detected via
   > AppTransaction and granted permanent access at no cost ("Founding Owner").

3. Submit. If the paywall is rejected, the fix is almost always one of: a dead legal link, a price
   that isn't the most prominent element on its row, a missing subscription length, or a trial
   presented as a toggle. All four are already handled — but re-check the live pages.

---

## After launch

- **Don't delete the legacy Creative Mode IAP.** Removing it can break restores for people who own
  it. Leave it live and simply never offer it again (the app already doesn't).
- **Watch App Store Connect → Subscriptions** for trial→paid conversion and churn. There is no
  in-app analytics by design (see `MONETIZATION.md` §9), so this is your only instrument.
- **Before any price change:** change it in App Store Connect first, let it propagate, then update
  the fallbacks in `pro.ts`. Existing subscribers keep their price unless you explicitly opt them
  into the new one — Apple will ask.
