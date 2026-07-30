# RevenueCat — setup, migration, and verification

Everything a human has to click, in order, to take Silicon: Tech Tycoon's purchases from direct
StoreKit 2 to RevenueCat. Written to be followed without judgement calls: where a step has a real
decision in it, the decision is stated and the recommended answer is given.

Companion docs: `appstore/SUBSCRIPTION_GUIDE.md` (App Store Connect product setup — do that first),
`MONETIZATION.md` (the model), `LAUNCH_CHECKLIST.md` (the release runbook).

**Nothing in this document changes prices, what any tier includes, or the free/Pro line.** This is a
backend swap behind a stable interface. If a step starts changing what the player can buy, it has
gone out of scope.

---

## 0. What was decided, and why it looks like this

The obvious route — install `@revenuecat/purchases-capacitor` — **is not available to this project**,
and it is worth knowing why before someone tries it again in six months.

| | Evidence |
|---|---|
| This app is on **Capacitor 6.2.1** | `package.json` |
| Its iOS target is **Swift Package Manager only** | `ios/App/CapApp-SPM/Package.swift`, no `Podfile` anywhere |
| The Capacitor-6 line of the plugin is **9.x** (latest `9.2.2`) | `peerDependencies: { "@capacitor/core": "^6.0.0" }` |
| `9.2.2` ships **only** `RevenuecatPurchasesCapacitor.podspec` — **no `Package.swift`** | the published npm tarball |
| The first version that ships `Package.swift` is **12.0.0** | the published npm tarballs (11.1.0 has none, 12.0.0 has one) |
| `12.0.0` requires **Capacitor ≥ 8** | `peerDependencies: { "@capacitor/core": ">=8.0.0" }` |

So the official plugin means either introducing CocoaPods to an SPM-only project, or upgrading two
Capacitor majors. Both are large, risky, and entirely unrelated to RevenueCat.

**What we did instead:** added RevenueCat's *native iOS SDK* — which is SPM-native, targets iOS 13+
(comfortably under this app's 15.0), and pulls no runtime third-party dependencies — and wrapped it
inside the Capacitor plugin that already exists. The JavaScript seam
(`src/state/storeKitBridge.ts`) did not move, so `proStore.ts`, `proGates.ts` and `Paywall.tsx` are
untouched by the migration.

```
  Paywall.tsx / proGates.ts          ← unchanged
        ↓
  proStore.ts                        ← unchanged
        ↓
  storeKitBridge.ts   ★ THE SEAM ★   ← interface unchanged
        ↓
  SiliconStoreKit.swift              ← routes on RevenueCatConfig.backend
        ├── StoreKit 2 (kept intact, still the default)
        └── SiliconStoreKit+RevenueCat.swift  ← the new adapter
```

**The fail-safe.** Two things must BOTH be true before a single call reaches RevenueCat: the
`RevenueCat` module must be importable, and a non-empty public API key must be configured. Until
then the app behaves exactly as it does today. That is why this code can land on `main` before the
dashboard exists.

---

## 0b. WHAT IS ALREADY DONE

The dashboard was configured on **29 July 2026**. You do not need to redo §2–§5 — they are kept as a
record of what was set and why. Verify against this table if anything ever looks wrong:

| Thing | Value |
|---|---|
| RevenueCat project | `Silicon: Tech Tycoon` — id `78cb2b78` |
| App configuration | `Silicon: Tech Tycoon (App Store)` — id `app706e1b1a3d` |
| Bundle ID | `com.wrexist.silicon` |
| In-App Purchase key | `75QF6982M6` — **reused** from Dynasty Manager iOS |
| App Store Connect API key | `6G4R6WL94Y` — **reused** from Dynasty Manager iOS |
| Issuer ID | `47a0adf3-7006-447c-8543-48214a1a243d` |
| Products | all 4 **imported from App Store Connect**, not hand-typed |
| Entitlement | `pro` ("Silicon Pro") → yearly + monthly + lifetime. **Creative Mode NOT attached** |
| Offering | `default` ("Silicon Pro plans") → `$rc_annual`, `$rc_monthly`, `$rc_lifetime` |
| Public SDK key | `appl_jsQcYdrdXfaErHQdTjnUbKvqOVT` — already in `RevenueCatConfig.swift` |
| Xcode SPM package | Added directly to `project.pbxproj` (script, not the Xcode GUI — see §6). `RevenueCat` product, pinned `>= 5.81.3`, up to next major |

**Why the keys were reused rather than generated.** Both existing keys carry the same Issuer ID, so
they belong to the same Apple Developer account as this app — an App Store Connect key is
account-wide, not per-app. Reusing one avoided generating and handling a fresh `.p8` secret, and it
sidesteps the RevenueCat incident that was live that day ("Newly created apps error with *The key is
not valid or is not compatible with the Bundle ID of your app*"), which affects freshly-uploaded
keys. The App Store Connect key was proved working immediately: the product import below succeeded
and returned all four real product identifiers.

### Left deliberately unset

| Field | Why |
|---|---|
| **App-specific shared secret** | Legacy. Superseded by the In-App Purchase key under StoreKit 2. Set it only if you later downgrade to StoreKit 1. |
| **Vendor number** | Only affects RevenueCat's financial-report reconciliation. Find it top-left of App Store Connect → Payments and Financial Reports if you want charts to reconcile to the cent. |
| **Apple Small Business Program start date** | Only affects net-revenue maths in Charts. Set it to your enrolment date if you are enrolled — otherwise RevenueCat assumes the 30% rate and understates your net. |
| **Webhooks / integrations** | Nothing is required. See §9. |

### ⚠️ One thing found that blocks selling — fix this in App Store Connect

The product import reported the live App Store Connect state of each product:

| Product | State |
|---|---|
| `com.wrexist.silicon.sandbox` | ✅ Approved |
| `com.wrexist.silicon.pro.monthly` | ⚠️ **Missing Metadata** |
| `com.wrexist.silicon.pro.yearly` | ⚠️ **Missing Metadata** |
| `com.wrexist.silicon.pro.lifetime` | ⚠️ **Missing Metadata** |

"Missing Metadata" means those three are **not submittable and not sellable**. Apple typically wants
a localized display name and description, a price, and — for the first subscription submitted — a
review screenshot and review notes. This is unrelated to RevenueCat and would have blocked the
launch either way. Fix it in App Store Connect → your app → **Subscriptions** / **In-App Purchases**
before device testing (§11), because a product in that state will not return a price and every row
will render as unavailable.

---

## 1. Before you start

- [ ] App Store Connect already has all four products live or in "Ready to Submit"
      (`appstore/SUBSCRIPTION_GUIDE.md` steps 1–6). RevenueCat imports them; it does not create them.
- [ ] You can sign in to App Store Connect with an **Account Holder** or **Admin** role — step 3
      below needs to generate a key, and only those roles can.
- [ ] `npm test` and `npm run typecheck` are green on your branch.

---

## 2. Create the RevenueCat project

1. Go to <https://app.revenuecat.com> and sign up / sign in.
2. **Create new project** → name it `Silicon: Tech Tycoon`.
3. In the project, **Apps → + New → App Store**.
4. **App name:** `Silicon: Tech Tycoon`. **App bundle ID:** `com.wrexist.silicon`
   *(confirm against `capacitor.config.ts` → `appId` before typing it — a typo here produces an app
   that silently never matches a receipt).*
5. Save.

---

## 3. Connect App Store Connect (this is what makes validation server-side)

RevenueCat needs to talk to Apple on your behalf. Two credentials:

1. **In-App Purchase Key.** App Store Connect → **Users and Access → Integrations → In-App
   Purchase** → **+** → name it `RevenueCat` → **Generate**. Download the `.p8` **once** (Apple will
   not show it again) and note the **Key ID** and **Issuer ID**.
2. In RevenueCat → your App Store app → **App Store Connect API** → upload the `.p8`, paste the Key
   ID and Issuer ID.
3. **App-Specific Shared Secret.** App Store Connect → your app → **App Information → App-Specific
   Shared Secret** → generate/reveal → paste it into RevenueCat's **App Store Shared Secret** field.
   *(Still required for legacy receipt validation. Set it even though the key above exists.)*

> ⚠️ The `.p8` file and the shared secret are **secrets**. They live in App Store Connect and
> RevenueCat and nowhere else. They must never be committed to this repo, pasted into an issue, or
> put in an `Info.plist`. The only RevenueCat credential that belongs in the app is the **public**
> SDK key from step 4 — public keys are designed to be embedded in clients.

---

## 4. Get the public SDK key

1. RevenueCat → **API Keys** (project settings) → copy the **public** Apple key. It starts `appl_`.
2. Put it in the app. Preferred — as configuration, not code:
   - Xcode → `App/Info.plist` → add a row, key `RevenueCatPublicAPIKey`, type String, value the
     `appl_…` key.
   - Alternatively set `builtInPublicAPIKey` in `ios/App/App/RevenueCatConfig.swift`.
3. **Until this key is set, the app keeps using StoreKit 2.** That is deliberate. It is also the
   fastest way to test the fail-safe: build with no key, confirm purchases still work.

---

## 5. Register the products and the entitlement

**Products** — RevenueCat → **Product catalog → Products → + New**. Add all four, exactly:

| Product ID | Type |
|---|---|
| `com.wrexist.silicon.pro.yearly` | Auto-renewable subscription |
| `com.wrexist.silicon.pro.monthly` | Auto-renewable subscription |
| `com.wrexist.silicon.pro.lifetime` | Non-consumable |
| `com.wrexist.silicon.sandbox` | Non-consumable |

`com.wrexist.silicon.sandbox` is the **legacy Creative Mode unlock**. It is no longer sold. It is
registered here so that people who bought it during the paid era can still restore it. **Never
delete it from anywhere.**

**Entitlement** — RevenueCat → **Product catalog → Entitlements → + New**:

- Identifier: **`pro`** *(exactly this — it is hardcoded as `RevenueCatConfig.entitlementIdentifier`)*
- Description: `Silicon Pro`
- Attach: `com.wrexist.silicon.pro.yearly`, `com.wrexist.silicon.pro.monthly`,
  `com.wrexist.silicon.pro.lifetime`
- **Do NOT attach `com.wrexist.silicon.sandbox`.**

> **The one real product decision here, and its answer.** Attaching the legacy `$2.99` sandbox unlock
> to `pro` would hand every past buyer of that IAP the full Pro catalogue — all eras, all scenarios,
> New Game+, Ascension, the Vault, the Museum, everything — free and forever. Today it grants
> **Creative Mode only**. Widening it is a generous, irreversible giveaway, not a migration step, and
> it is not what this migration does. The decision taken was: **keep it Creative Mode only.** The
> app enforces that independently anyway — `src/state/entitlements.ts` owns the Creative Mode grant
> and the RevenueCat adapter never touches it — so this is belt and braces.

**Offering** — RevenueCat → **Product catalog → Offerings → + New**:

- Identifier: `default` · mark it **Current**
- Packages: `$rc_annual` → yearly · `$rc_monthly` → monthly · `$rc_lifetime` → lifetime

The app does **not** read Offerings yet — it fetches products by identifier, exactly as it always
has. Create the Offering anyway: it costs nothing now and it is the prerequisite for remote price
changes and A/B tests later. See §10.

---

## 6. Add the SDK to Xcode — DONE, and done without a Mac

> ⚠️ **Do NOT add RevenueCat to `ios/App/CapApp-SPM/Package.swift`.** That file says
> `DO NOT MODIFY THIS FILE - managed by Capacitor CLI` and it means it: `npx cap sync ios`
> regenerates it from installed npm plugins and will erase your edit. RevenueCat's native SDK is not
> a Capacitor plugin, so it belongs to the **app target**, where `cap sync` never looks.

This step is normally done by clicking through Xcode's "Package Dependencies" UI — which needs a
Mac. There's no Mac in this project's toolchain, so it was done a different way: **the same package
reference Xcode would write was added directly to `ios/App/App.xcodeproj/project.pbxproj`**, via a
small script (`ruby` + the `xcodeproj` gem — the same library CocoaPods and Fastlane use to edit
Xcode projects programmatically). This is not a workaround or an approximation; it edits the exact
same project file, in the exact same format, that Xcode's GUI edits. Xcode cannot tell the
difference on open.

What was added, matching every choice below:

- **Remote package**: `https://github.com/RevenueCat/purchases-ios-spm.git`
  *(RevenueCat's SPM mirror. Same code, same tags as `purchases-ios`, much smaller git history — it
  resolves far faster.)*
- **Dependency rule**: Up to Next Major Version, starting at **`5.81.3`** — the exact tag this
  migration's adapter code (`SiliconStoreKit+RevenueCat.swift`) was verified against, so the API
  surface used there is guaranteed to exist.
- **Target**: `App`. **Product**: `RevenueCat` only — **not** `RevenueCatUI`, which brings
  RevenueCat's hosted paywall UI. This app does not use it and must not: there is exactly one
  purchase surface, `src/components/Paywall.tsx`.
- Linked into the App target's Frameworks build phase, exactly like the existing `CapApp-SPM`
  dependency already was.

**There is nothing left to do in Xcode for this step.** The three RevenueCat source files
(`RevenueCatConfig.swift`, `SiliconStoreKit+RevenueCat.swift`, and the edited
`SiliconStoreKit.swift`) were already members of the App target from Phase 2 of this migration —
only the package reference itself was missing, and it now isn't.

### How this actually gets *built*, with no Mac

Adding the package reference doesn't compile anything by itself — Xcode resolves and downloads the
package source the first time something builds the project. That first build still needs a real
Apple toolchain (`xcodebuild`, an iOS SDK). Two ways to get one without owning a Mac:

1. **This repo's existing CI (recommended — already set up, already used for TestFlight builds).**
   `.github/workflows/ios-testflight-capacitor.yml` runs on a GitHub-hosted `macos-26` runner: it
   installs deps, `npx cap sync ios`, then `xcodebuild archive` and `-exportArchive`, signed with the
   App Store Connect API key already in this repo's Actions secrets. `xcodebuild archive`
   automatically resolves every Swift package declared in the project — including the one just
   added — no Xcode GUI involved at any point. Trigger it from GitHub → **Actions** →
   **iOS TestFlight** → **Run workflow**, enter a version number (e.g. bump `1.3.0` → `1.3.1`), leave
   "Submit to TestFlight" on. If it archives clean, the package resolved and the RevenueCat code
   compiled — that's the real, authoritative "does this build" answer, more reliable than a local
   Xcode build would even be, since it runs on a clean machine every time.
2. **A rented cloud Mac** (MacinCloud, MacStadium, Scaleway, etc.), if you ever want an interactive
   Xcode session — not required for this migration, but useful if you want to poke around.

### How the sandbox test matrix (§11) gets run, also with no Mac

The 20-row matrix needs a **physical iPhone**, not a Mac — Xcode is only how people *usually* get a
build onto a phone, not the only way:

1. Run the CI workflow above with "Submit to TestFlight" on. It uploads straight to App Store
   Connect.
2. Accept the TestFlight invite on your iPhone (TestFlight is a free App Store app).
3. On the iPhone, go to **Settings → App Store → Sandbox Account** and sign in with a Sandbox tester
   you create in App Store Connect (Users and Access → Sandbox → Testers) — this is a device
   Settings step, nothing to do with Xcode.
4. Install the TestFlight build and run through §11's rows directly on the phone.

No Mac touches any part of this path.

**Sanity check that costs 30 seconds once a build exists:** RevenueCat's `Purchases.logLevel = .debug`
is already on in DEBUG builds — look for `Purchases configured` plus a `CustomerInfo` fetch in the
device console (Xcode's device console, or `idevicesyslog` from a Linux/Windows machine with
`libimobiledevice`, again no Mac required). If the key is wrong you'll see a 401 there rather than a
silent failure at purchase time.

---

## 7. Existing-customer migration — what happens to real people

There are already paying customers. **None of them may lose anything**, and none of them should have
to do anything. Here is each case, end to end.

| Who they are | What happens on first launch after the update | Do they have to act? |
|---|---|---|
| **Mid-subscription (monthly/yearly)** | Their local `silicon.pro.v1` record already says Pro, so they are Pro from the first frame — before any network call. RevenueCat then reads the App Store receipt, finds the live subscription, and creates their RevenueCat customer with it. | No |
| **Lifetime owner** | Same: local record holds. RevenueCat sees the non-consumable in the receipt and reports it under `nonSubscriptions`. | No |
| **Founding Owner (paid-era, builds 1–4)** | Unaffected by the migration entirely. `originalPurchase()` deliberately stays on Apple's `AppTransaction` in both backends. Their existing local record is permanent and `syncPro()` never revokes it. | No |
| **Legacy Creative Mode owner** | Held by `src/state/entitlements.ts`, which the adapter never touches. Restorable through the same Restore button. | No |
| **Brand-new free user** | Anonymous RevenueCat customer created on first launch. No entitlement. Paywall as normal. | No |
| **Anyone who reinstalls / switches device** | **Restore Purchases** on the paywall. `restorePurchases()` reads the App Store receipt, which still carries every pre-migration purchase. | Tap Restore |

**There is no window where a paying customer sees a paywall.** The entitlement is read from the local
record first (`pro.ts`), and `syncPro()` only ever *overwrites* it with a confirmed store answer —
never with a failure. A user updating mid-flight on a train keeps Pro.

**App user IDs: anonymous, on purpose.** This app has no accounts and no server. RevenueCat generates
and persists an anonymous ID per install, which is exactly right here. `Purchases.logIn()` is never
called. Inventing a login to satisfy an SDK would be a product change, not a migration step.

### The rollback, if entitlements break in the wild

Fastest first:

1. **One-line patch release.** `RevenueCatConfig.forceStoreKit2 = true` → the app is back on
   StoreKit 2 in the next build. No dashboard change, no data migration, nothing to undo. The
   StoreKit 2 code was kept complete rather than deleted precisely for this.
2. **If you cannot ship a build fast enough:** remove the `RevenueCatPublicAPIKey` value from the
   *next* build — same effect, but you still need a build. There is no remote kill switch, which is
   an accepted trade: adding one would mean the purchase path depends on a config fetch.
3. **Then revert the privacy declaration** — see §8. It has to be accurate in both directions.

---

## 8. Privacy — required, not optional

Shipping RevenueCat ends this app's "Data Not Collected" declaration. An App Privacy answer that
understates collection is both a rejection and a policy problem, so all four of these must agree:

1. `ios/App/App/PrivacyInfo.xcprivacy` — **already updated** in this change.
2. **App Store Connect → App Privacy** — you must update this by hand:
   - "Do you collect data from this app?" → **Yes**
   - **Purchase History** → App Functionality → *not* linked to identity → *not* used for tracking
   - **Device ID** → App Functionality → *not* linked to identity → *not* used for tracking
   - Everything else → No. **Tracking → No.**
3. `docs/privacy/index.html` and `public/privacy.html` — the live policy the paywall links to.
   **Already updated**: they now name RevenueCat as the processor and say precisely what it receives.
4. The App Review notes — see `appstore/APP_STORE_METADATA.md` §9.

What is still true and should keep being said, because it is a genuine selling point: no tracking, no
analytics SDK, no advertising, no attribution, no accounts, no login, and the game itself — every
save, setting and statistic — still never leaves the device.

> If RevenueCat is ever switched back off, **revert all four together**. Over-declaring is not "safe";
> it has to be accurate in both directions.

---

## 9. Webhooks and integrations

Day one — enable:

- **Nothing is required.** The app works with none of this. Do not let integration setup block the
  release.

Worth enabling once the release is stable:

- **Charts** (built in, no setup) — MRR, trial conversion, churn. This is most of the reason to adopt
  RevenueCat at all, and it costs nothing.
- **Customer Lists / customer lookup** — for answering "I paid and lost my Pro" support mail with a
  fact instead of a guess.

Defer, deliberately:

- **Attribution integrations** (AppsFlyer, Adjust, Branch, Facebook, Firebase). Every one of these
  would change the privacy declaration again, and several would flip `NSPrivacyTracking` to true.
  The privacy change in §8 is scoped to purchases and nothing else.
- **Third-party webhooks** until there is a service to send them to.

---

## 10. Offerings-driven catalog — proposed, not built

Driving the paywall from RevenueCat **Offerings** would allow price changes and A/B tests with no app
update. It was deliberately **not** built as part of this migration, because it changes where the
paywall's contents come from, and Guideline 3.1.2(c) requires the price, subscription length and
trial terms to be disclosed accurately at the point of purchase — so a misconfigured remote offering
becomes a compliance problem rather than a display bug.

If it is built later, two rules are non-negotiable:

- Keep the hardcoded local fallback (the values in `src/state/pro.ts`) for when the offering is
  unreachable.
- Never render a purchase button for a product whose localized price string is missing.

---

## 11. Sandbox verification matrix

Run on a **real device** — the simulator cannot complete a purchase. Use a Sandbox Apple ID
(App Store Connect → Users and Access → Sandbox Testers) signed in under
**Settings → App Store → Sandbox Account**. Sandbox subscription periods are compressed: a month is
5 minutes, a year is 1 hour.

| # | Test | Pass = |
|---|---|---|
| 1 | Open the paywall cold | Three rows, **localized** prices from the store, yearly preselected with BEST VALUE |
| 2 | Buy **yearly** | Sheet completes → Pro unlocks immediately → era 3 opens without a restart |
| 3 | Buy **monthly** (fresh tester) | Same |
| 4 | Buy **lifetime** | Unlocks; Settings reads "Pro Lifetime — owned forever" |
| 5 | Open the sheet and **dismiss it** | Paywall stays open, **no error banner**, nothing granted |
| 6 | Tap **Restore** on a fresh install with a live subscription | Pro returns, correct tier and expiry |
| 7 | Tap **Restore** with genuinely nothing owned | Honest "nothing to restore", no error dialog |
| 8 | **Manage Subscription** from Settings | Apple's sheet appears (or the account URL opens) — it must always go *somewhere* |
| 9 | **Airplane mode, active subscription** | Still Pro. Nothing locks. This is the cached-CustomerInfo path |
| 10 | **Airplane mode, lifetime already owned**, tap Buy Lifetime | Resolves **purchased**, not error |
| 11 | **Airplane mode, nothing owned** | Paywall shows the retry state — **no buy button at all** |
| 12 | Let a sandbox subscription **expire** (wait one compressed period past cancel) | Pro lapses, gates return, no crash |
| 13 | Cancel but stay in the paid period | Settings reads "cancelled, active until …", still Pro |
| 14 | Trial row on a **fresh** sandbox Apple ID | Shows "7 days free" |
| 15 | Trial row on an Apple ID that **already used** the trial | **No trial framing on any row** |
| 16 | Era-3 wall before purchase, then after | Locked → unlocked, no restart |
| 17 | **Founding path in sandbox** | Correctly **untestable**: a sandbox tester must NOT get free Pro. If a tester reads as a Founding Owner, stop — that is the `"1.0"` bug and it is shipping-blocking |
| 18 | Buy on device A, launch device B on the same Apple ID | Device B picks it up via Restore |
| 19 | Ask-to-Buy (a Sandbox child account) | Purchase reads **pending**, grants nothing, then unlocks by itself on approval |
| 20 | Verify the legacy unlock | A tester who owns `com.wrexist.silicon.sandbox` gets Creative Mode and **not** full Pro |

Row 17 and row 20 are the two that cost real money if they fail. Do not skip them.

---

## 12. Ship

- [ ] All 20 rows above pass on a real device
- [ ] `npm test` and `npm run typecheck` green
- [ ] App Privacy answers updated in App Store Connect (§8)
- [ ] Privacy policy live at the URL the paywall links to
- [ ] App Review notes describe the processor honestly
- [ ] `LAUNCH_CHECKLIST.md` run end to end
