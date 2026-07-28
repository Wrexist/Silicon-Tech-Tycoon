# Monetization — free download + Silicon Pro

The model, why it is shaped this way, and every lever you can pull. Read this before changing a
price, moving the free/Pro line, or adding a paywall surface.

Supersedes the old "LOCKED — $8.99 premium" section of DEV.md.

---

## 1. What changed, and the tension worth naming

Silicon shipped as an **$8.99 paid download** with one $2.99 IAP. Its entire market position —
written down in `EXPANSION_ROADMAP.md` — was *"be the premium replacement for ad-spam tycoons like
Smartphone Tycoon"*. Going free-to-download is in obvious tension with that.

The resolution is that **"premium" was never about the price tag — it was about the absence of dark
patterns.** So the wedge is kept literally intact:

| Promise | Before | Now |
|---|---|---|
| No ads | ✅ | ✅ **still true** |
| No timers / energy / wait-gates | ✅ | ✅ **still true** |
| No premium currency | ✅ | ✅ **still true** |
| No loot boxes / gacha | ✅ | ✅ **still true** |
| No pay-to-win | ✅ | ✅ **still true** — nothing purchasable touches the simulation |
| No nagging | ✅ | ✅ one founding offer, then only at gates the player walks into |
| Buy once, own forever | ✅ | ✅ **Pro Lifetime**, and every prior buyer grandfathered free |

What actually changed: the **price of entry moved from $8.99 to $0**, and the depth behind it
became a subscription. Nothing about how the game treats the player did.

**The honest downside**, stated once: a subscription is a worse deal than a one-time purchase for a
player who plays for three years, and some reviewers will say so regardless of how fair the terms
are. **Pro Lifetime exists precisely to answer that** — and it is priced so that anyone who resents
subscriptions has a clean, permanent alternative on the same screen.

---

## 2. The products

Defined once in `src/state/pro.ts` (`PRO_PRODUCTS`). Everything else reads from there.

| SKU | Tier | Price (USD fallback) | Notes |
|---|---|---|---|
| `com.wrexist.silicon.pro.yearly` | yearly | **$19.99 / year** | Default selection. `BEST VALUE`. 7-day trial. |
| `com.wrexist.silicon.pro.lifetime` | lifetime | **$29.99 once** | Non-consumable. Never renews. |
| `com.wrexist.silicon.pro.monthly` | monthly | **$3.99 / month** | Low-friction entry. 7-day trial. |
| `com.wrexist.silicon.sandbox` | — | $2.99 (legacy) | The paid era's Creative Mode IAP. **Honoured forever, never re-sold.** No longer offered. |

**The prices in the code are display fallbacks for web/dev only.** On device the localized StoreKit
price always wins. Change the price in **App Store Connect first**, then here — a paywall showing a
price the store will not charge is a Guideline 3.1.2 rejection.

### Why this ladder

- **$3.99/mo → $19.99/yr is a 58% saving.** Steep enough that yearly is the obvious pick (which is
  also the plan with the better retention economics), without making monthly look like a trap.
- **Lifetime at $29.99 ≈ 18 months of yearly.** High enough that it doesn't cannibalise the
  recurring base; low enough that a former $8.99 buyer doesn't feel gouged.
- **A 7-day trial, not 3 days.** Reaching the era-3 wall — where the offer means the most — takes
  hours of play spread over several sessions. A 3-day trial expires before most players get there,
  which converts the trial into a refund request instead of a subscription.

---

## 3. The free ⇄ Pro line

Defined once in `src/state/proGates.ts` (`FREE_TIER` + `isLocked`), and pinned by
`proGates.test.ts`.

### Free — a real game, not a demo
- The complete design → launch → read-the-market → reinvest loop, unlimited products, no time limit
- **The Garage Era and the Growth Era, start to finish** (`FREE_TIER.maxEra = 2`)
- **A fresh seeded daily challenge, every day, forever**
- Two scenarios (`first-light`, `bootstrapped`)
- Goals, Achievements, the Roadmap, the Help guide, the 3D office, the factory floor
- No ads, no timers, no energy, no currency

### Pro
- **The Platform Era and the AI Era** — the second half of the campaign
- **New Game+ and Ascension** — the prestige loop and the Heat ladder
- **Every scenario** (six hand-built runs)
- **The Time Machine** — rolling quarterly snapshots of your company, rewind to any of the last five
- **The Platform Division** — found an OS, licence it, own the ecosystem
- **Creative Mode** — the old $2.99 IAP, now included
- **The Vault, the Device Museum, Category Mastery, Founder Legend** — the cross-company archives

### Why the Time Machine exists

The loudest objection to subscriptions in games — stated plainly across itch.io and Reddit threads
on exactly this question — is *"games lose my interest in a few weeks, so why would I pay every
month?"* Unlocked content does not answer that. It is a one-time purchase wearing a subscription's
clothes, and a player who finishes the campaign in month two is right to cancel.

An ongoing **service** does answer it: for as long as you subscribe, your company is protected.
`state/timeMachine.ts` snapshots the freeform campaign every four weeks and keeps the last five, so
one catastrophic launch or one over-hired year no longer ends a twenty-hour run. That is a reason to
still be paying in month six, and it is the only feature in Pro that gets *more* valuable the longer
you play.

It is fenced to keep it fair: **snapshots are taken only in the freeform campaign** — never in a
scenario, never in a daily or weekly challenge. Those are the scored, seeded, star-rated modes where
rewinding would be cheating and where a free player and a Pro player must be measured identically.
A test pins that fence. In your own campaign there is nothing to cheat.

### Why the wall is at era 3

`BALANCE.eras` requires **reputation 60 AND $8M cumulative revenue** to enter the Platform Era. That
is a multi-hour, genuinely earned milestone — and the game *already* celebrates it with a
full-screen ceremony. So the offer arrives:

- **late enough** that the player knows whether they like the game (no cold-sell),
- **at a high point**, not a frustration (the card reads *"You've earned the Platform Era"*),
- **answering a question the player just asked**, which is the single largest lever on conversion
  after price itself.

`FREE_TIER.maxEra` is the most consequential number in the business model. Lowering it converts
harder and reads meaner; raising it is more generous and converts later. Don't move it casually —
`proGates.test.ts` will fail if it drops below 2 or exceeds the era table, on purpose.

### The rule that keeps this safe

**No gate may reach `engine/`.** Every lock sits on a *player action* or a UI surface, so a free
run and a Pro run produce byte-identical simulations and the pinned 160-week determinism test can
never see monetization. This is also why there is no pay-to-win exposure under Guideline 3.1.1:
Pro sells **content and modes**, never an advantage inside a run.

---

## 4. The funnel

| # | Surface | Reason id | When |
|---|---|---|---|
| 0 | **Founding brief** (one question) | — | Once per device, right after naming the company; shapes what #1 leads with |
| 1 | **Founding offer** | `onboarding` | Once per device, immediately after the brief |
| 2 | **The era wall** | `eraAdvance` | On tapping *Advance* into era 3 — the primary conversion moment |
| 3 | New Game+ | `newGamePlus` | On the IPO overlay, after winning |
| 4 | Ascension / Heat | `ascension` | Raising Heat on the IPO overlay |
| 5 | Scenarios | `scenario` | Tapping a locked scenario |
| 6 | Platform Division | `platformDivision` | Company → Platform tab |
| 7 | Creative Mode | `creativeMode` | Settings |
| 8 | Vault / Museum / Mastery / Legend | matching id | Progress hub rows |
| 9 | Time Machine | `timeMachine` | Settings — shown locked, with the pitch, before it's needed |
| 10 | Settings status row | `onboarding` | "See what's in Pro" |

Every one of them routes through **one** overlay (`components/Paywall.tsx`) via
`openPaywall({ reason, onUnlocked })`, which:

- **short-circuits for subscribers** — a Pro user never sees a paywall for something they own; the
  gated action just runs. That's why call sites read as "gate the action, then do it" with no
  entitlement branching.
- **resumes the interrupted action** on success. A player who hit the era wall, subscribed, and
  came back lands *in the era-advance ceremony*, not on the screen they started from.

### The conversion mechanics, and the evidence behind each

Six deliberate mechanics, each drawn from what the subscription-app industry has actually measured —
and each implemented in the version that keeps the "no dark patterns" promise rather than the
version that squeezes the number hardest.

| # | Mechanic | Why | Where |
|---|---|---|---|
| 1 | **The founding brief** — one question before the offer | The screen *before* the paywall moves conversion more than the paywall. Apps that ask what the user wants first convert several times better (Noom's quiz-to-paid is ~10% vs a ~2.7% median); stating an ambition is a small commitment that makes the next screen read as an answer. **Our version is one honest question, not a ten-step quiz that changes nothing** — and it only reorders the argument, never its content. A test asserts that every player sees the same set of promises. | `state/founderIntent.ts` · `components/FoundingBrief.tsx` |
| 2 | **Proof, counted from the catalogs** | A sim player's first question is "how much game is there?". The industry answer here is invented download counts and testimonials — a dark pattern *and* an App Review liability. Ours reads the real content tables at module load, so it cannot rot and cannot become a lie: add a scenario and the strip updates. | `PROOF` in `components/Paywall.tsx` |
| 3 | **Trial-ending strip (2 days out)** | Counter-intuitive but correct: a subscriber surprised by a charge refunds it, leaves a one-star review, and never returns — and Apple counts the refund either way. Warning costs a few cancellations from people who were never staying, and buys goodwill from everyone who does. It is also the clearest possible signal to App Review that this isn't a trial trap. | `components/ProNudge.tsx` |
| 4 | **Billing-failure rescue** | ~⅓ of subscription churn is involuntary — an expired card, a declined charge — not a decision. Apple retries for up to 60 days and keeps the subscriber entitled through the grace period; the only missing piece is the user *knowing*. Reported recovery from doing this properly runs 15–20% of otherwise-lost revenue. | `components/ProNudge.tsx` |
| 5 | **Returning-subscriber welcome** | Lapsed subscribers are the cheapest revenue an app has, and the surest way to lose them is to show them the first-time sales pitch again. A one-bit, never-cleared breadcrumb (`hasEverSubscribed`) swaps the headline for a welcome. **No discount is claimed** — real win-back pricing is configured in App Store Connect and shown by StoreKit's own sheet; our UI never states a price the store didn't give us. | `RETURNING_COPY` in `state/proGates.ts` |
| 6 | **Monthly → Yearly crossgrade** | Yearly subscribers have materially higher LTV and lower churn. Offered only to someone already on Monthly, framed as what it is: the same Pro for less per month. Both SKUs share one subscription group, so StoreKit prorates it — no double charge, no cancel-first. | `ProGroup` in `screens/Settings.tsx` |

**Deliberately not implemented:** fabricated social proof, countdown timers, "limited time" pricing,
a trial toggle, or a paywall you can't dismiss. The first four are lies, and the fifth is a
Guideline 3.1.2 rejection as of January 2026.

### Rules the funnel follows

- The founding offer shows **once per device**, and is **always skippable**. A free app you cannot
  get past fails Apple's minimum-functionality bar — and a player who hasn't seen the game can't
  want it.
- **Locked rows stay tappable.** A padlock you can't press teaches nothing about what's behind it.
  Every lock opens the offer that explains it.
- **No countdowns, no "limited time", no fake scarcity.** The same products are always available at
  the same price, so urgency framing would simply be a lie. `proGates.test.ts` asserts this against
  the copy.

---

## 5. Compliance — what protects the build in review

`components/Paywall.tsx` carries the detail; the summary:

**Guideline 3.1.2(c), inside the purchase flow itself** (reviewers check the paywall, not the store
description): subscription title on every row · length of subscription on every row · billed amount
as the most prominent price element · trial copy subordinate to it · Terms of Use + Privacy Policy
links · Restore Purchases · plain-language auto-renew disclosure.

**The 2026 rules:**
- **No free-trial toggle.** Apple began rejecting toggle paywalls in January 2026 ("confusing, may
  prevent users from understanding they are committing to an auto-renewing subscription"). The trial
  is a stated property of the plan row.
- **No CTA before the store confirms it can sell.** `getProCatalog()` asks StoreKit what is actually
  purchasable; if nothing comes back the card shows an honest retry state. A buy button that can
  only error is a documented 2.1.0 rejection.
- **Trial framing only for eligible Apple IDs.** The store reports `introEligible`; promising a
  trial Apple won't honour is a false claim.
- **A cancelled StoreKit sheet is not an error.** No banner, no apology, nothing logged.

**Also required and present:** Restore in Settings as well as on the paywall; a native
*Manage Subscriptions* sheet (so cancelling is two taps); and a live Terms page at
`/terms/` that spells out price, period, renewal, trial forfeiture and cancellation.

---

## 6. Grandfathering — the paid-era owners

Everyone who bought the app at $8.99 keeps everything, permanently, free.

`AppTransaction.originalAppVersion` gives the **build number of the user's original download**.
`FIRST_FREE_BUILD` in `pro.ts` is the boundary: anything below it is the paid era, and those users
are granted the permanent **`founding`** tier plus the Creative Mode unlock.

> ⚠ **`FIRST_FREE_BUILD` must be set to the CFBundleVersion of the build that flips the App Store
> price to Free, and never lowered afterwards.** Too low → paying customers silently lose what they
> bought. Too high → new free downloads get Pro for nothing. Paid builds shipped were 1–4, so the
> first free build must be **5 or higher**. A test asserts the floor.

A `founding` record is never cleared by a "no purchases found" sync, because `AppTransaction` needs
iOS 16 and cannot be re-derived below it.

This is not just decency — it is the cheapest goodwill available. The paid-era cohort is small,
already converted, and is the group most likely to review the free launch.

---

## 7. Where the money can leak (and what stops it)

Both directions cost real money. `pro.ts` and `proStore.ts` are written against specific failure
modes, each with a test:

| Failure | What it costs | Guard |
|---|---|---|
| "Has ever purchased" grants Pro | One paid month → Pro forever | Status flows **only** through expiry, never purchase history |
| Missing expiry read as lifetime | Same, via the date instead of the SKU | Lifetime identified by **identity** (`tier`), never by an absent date |
| Unparseable expiry | `new Date("junk") < now` is `false` → permanent Pro | Non-finite expiry ⇒ expired |
| Offline subscriber | Paying customer locked out on a plane | Dateless recurring record trusted inside a **bounded** window anchored on `grantedAt` |
| Partial store read | One source throws, other says "no" → subscriber logged out | Revoke needs a definitive **no from both** lifetime *and* subscription |
| Storage eviction | WKWebView purges localStorage → Pro vanishes | Pro record mirrored to native Preferences (`nativeStore.ts`) |
| Charge without grant | User pays, sync fails, gets nothing | Conservative dateless record written on purchase, corrected by the next sync |
| Forged save | Free Pro | Unknown tier / corrupt JSON ⇒ **fails closed** |

---

## 8. Tuning — what to change and where

| Lever | File | Notes |
|---|---|---|
| Prices | App Store Connect **first**, then `PRO_PRODUCTS` in `pro.ts` | Fallbacks only; device uses localized store price |
| Trial length | App Store Connect **first**, then `FREE_TRIAL_DAYS` | If they disagree, the paywall is making a false claim |
| Where the free tier ends | `FREE_TIER.maxEra` in `proGates.ts` | The biggest single lever. Read §3 first |
| Free scenarios | `FREE_TIER.scenarioIds` | Ids are validated against `SCENARIOS` by a test |
| What Pro includes | `isLocked` + `PRO_BENEFITS` in `proGates.ts` | Benefit list and gate table live side by side so they can't drift |
| Paywall wording | `COPY` in `proGates.ts` | One entry per reason; the no-urgency test guards it |
| Kill the purchase path | `NATIVE_PRO_WIRED = false` in `proStore.ts` | Native paths go "unavailable" — never the web mock, which would grant Pro free |

### Highest-value experiments, in order

1. **Yearly price** ($19.99 → $14.99 / $24.99). Biggest revenue swing per unit of effort.
2. **`maxEra`** (2 vs 3). Trades conversion rate against install-to-play depth and review sentiment.
3. **Founding-offer placement** (after naming the company vs. after the first product ships). Later
   converts at a higher *rate* on far fewer impressions — measure total, not rate.
4. **Lifetime price** ($29.99 → $24.99 / $39.99). Watch cannibalisation of yearly, not just units.

---

## 9. Known trade-offs

- **The web/PWA build simulates purchases.** `purchasePro` grants Pro without a store off-device, so
  the whole funnel is testable in a browser. That is inherited from the existing `iap.ts` convention
  and is safe while **iOS is the only distribution channel**. If the web build is ever published as
  a real channel, that branch must be replaced with a real payment path or removed.
- **Free players can no longer reach the IPO.** The endgame sits behind the era wall, so the "you
  went public" ceremony and its epilogue are Pro-only. That is intentional (it is the payoff), but
  it means the free tier's ending is open-ended rather than climactic. If free retention proves
  weak, giving free players a *smaller* terminal beat is a better fix than moving the wall.
- **No analytics.** The App Privacy declaration is "Data Not Collected" and there is no third-party
  SDK — a real selling point, and the reason there is no `track()` call anywhere in this code. The
  funnel therefore has to be tuned from App Store Connect's own subscription reports, which are
  aggregate and delayed. That is a deliberate trade of measurement for the privacy claim.
