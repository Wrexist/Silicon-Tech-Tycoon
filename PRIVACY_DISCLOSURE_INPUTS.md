# Privacy Disclosure Inputs — Silicon: Tech Tycoon

**Purpose.** Factual, code-cited technical input for the owner to complete Apple's **App Store
Connect → App Privacy** questionnaire, and to keep `ios/App/App/PrivacyInfo.xcprivacy`,
`docs/privacy/`, and `public/privacy.html` in agreement (CLAUDE.md hard rule).

**This document is not a legal declaration.** It reports what the code in this repository does, with
file:line evidence. Every row is either backed by cited code or explicitly marked
**NEEDS OWNER / LEGAL CONFIRMATION**. Nothing here was inferred from marketing copy or from the
existing privacy pages — those were checked *against* the code, not used as a source.

Audited: branch `claude/silicon-tech-tycoon-excellence-4twr18`, app version `1.3.0`
(`package.json`), bundle id `com.wrexist.silicon`.

---

## 1. Method — what was searched, and what was found

| Sweep | Command scope | Result |
|---|---|---|
| Outbound network from web layer | `fetch(` · `XMLHttpRequest` · `WebSocket` · `sendBeacon` · `EventSource` · `axios` across `src/**/*.ts(x)` | **Zero matches.** The React/TS app makes no network calls of any kind. |
| Outbound network from native layer | `URLSession` · `URLRequest` · `dataTask` · `http(s)://` across `ios/App/App/*.swift` | **One** real request (§2.1). Two further `https://` strings are `apps.apple.com` deep-links opened in Safari, not requests (`SiliconStoreKit.swift:422,432`; `SiliconStoreKit+RevenueCat.swift:447`). |
| Third-party SDKs linked into the app | `project.pbxproj` package references | **One:** RevenueCat (§2.2). No analytics, ads, attribution, crash, or social SDK. |
| Device identifiers | `identifierForVendor` · `advertisingIdentifier` · `ASIdentifier` · `IDFA` · `DeviceCheck` · `UIDevice` across `ios/App/App/*.swift` | **Zero matches.** The app reads no hardware or vendor identifier itself. |
| Ad/tracking plumbing | `NSUserTrackingUsageDescription` · `SKAdNetwork` in `ios/App/App/Info.plist` | **Zero matches.** No ATT prompt, no ad network IDs. |
| Push notifications | `registerForRemoteNotifications` · `deviceToken` · APNs in `AppDelegate.swift` | **Zero matches.** No remote push, therefore no device token leaves the device. |
| Required-reason APIs | `systemUptime` · `mach_absolute` · `creationDate` · `modificationDate` · `volumeAvailableCapacity` · `systemFreeSize` · `activeInputModes` across app + all `@capacitor/*/ios` sources | **Zero matches.** `UserDefaults` is the only required-reason category in use (§4). |
| On-device persistence | `localStorage` · `sessionStorage` · `indexedDB` · `Preferences.` across `src/**` | Many; all local-only (§3). |

**Conclusion of the sweep:** the two flows named in CLAUDE.md are the *only* two flows that leave the
device, and **no third flow was found.** Both CLAUDE.md claims are **VERIFIED**.

---

## 2. The two outbound flows (the complete set)

### 2.1 Refund verification — this project's own stateless endpoint

| | |
|---|---|
| **Evidence** | `ios/App/App/RefundVerifyConfig.swift:25` (endpoint), `:38–53` (the request) |
| **Endpoint** | `https://silicon-refund-verify.vercel.app/api/verify-app-transaction` |
| **Sent** | Exactly one field. `RefundVerifyConfig.swift:27–29` — `struct RequestBody { let signedTransaction: String }`, populated at `:46` with the JWS representation of the device's StoreKit 2 `AppTransaction`. Nothing else is added: no headers beyond `Content-Type` (`:43`), no identifier, no game state. |
| **Received** | `struct ResponseBody { let revoked: Bool }` (`:31–33`) — a single boolean. |
| **When it fires** | Only from the legacy paid-era "Founding Owner" grant path (`SiliconStoreKit.swift:467 originalPurchase`). Subscription, lifetime, and RevenueCat paths never reach it. |
| **Failure behaviour** | Fails **open**: any network error, non-200, decode failure, timeout (8s, `:44`) or unconfigured endpoint returns `false` / not-revoked (`:39`, `:48`, `:50–52`). Never revokes on ambiguity. |
| **Retention** | The function is documented as stateless and storing nothing (`:10–12`). **NEEDS OWNER CONFIRMATION** — the function's source lives in a separate project (`silicon-refund-verify`), not in this repo, so this repo cannot prove the no-retention claim. The owner must confirm it before relying on the "does not persist anything" wording that already appears in `docs/privacy/index.html` and `PrivacyInfo.xcprivacy`. |

> **Note on the payload.** A signed `AppTransaction` JWS is Apple-issued and identifies *the app
> purchase*, not the person. It is nevertheless a purchase record, which is why Purchase History is
> declared. It is **NEEDS OWNER / LEGAL CONFIRMATION** whether the owner wishes to characterise the
> JWS's embedded `appAccountToken`/`originalTransactionId`-class fields as an identifier for
> questionnaire purposes; the app itself neither reads nor stores them (no such symbol appears in
> `ios/App/App/*.swift`).

### 2.2 RevenueCat — purchase processing SDK

| | |
|---|---|
| **Evidence** | `ios/App/App/RevenueCatConfig.swift` · `ios/App/App/SiliconStoreKit+RevenueCat.swift:60–79` · `project.pbxproj:398–417` (SPM package `https://github.com/RevenueCat/purchases-ios-spm.git`, linked to the **App** target) |
| **Active?** | **Yes.** `forceStoreKit2 = false` (`RevenueCatConfig.swift:47`) and a non-empty public key is compiled in (`:58`), so `backend` resolves to `.revenueCat` whenever the package is linked (`:69–81`). |
| **Identity model** | **Anonymous.** `Purchases.configure(with:)` is called with **no** `appUserID` (`SiliconStoreKit+RevenueCat.swift:72–79`), and `Purchases.logIn` is never called (documented `:56–59`, and no call site exists). RevenueCat therefore generates its own anonymous per-install id. |
| **Attribution / IDFA** | **None.** No `collectDeviceIdentifiers`, `setAttributes`, `enableAdServices`, or any `attribution` call appears in the file. |
| **Sent** | Purchase/receipt data and the anonymous install id, per RevenueCat's own SDK behaviour. **NEEDS OWNER CONFIRMATION** — the exact payload is the vendor's, not this repo's; the owner should rely on RevenueCat's published privacy manifest (shipped inside the SPM package) for the authoritative list. |
| **Gameplay data** | **Never sent.** No game state is passed to any RevenueCat call. |

---

## 3. On-device storage — collected? **No.**

All game data is written to `localStorage`, mirrored to native `Preferences` (UserDefaults) purely so
the OS cannot evict a save. **It is never transmitted.** Representative evidence:

| Data | Evidence |
|---|---|
| Save game, settings | `src/state/settings.ts:43,74` · `src/state/nativeStore.ts:38–65` (write-through mirror + boot restore) · `src/main.tsx:15` (restore before first read) |
| Achievements profile | `src/state/achievementsProfile.ts:11,35` |
| Seasons / mastery | `src/state/seasons.ts:170,181` |
| Scenario & challenge progress | `src/state/scenarioProgress.ts:19,57,75` · `src/state/challengeProgress.ts:24,85,107,146,164,182` |
| Entitlement cache | `src/state/entitlements.ts:15,32,42` · `src/state/paywall.ts:64,72,119,120` |
| Time Machine snapshots | `src/state/timeMachine.ts:57,149` |
| UI conveniences (hints, intros, review flag) | `src/components/FactoryMode.tsx:303,305` · `src/state/interruptIntros.ts:28,50` · `src/state/review.ts:58,59` |

Under Apple's definition, data that never leaves the device is **not collected** and must **not** be
declared. Correctly absent from the manifest today.

**Local notifications** (`src/state/notifications.ts:12,49,53,63,87`) are scheduled and delivered
entirely on-device by `@capacitor/local-notifications`. No APNs registration exists, so no push token
is generated or transmitted. **Not collected.** (A permission prompt is not a collection event.)

---

## 4. Required-reason API declaration

| API category | Used? | Evidence | Declared? |
|---|---|---|---|
| `NSPrivacyAccessedAPICategoryUserDefaults` | **Yes** | `node_modules/@capacitor/preferences/ios/Sources/PreferencesPlugin/Preferences.swift:18` and `PreferencesPlugin.swift:89,93,112,114`; plus RevenueCat's own cache | **Yes** — `PrivacyInfo.xcprivacy:69–79`, reason **`CA92.1`**. Correct: access is limited to information written by this app itself. |
| File timestamp | No | no matches | Not declared — correct |
| System boot time | No | no matches | Not declared — correct |
| Disk space | No | no matches | Not declared — correct |
| Active keyboard | No | no matches | Not declared — correct |

**Material finding — the app's own declaration is load-bearing.** `@capacitor/preferences` ships
**no** `PrivacyInfo.xcprivacy` of its own (only `@capacitor/ios` core does, and its manifest is
entirely empty — `node_modules/@capacitor/ios/Capacitor/Capacitor/PrivacyInfo.xcprivacy`). So the
UserDefaults access introduced by that plugin is covered **only** by the app-level `CA92.1`
declaration. It must not be removed. **VERIFIED correct as written.**

**Manifest is in the build.** `PrivacyInfo.xcprivacy` is a member of the App target's Resources phase
— `project.pbxproj:22` (build file), `:40` (file ref), `:170` (Resources phase). It will ship.

---

## 5. Apple App Privacy questionnaire — per-category inputs

Legend: **Collected** = leaves the device. **Linked** = tied to an identity. **Tracking** = Apple's
definition (linked with third-party data for ads/measurement, or shared with a data broker).

| Apple category | Data type | Collected | Linked | Tracking | Purpose | Third party | Evidence / basis |
|---|---|---|---|---|---|---|---|
| **Purchases** | Purchase History | **Yes** | No | No | App Functionality — entitlement validation & restore | RevenueCat; and this project's refund-verify endpoint (legacy owners only) | `SiliconStoreKit+RevenueCat.swift:60–79`; `RefundVerifyConfig.swift:25,38–53` |
| **Identifiers** | Device ID (anonymous RevenueCat install id) | **Yes** | No | No | App Functionality — the id a purchase is restored against | RevenueCat | `SiliconStoreKit+RevenueCat.swift:56–59,72–79` (no `appUserID`, `logIn` never called) |
| **Identifiers** | User ID | No | — | — | — | — | No accounts exist; no login code anywhere |
| **Identifiers** | Advertising Identifier (IDFA) | No | — | — | — | — | No `advertisingIdentifier` / `ASIdentifier`; no `NSUserTrackingUsageDescription`, no `SKAdNetwork` in `Info.plist` |
| **Usage Data** | Product interaction, advertising data | No | — | — | — | — | No analytics SDK; zero `fetch`/`URLSession` in the app outside §2 |
| **Diagnostics** | Crash data, performance, other diagnostics | No | — | — | — | — | No crash reporter linked; only one SPM package (RevenueCat) |
| **User Content** | Gameplay content, saves, customer support | No | — | — | — | — | All saves local — §3. No support form in-app; support is an email address on a web page |
| **Contact Info** | Name, email, phone, address | No | — | — | — | — | Nothing in the app requests any of these |
| **Location** | Coarse or precise | No | — | — | — | — | No location API, no usage-description string in `Info.plist` |
| **Health & Fitness / Financial Info (payment) / Sensitive Info / Contacts / Browsing History / Search History** | — | No | — | — | — | — | No corresponding API or SDK present. Payment card data never reaches the app — StoreKit handles it in Apple's UI |

**Resulting ASC answers:** "Do you collect data from this app?" → **Yes**, then exactly two types —
**Purchase History** and **Device ID** — both *App Functionality*, both **not linked**, both **not
used for tracking**. This matches `PrivacyInfo.xcprivacy:42–68` exactly. **VERIFIED.**

### Items needing owner or legal confirmation

1. **Refund-verify retention.** The "stores nothing, no database" claim is made in
   `PrivacyInfo.xcprivacy:19–20` and `docs/privacy/index.html`, but its source is outside this repo.
   Confirm before submission.
2. **Data-processor agreements.** Whether the RevenueCat DPA and the owner's own endpoint satisfy the
   jurisdictions the app ships to (all countries per `appstore/APP_STORE_METADATA.md` §6) is a legal
   question this repo cannot answer.
3. **Children's-privacy posture.** The app is rated 4+ and the privacy pages assert COPPA-safe
   handling. The technical facts support it (no tracking, no ads, no profiling, no user-to-user
   contact). The declaration itself remains the owner's.
4. **JWS field characterisation** — see the note in §2.1.

---

## 6. Three-way sync verdict

| Surface | Status |
|---|---|
| `ios/App/App/PrivacyInfo.xcprivacy` | **VERIFIED** — matches code exactly: two collected types, both unlinked/non-tracking/app-functionality; `NSPrivacyTracking false`; empty `NSPrivacyTrackingDomains`; `CA92.1`. Its comment block correctly names *both* purchase-data recipients. |
| `docs/privacy/index.html` | **VERIFIED** — names RevenueCat, the anonymous install id, and the refund-verify endpoint; correctly states no analytics/ads/crash reporting and that saves never leave the device. |
| `public/privacy.html` | **VERIFIED** — substantively identical to `docs/privacy/index.html`. A text diff shows only site-chrome and line-wrapping differences; every substantive sentence matches. |
| Deployed pages | **VERIFIED** — `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/` is **byte-identical** to `docs/privacy/index.html` (8,344 bytes both). Not stale. |
| `appstore/APP_STORE_METADATA.md` §8 | **CORRECTED** in this pass — it listed RevenueCat as "the only third-party SDK" (true) but omitted the refund-verify endpoint as a second recipient of purchase data, which the manifest and privacy pages both disclose. Now aligned. |

Both privacy pages carry `Last updated: July 2026`. Content is accurate as of this audit; **NEEDS
OWNER** decision on whether to re-date at submission.

---

## 7. Revert coupling (CLAUDE.md hard rule)

If `RevenueCatConfig.forceStoreKit2` (`RevenueCatConfig.swift:47`) is ever flipped to `true`, or the
SPM package removed, the RevenueCat flow disappears and **Device ID is no longer collected**. All
four surfaces must revert together: `PrivacyInfo.xcprivacy` (back to an empty
`NSPrivacyCollectedDataTypes` **only if** the legacy refund-verify path is also retired — otherwise
Purchase History still applies), the ASC App Privacy answers, `docs/privacy/`, and
`public/privacy.html`. Over-declaring is not a safe default; accuracy is required in both directions.
