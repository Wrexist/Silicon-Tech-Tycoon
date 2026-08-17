# Rejection: 3.1.2 — no Terms of Use (EULA) link in the metadata

**Submission:** iOS App 1.3.0 — build 1.3.2 (70) · submitted Aug 16, 2026 · rejected Aug 17, 2026
**Submission ID:** `487d47ba-8a05-4616-9f2a-232355acd420`
**Guideline:** 3.1.2 Business: Payments — Subscriptions

> The submission offers auto-renewable subscriptions but does not include a functional link to the
> Terms of Use (EULA) in the app's metadata.
>
> If you are using the standard Apple Terms of Use (EULA), include a link to the Terms of Use in the
> App Description. If you are using a custom EULA, add it in App Store Connect.

## What this is, and what it isn't

This is **metadata only**. It is an automated pre-review check — nobody opened the build, and
nothing in the app is wrong:

- The paywall already shows plan title, length, billed price, Restore Purchases, and links to Terms
  of Use and Privacy Policy (`TERMS_URL` / `PRIVACY_URL` in `src/components/Paywall.tsx`).
- The Privacy Policy URL field in App Store Connect was already filled in.

The gap was the **App Description text**. Apple's check reads the description looking for a Terms of
Use link, and the description had none — the ASC *License Agreement* section (which offers Apple's
standard agreement, or a custom one you paste as text) does not satisfy it, and there is no EULA
*URL* field to fill in instead.

**No new build is needed.** Build 70 is fine. Edit the description, reply, resubmit the same build.

## The fix, already in the repo

Every `appstore/localizations/<locale>/description.txt` now ends with two lines — Apple's standard
EULA, plus the privacy page — with the labels translated per locale:

```text
Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/
```

Eleven descriptions (ca, de-DE, el, es-ES, es-MX, fr-CA, fr-FR, it, ms, pt-PT, vi) were within ~160
characters of Apple's 4,000-character ceiling, so a flourish or two was cut to make room — the
"a striking design sells" line and the awards-ceremony aside. No feature lost its mention.
`appstore/localizations/validate.mjs` now **fails** any locale whose description drops either link,
so this cannot regress quietly.

## What you do in App Store Connect (~15 minutes, no Mac needed)

1. **App Store → the 1.3.0 version → Description**, for **each** localization you publish: paste the
   description from `appstore/localizations/<locale>/description.txt`. If you'd rather not repaste
   39 fields, appending the two lines to each existing description is equivalent — but the trimmed
   locales above will exceed 4,000 characters unless you paste the trimmed copy.
2. **App Information → Privacy Policy URL** — confirm it reads
   `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/` and that the page loads *right now*.
   Leave **License Agreement** on Apple's standard EULA; that is what the description links to.
3. Open both links from a browser you're not logged into, to be sure they're public:
   - `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
   - `https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/`
   - and `https://wrexist.github.io/Silicon-Tech-Tycoon/terms/` (linked from the paywall)
4. **Reply to App Review** with the note below, then **Submit for Review** — same build (70).

## Reply to App Review

```text
Thank you for the review.

This was a metadata omission, now corrected. The App Description for every localization
now includes a functional link to the standard Apple Terms of Use (EULA):

https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

alongside our Privacy Policy:

https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/

The app uses the standard Apple EULA, so no custom license agreement has been added in
App Store Connect.

For completeness, the in-app purchase flow already presented both links: the paywall shows
each plan's title, duration and localized price from StoreKit, a Restore Purchases action,
and links to Terms of Use and Privacy Policy directly beneath the purchase buttons.
Subscriptions can be managed or cancelled from Settings > Silicon Pro > Manage subscription.

No binary changes were required, so the same build has been resubmitted.
```

## If it comes back again

Then the check wants the subscription terms spelled out in the description too. Add this above the
two link lines (English shown; translate per locale, and re-trim to stay under 4,000 characters):

```text
Silicon Pro is an auto-renewable subscription, billed monthly or yearly, with a free trial.
It renews automatically unless cancelled at least 24 hours before the end of the current
period. Manage or cancel in your Apple Account settings.
```

Do **not** put prices in the description — the store charges a localized amount, and this app has
already taken a Guideline 2.3.7 rejection for a price appearing in marketing copy.
