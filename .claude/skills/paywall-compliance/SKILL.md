---
name: paywall-compliance
description: Audit or change anything that sells Silicon Pro — the paywall, prices, the free/Pro line, gates, StoreKit code, or App Store purchase metadata. Use when touching src/state/pro.ts, proGates.ts, proStore.ts, storeKitBridge.ts, components/Paywall.tsx, SiliconStoreKit.swift, or when adding a locked feature, changing a price or trial, or diagnosing an App Store rejection under Guideline 3.1.2 / 2.1.
---

# Paywall & monetization compliance

Silicon is a **free download** monetized by **Silicon Pro** (monthly / yearly with a 7-day trial,
plus a one-time Lifetime). This skill is the checklist for changing any part of that without
breaking revenue, the determinism pin, or the App Store submission.

Read `MONETIZATION.md` for the model and `appstore/SUBSCRIPTION_GUIDE.md` for the store setup.

## The map — where things live

| Concern | File |
|---|---|
| Products, prices, trial length, entitlement + expiry | `src/state/pro.ts` |
| The free ⇄ Pro line, gate table, paywall copy | `src/state/proGates.ts` |
| StoreKit flow: catalog, purchase, restore, sync | `src/state/proStore.ts` |
| Shared native plugin proxy | `src/state/storeKitBridge.ts` |
| Presentation bus + first-run timing | `src/state/paywall.ts` |
| **The one and only purchase surface** | `src/components/Paywall.tsx` |
| The one question asked before the offer | `src/state/founderIntent.ts` · `components/FoundingBrief.tsx` |
| Trial-ending + billing-failure strips | `src/components/ProNudge.tsx` |
| The Time Machine (the Pro feature that justifies recurring billing) | `src/state/timeMachine.ts` |
| Native StoreKit 2 | `ios/App/App/SiliconStoreKit.swift` |
| RevenueCat inside that plugin (SPM, not the CocoaPods-only Capacitor plugin) | `ios/App/App/SiliconStoreKit+RevenueCat.swift` · `RevenueCatConfig.swift` · `appstore/REVENUECAT_SETUP.md` |
| App Privacy manifest — must stay in step with the purchase backend | `ios/App/App/PrivacyInfo.xcprivacy` · `docs/privacy/` |
| Tests | `pro.test.ts` · `proGates.test.ts` · `proStore.test.ts` · `paywall.test.ts` · `founderIntent.test.ts` · `timeMachine.test.ts` |

## Six rules that must never be broken

1. **No gate may reach `engine/`.** Every lock sits on a *player action* or a UI surface, so a free
   run and a Pro run are byte-identical and the pinned 160-week determinism test can never see
   monetization. If you find yourself passing `isPro()` into engine code, stop — gate the action
   that calls it instead.
2. **Pro sells content and modes, never an in-run advantage.** No stat boosts, no cheaper parts, no
   better verdicts. That is what keeps Guideline 3.1.1 off the table and the "no dark patterns"
   brand promise true.
3. **One purchase surface.** Raise it with `openPaywall({ reason, onUnlocked })`. Never build a
   second paywall — the compliance surface area must stay auditable in one file.
4. **Grant only on confirmed success; revoke only on a definitive no.** Cancel, pending, error and
   "bridge missing" grant nothing. A *partial* store read (one source throws, the other says no) is
   not evidence of a lapse — revoking on it logs paying customers out.
5. **Never lower `FIRST_FREE_BUILD`.** It is the boundary that grandfathers everyone who bought the
   app at $8.99. Lowering it silently strips Pro from paying customers.
6. **A Pro convenience must never reach a scored mode.** The Time Machine snapshots the freeform
   campaign only — never a scenario, never a daily or weekly challenge. Those have stars and seeded
   leaderboards, so a free player and a Pro player must run identical rules. Any future "helper"
   feature inherits this fence.

## The honest-selling line

The conversion mechanics here each have a squeeze-harder version that this project does not ship.
Keep it that way — they are lies, and three of the five are also rejections:

| Shipped | NOT shipped |
|---|---|
| One honest question before the offer | A ten-step "personalization quiz" that changes nothing |
| Proof counted from the real content tables | Invented download counts and testimonials |
| A welcome for returning subscribers | A fabricated "just for you" discount |
| Prices from StoreKit, always | A price typed into the UI |
| — | Countdowns, "limited time", a trial toggle, an undismissable paywall |

**Owner decision, don't "fix" it:** trials convert **silently** — there is no in-app
trial-ending reminder, by choice (`ProNudge.tsx` documents the trade). Do not add one back without
being asked. The point-of-purchase disclosure is what compliance turns on, and it is intact.

`proGates.test.ts` enforces the no-urgency rule against the copy, and `founderIntent.test.ts`
enforces that personalization only ever REORDERS the promises — never adds, drops or edits one.

## Adding a new locked feature

Do all four in the same change, or the gate ships half-built:

1. Add the member to `ProFeature` in `proGates.ts`.
2. Add its `COPY` entry — headline, eyebrow, body. State what the player **gets**, never what
   they're losing. No countdowns, no "limited time" (a test enforces this).
3. Gate the *player action*, not the render:
   ```ts
   onClick={() => {
     if (isLocked("myFeature", pro)) {
       openPaywall({ reason: "myFeature", onUnlocked: doTheThing });
       return;
     }
     doTheThing();
   }}
   ```
   Keep the control **tappable** when locked and show `<ProChip />`. A padlock you can't press
   teaches nothing about what's behind it.
4. Add it to `ALL_FEATURES` in `proGates.test.ts`.

## Changing a price or trial

**App Store Connect first, code second.** A paywall showing a price or trial the store won't honour
is a Guideline 3.1.2 rejection.

- Prices in `PRO_PRODUCTS` are **display fallbacks for web/dev only** — on device the localized
  StoreKit price always wins. Never format currency in JS.
- `FREE_TRIAL_DAYS` must match the introductory offer configured on **every** SKU with
  `hasTrial: true`. If you stop offering trials, set `hasTrial: false` and the paywall drops all
  trial framing on its own.
- `PRO_SUBSCRIPTION_GROUP` must equal the group identifier in App Store Connect **exactly**. A
  mismatch makes every subscriber's status read as "no subscription" — they pay and get nothing.

## Pre-submission audit

Run this whenever the paywall changed. Each line is a real rejection someone has shipped.

**Guideline 3.1.2(c) — in the purchase flow itself, not the store description:**
- [ ] Every plan row shows its **title** ("Pro Yearly")
- [ ] Every plan row shows its **length** ("12 months · auto-renews yearly")
- [ ] The **billed amount** is the largest, heaviest price element — nothing out-shouts it
- [ ] Trial copy is **subordinate** to the billed amount (smaller, lighter, below)
- [ ] **Terms of Use** and **Privacy Policy** links are present *and load* — open both
- [ ] **Restore Purchases** is on the paywall (and in Settings)
- [ ] Plain-language auto-renew + trial-forfeiture disclosure

**Guideline 3.1.2 — in the App Store *metadata*, which is a separate check that runs before review:**
- [ ] Every localized description ends with a **Terms of Use (EULA)** link and a **Privacy Policy**
      link — `node appstore/localizations/validate.mjs --all` enforces both
- [ ] The EULA link is Apple's standard agreement
      (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`) unless a *custom* EULA
      has been pasted into ASC → App Information → License Agreement, in which case link that page
- [ ] **Privacy Policy URL** filled in under App Information, and the page loads publicly

**The 2026 rules:**
- [ ] **No toggle** anywhere near the trial — Apple began rejecting toggle paywalls in Jan 2026
- [ ] Trial framing shown **only** when the store reports `introEligible`
- [ ] No CTA rendered before the store confirms it can sell (`getProCatalog()` → retry state)
- [ ] Cancelling the StoreKit sheet produces **no error banner and no toast**

**Behaviour:**
- [ ] Airplane mode + active subscription ⇒ Pro still works (no offline lapse)
- [ ] Airplane mode + paywall ⇒ retry card, not a dead buy button
- [ ] Purchase completes ⇒ the interrupted action resumes (`onUnlocked`)
- [ ] Restore on a fresh install recovers the subscription
- [ ] Settings → Manage subscription opens Apple's native sheet

**Privacy — re-check whenever the purchase backend changes:**
- [ ] `PrivacyInfo.xcprivacy`, App Store Connect → App Privacy, and `docs/privacy/` all say the same
      thing: **Purchase History + Device ID**, app functionality, not linked, not used for tracking,
      `NSPrivacyTracking` false — because RevenueCat processes purchases
- [ ] No doc still claims "Data Not Collected" or "no third-party SDKs"; the true line is *no
      tracking, no analytics, no accounts, and the game's saves never leave the device*
- [ ] If RevenueCat is ever switched off (`RevenueCatConfig.forceStoreKit2 = true`), all three revert
      together — over-declaring is not "safe" either

**Always:**
- [ ] `npm test` green — including the determinism pin
- [ ] `npm run typecheck` clean

## Diagnosing a rejection

| Symptom | Almost always |
|---|---|
| 3.1.2 "no functional link to the Terms of Use (EULA) in the app's metadata" | The EULA link is missing from the **App Description text** — an automated pre-review check, nothing to do with the build. The ASC License Agreement section does not satisfy it and there is no EULA URL field. Paste the descriptions from `appstore/localizations/`, reply, resubmit the same build: `appstore/REJECTION_3.1.2_EULA.md` (1.3.0 build 70) |
| 3.1.2 "subscription information" | Dead legal link, missing length label, or price not the most prominent element |
| 3.1.2 "confusing design" | A toggle, or trial copy louder than the billed amount |
| 2.1 "purchase did not complete" | A product attached to the build that isn't live/tested in sandbox, or a cancel treated as an error |
| 3.1.1 | Something purchasable altered the simulation — find it and move the gate to the action |
| 2.1 minimum functionality | The paywall isn't skippable, or free has nothing to do |
| 2.3.7 "accurate metadata" | A price or business-model claim baked into a **marketing asset** instead of read from the store. 1.3.1 was rejected because screenshot 10 still advertised the paid era's "$8.99 once" after the app went free-to-download with a subscription. Fix the asset, not the app: `scripts/shots-refresh.mjs` frame 10, then re-render (`app-store-screenshots/README.md`) |

"Prices from StoreKit, always" governs marketing as well as UI. **No screenshot, promo text or
release note may name a price** — the render cannot know the localized amount StoreKit will charge,
and the moment the model changes the asset becomes a false claim that ships. Describe the model
(free download, optional Pro, nothing purchasable changes the sim); let the store page and the
paywall be the only places a number appears.
