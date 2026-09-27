# Silicon 1.4.0 price experiment

User requested weekly billing, a $7.99 weekly anchor, higher annual/lifetime pricing, then a price A/B test on 27 September 2026.

| Variant | Weekly | Yearly | Lifetime | Offering |
|---|---:|---:|---:|---|
| A | $7.99 | $99.99 | $199.99 | silicon_140_price_a |
| B | $4.99 | $59.99 | $119.99 | silicon_140_price_b |

USD base prices; use Apple's localized prices and equalizations in each territory. New subscriptions keep a seven-day introductory trial for eligible accounts. All existing product IDs, prices and entitlements remain supported. New products are in pricing-experiment-1.4.0.json. Legacy monthly is absent from the new paywall.

## RevenueCat setup

Import all six new Apple products, attach them to entitlement `pro`, and create both offerings with `$rc_weekly`, `$rc_annual` and `$rc_lifetime` packages. Set A as the control/default for app version 1.4.0 and newer; preserve the legacy default for older versions. Configure a Price point experiment with 50/50 allocation and new customers only, targeting the Silicon iOS app and version 1.4.0+. Use RevenueCat's assigned current offering; never randomly assign locally or combine packages from different offerings. The native purchase passes the displayed package to preserve attribution.

Existing app-user identities retain their RevenueCat enrollment, but reinstall/restore identity transfers can affect cohorts; do not claim assignment is permanent per human. New and old recurring products share one Apple subscription group to prevent simultaneous subscriptions. Apple's subscription management can expose alternative prices; monitor crossovers by product.

Primary metric: realized revenue per paywall viewer using the Viewed filter; also review paid conversion, trial-to-paid conversion, refunds, retention and product mix. Keep layout, ordering, seven-day trial and benefits identical. Allow trials and renewals to mature, review credible intervals, and do not choose a winner from a handful of purchases. TestFlight enrollments can appear, but sandbox revenue and iOS sandbox paywall impressions are excluded from experiment results.

## Release gates

- New Apple products need localization, price, availability, review screenshot and review approval before production use.
- Validate every variant's purchase and restore in TestFlight, including legacy monthly and both lifetime variants.
- Publish privacy updates: Purchase History and Device ID for functionality and analytics; Product Interaction for analytics; no tracking, not linked to identity. Paywall impressions and offering IDs are now collected.
- Configure and verify RevenueCat products, offerings, targeting and experiment. Starting the experiment must follow completed product configuration; enrollment is not evidence of valid Apple products.
- Replace build 96 with a tested build that includes these changes. Build 96 remains the selected earlier candidate and does not contain weekly or experiment support.

Sources: RevenueCat Experiments / Offerings / Tracking Custom Paywall Impressions; Apple's auto-renewable subscription information.
