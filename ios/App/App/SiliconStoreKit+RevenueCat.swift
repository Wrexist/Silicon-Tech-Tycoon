import Foundation
import Capacitor
import UIKit

#if canImport(RevenueCat)
import RevenueCat
import StoreKit

/// The RevenueCat body of the `SiliconStoreKit` plugin.
///
/// ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ───────────────────────────────────────────────
/// This is an ADAPTER, not a rewrite. It satisfies exactly the same result contracts that
/// `SiliconStoreKit.swift` documents and that `src/state/storeKitBridge.ts` types, so the entire
/// JavaScript side — `proStore.ts`, `proGates.ts`, `Paywall.tsx` — is untouched by the migration.
/// If a change here would require editing a caller, the adapter is leaking and the change is wrong.
///
/// Every method below is routed to from the matching `@objc` entry point in `SiliconStoreKit.swift`
/// when `RevenueCatConfig.backend == .revenueCat`. The whole file is compiled out when the SPM
/// package isn't linked, so the repo builds with or without RevenueCat present.
///
/// ── THE FIXED BUGS THIS FILE MUST NOT RE-INTRODUCE ──────────────────────────────────────────────
/// Each of these was found the expensive way once already. They are re-stated at their call sites:
///
///   1. An already-owned non-consumable tapped OFFLINE resolves `purchased`, never `error`.
///      Ownership is read from LOCAL cached data, never from a network call that fails open.
///   2. A user dismissing the purchase sheet is `cancelled`, never `error`. (App Review 2.1.0.)
///   3. A read that could not be answered THROWS rather than returning a negative. `syncPro()`
///      revokes only on a definitive "you own nothing" from both sources; a call that quietly
///      returns "no" on a network blip would log paying subscribers out of what they bought.
///   4. Lifetime is identified by IDENTITY (a non-subscription purchase of that exact product id),
///      never by "an active entitlement with no expiry date".
///   5. Prices are always the store's localized string. This file never formats currency.
///   6. Trial eligibility is per PRODUCT ROW, never the selected plan's terms shown on every row.
///   7. The customer-info listener is registered exactly once. Two would double-deliver.
///
/// ── WHAT STAYS ON APPLE'S APIs ON PURPOSE ───────────────────────────────────────────────────────
/// `originalPurchase()` and `requestReview()` are NOT routed here.
///
/// `requestReview()` is not a purchase concern at all — it is the App Store rating prompt.
///
/// `originalPurchase()` is the paid-era grandfathering check, and RevenueCat's equivalent
/// (`CustomerInfo.originalApplicationVersion`) is strictly WEAKER than `AppTransaction`:
///   • it is an unauthenticated string with no `revocationDate`, so a refunded original download
///     cannot be distinguished from an honoured one, and
///   • it is derived from the same receipt field, so it carries the identical sandbox hazard
///     (`"1.0"` for every sandbox and TestFlight install) with less context to guard against it.
/// `AppTransaction` is Apple-signed, on-device, free, and already correct — including the
/// production-only guard that stops every TestFlight tester reading as a paid-era owner. Swapping a
/// stronger signal for a weaker one to satisfy tidiness would be a regression. It stays.
extension SiliconStoreKitPlugin {

    // MARK: - Configuration

    /// Configure the SDK exactly once, at plugin load.
    ///
    /// **Anonymous app user IDs on purpose.** This app has no accounts, no login, and no server.
    /// RevenueCat generates and persists an anonymous id per install, which is precisely the right
    /// model here — inventing a login to satisfy an SDK would be a product change, not a migration
    /// step. `Purchases.logIn` is therefore never called.
    func rc_configureIfNeeded() {
        guard RevenueCatConfig.isAvailable, !Purchases.isConfigured else { return }

        #if DEBUG
        Purchases.logLevel = .debug
        #else
        Purchases.logLevel = .warn
        #endif

        // `storeKitVersion: .storeKit2` is already the SDK default; it is stated explicitly because
        // this app's minimum is iOS 15 and StoreKit 2 is what the previous implementation used, so
        // the underlying purchase machinery is unchanged by the migration — only who drives it is.
        let configuration = Configuration.Builder(withAPIKey: RevenueCatConfig.publicAPIKey)
            .with(storeKitVersion: .storeKit2)
            // Apple's own message sheets (price-increase consent, billing issues) keep showing
            // themselves. Suppressing them would remove a cancel/repair path the user is entitled to.
            .with(showStoreMessagesAutomatically: true)
            .build()

        Purchases.configure(with: configuration)

        // ONE listener, forever. `PurchasesDelegate` replaces the StoreKit 2 `Transaction.updates`
        // loop — that loop must stay off in this backend (see `SiliconStoreKit.load()`), because
        // finishing transactions behind RevenueCat's back would race its own queue handling.
        Purchases.shared.delegate = self
    }

    // MARK: - Customer info (the one read everything else is built on)

    /// Current customer info, with an explicit cache fallback.
    ///
    /// The SDK caches `CustomerInfo` and normally serves it when the network is unavailable, but
    /// "normally" is not good enough for the read that decides whether to revoke a paid entitlement.
    /// So the fallback is written out here: try live, fall back to the cache, and if there is
    /// genuinely nothing to answer with, **throw** — an unanswerable read must reach `syncPro()` as
    /// a rejection, not as "you own nothing".
    private func rc_customerInfo() async throws -> CustomerInfo {
        do {
            return try await Purchases.shared.customerInfo()
        } catch {
            if let cached = Purchases.shared.cachedCustomerInfo { return cached }
            throw error
        }
    }

    /// The `pro` entitlement, if it is currently entitling this user.
    ///
    /// `activeInCurrentEnvironment` rather than `active`: `active` is "active in ANY environment",
    /// which would let a sandbox entitlement unlock a production build. The current-environment form
    /// is what makes sandbox testing work in TestFlight *and* keeps production honest.
    private func rc_activeProEntitlement(_ info: CustomerInfo) -> EntitlementInfo? {
        return info.entitlements.activeInCurrentEnvironment[RevenueCatConfig.entitlementIdentifier]
    }

    /// True when this exact product id is held as a NON-SUBSCRIPTION purchase (Pro Lifetime, the
    /// legacy Creative Mode unlock). Identity, not inference — see trap 4.
    ///
    /// Deliberately NOT `allPurchasedProductIdentifiers`, which also contains every subscription the
    /// user has ever had, including long-lapsed ones. "Has ever purchased" must never grant.
    private func rc_ownsNonSubscription(_ productId: String, in info: CustomerInfo) -> Bool {
        return info.nonSubscriptions.contains { $0.productIdentifier == productId }
    }

    // MARK: - Products

    func rc_getProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        Task {
            let products = await Purchases.shared.products([productId])
            guard let product = products.first else { return call.resolve(["available": false]) }
            var payload = await self.rc_describe(product)
            payload["available"] = true
            call.resolve(payload)
        }
    }

    /// Batch metadata fetch. Ids RevenueCat can't resolve are simply absent from `products`, so the
    /// paywall renders only rows the store confirmed it can sell — a buy button can never be
    /// presented for something that would error on tap (App Review 2.1.0).
    func rc_getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        guard !ids.isEmpty else { return call.resolve(["products": []]) }
        Task {
            let products = await Purchases.shared.products(ids)
            guard !products.isEmpty else {
                // Not fatal: an unreachable store is a retry state in the UI, not an error dialog.
                return call.resolve(["products": []])
            }

            // Eligibility is fetched ONCE for the whole batch and then read per row. Asking per
            // product would be several extra round-trips for the same answer, and — more
            // importantly — a partially-failed batch would hand different rows different truths.
            let subscriptionIds = products
                .filter { $0.productCategory == .subscription }
                .map { $0.productIdentifier }
            var eligibility: [String: IntroEligibility] = [:]
            if !subscriptionIds.isEmpty {
                eligibility = await Purchases.shared
                    .checkTrialOrIntroDiscountEligibility(productIdentifiers: subscriptionIds)
            }

            // One customer-info read for the whole batch, for the `owned` flag on non-consumables.
            // A failure here is NOT fatal to the catalog: not knowing whether Lifetime is already
            // owned costs a slightly wrong badge, whereas failing the catalog would blank the
            // paywall. Ownership that actually matters is decided in `isOwned`/`purchase`.
            let info = try? await self.rc_customerInfo()

            var out: [[String: Any]] = []
            for product in products {
                out.append(await self.rc_describe(product, eligibility: eligibility, info: info))
            }
            call.resolve(["products": out])
        }
    }

    /// One product, flattened for the bridge — the same shape `SiliconStoreKit.describe` produces.
    private func rc_describe(
        _ product: StoreProduct,
        eligibility: [String: IntroEligibility]? = nil,
        info: CustomerInfo? = nil
    ) async -> [String: Any] {
        var payload: [String: Any] = [
            "id": product.productIdentifier,
            "displayName": product.localizedTitle,
            "description": product.localizedDescription,
            // ALWAYS the store's localized string. Formatting a price in app code that the store
            // then charges differently is an Apple 3.1.2 rejection. See trap 5.
            "price": product.localizedPriceString,
            "kind": Self.rc_kindLabel(product.productType),
        ]

        if product.productCategory == .subscription {
            if let groupId = product.subscriptionGroupIdentifier {
                payload["groupId"] = groupId
            }
            if let period = product.subscriptionPeriod {
                payload["periodUnit"] = Self.rc_periodUnitLabel(period.unit)
                payload["periodCount"] = period.value
            }

            // Per ROW, never the selected plan's terms echoed onto every row (trap 6). An Apple ID
            // that already used the trial anywhere in the group is ineligible and must not be shown
            // trial copy — promising a free trial the store won't honour is a false claim.
            let status: IntroEligibilityStatus
            if let cached = eligibility?[product.productIdentifier]?.status {
                status = cached
            } else {
                status = await Purchases.shared.checkTrialOrIntroDiscountEligibility(product: product)
            }
            let eligible = status == .eligible
            payload["introEligible"] = eligible
            if eligible, let intro = product.introductoryDiscount {
                payload["introPeriod"] = Self.rc_periodDescription(intro.subscriptionPeriod)
            }
        } else {
            // Non-consumables (Lifetime, the legacy Creative Mode unlock) can already be owned.
            // Unknown (customer info unreadable) reports `false`: this flag only drives an "owned"
            // badge, and the purchase path re-checks ownership locally before charging anyone.
            let owned = info.map { self.rc_ownsNonSubscription(product.productIdentifier, in: $0) } ?? false
            payload["owned"] = owned
        }

        return payload
    }

    private static func rc_kindLabel(_ type: StoreProduct.ProductType) -> String {
        switch type {
        case .autoRenewableSubscription: return "auto-renewable"
        case .nonConsumable: return "non-consumable"
        case .consumable: return "consumable"
        case .nonRenewableSubscription: return "non-renewable"
        @unknown default: return "unknown"
        }
    }

    private static func rc_periodUnitLabel(_ unit: SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return "period"
        }
    }

    private static func rc_periodDescription(_ period: SubscriptionPeriod) -> String {
        let unit = rc_periodUnitLabel(period.unit)
        let count = period.value
        return count == 1 ? "1 \(unit)" : "\(count) \(unit)s"
    }

    // MARK: - Purchase

    func rc_purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        Task {
            // ── Trap 1: the offline-owned path ──────────────────────────────────────────────────
            // Checked FIRST, and against the LOCAL cache only. `Purchases.products(_:)` is a network
            // call; an already-owned Lifetime tapped with no connection used to resolve "error"
            // instead of the "purchased" it plainly is. `cachedCustomerInfo` never hits the network,
            // so it cannot fail open into charging someone twice or erroring at someone who owns it.
            //
            // Non-subscriptions only. Subscriptions are exempt because StoreKit handles
            // upgrade/crossgrade inside a group, and short-circuiting here would trap a monthly
            // subscriber who wants to move to yearly.
            if let cached = Purchases.shared.cachedCustomerInfo,
               self.rc_ownsNonSubscription(productId, in: cached) {
                return call.resolve(["status": "purchased"])
            }

            let products = await Purchases.shared.products([productId])
            guard let product = products.first else {
                return call.resolve(["status": "unavailable", "message": "This item isn't available right now."])
            }

            do {
                let result = try await Purchases.shared.purchase(product: product)
                if result.userCancelled {
                    // ── Trap 2 ──────────────────────────────────────────────────────────────────
                    // NOT an error. Dismissing the sheet means no charge and nothing went wrong;
                    // surfacing it as a failure is a documented App Review 2.1.0 rejection.
                    return call.resolve(["status": "cancelled"])
                }
                call.resolve(["status": "purchased"])
            } catch {
                call.resolve(Self.rc_purchaseFailure(error))
            }
        }
    }

    /// Map a thrown RevenueCat error onto the bridge's purchase status vocabulary.
    ///
    /// The SDK throws `NSError`; `asErrorCode` is the supported way to recover the typed code. The
    /// three cases that are NOT errors-to-the-user are separated out deliberately.
    private static func rc_purchaseFailure(_ error: Error) -> [String: Any] {
        guard let code = (error as NSError).asErrorCode else {
            return ["status": "error", "message": error.localizedDescription]
        }
        switch code {
        case .purchaseCancelledError:
            // A cancel can arrive as a thrown error as well as the `userCancelled` flag. Both roads
            // lead to the same place: no charge, no banner, nothing to apologise for.
            return ["status": "cancelled"]
        case .paymentPendingError:
            // Ask-to-Buy / Strong Customer Authentication. It unlocks on its own via the customer
            // info listener once approved — nothing is granted now.
            return ["status": "pending", "message": "Your purchase is pending approval."]
        case .productNotAvailableForPurchaseError, .productAlreadyPurchasedError, .purchaseNotAllowedError:
            return ["status": "unavailable", "message": (error as NSError).localizedDescription]
        default:
            return ["status": "error", "message": (error as NSError).localizedDescription]
        }
    }

    // MARK: - Restore & ownership

    /// App Store "Restore Purchases". Reports EVERY current entitlement — owned non-subscriptions
    /// AND any live subscription — because a subscriber reinstalling has nothing else to recover
    /// from. Apple requires this path to exist on the paywall.
    func rc_restore(_ call: CAPPluginCall) {
        Task {
            do {
                let info = try await Purchases.shared.restorePurchases()
                var owned = Set(info.nonSubscriptions.map { $0.productIdentifier })
                owned.formUnion(info.activeSubscriptions)
                for (_, entitlement) in info.entitlements.activeInCurrentEnvironment {
                    owned.insert(entitlement.productIdentifier)
                }
                let list = Array(owned).sorted()
                if let productId = call.getString("productId") {
                    call.resolve(["restored": list.contains(productId), "owned": list])
                } else {
                    call.resolve(["restored": !list.isEmpty, "owned": list])
                }
            } catch {
                // A restore that failed (sign-in cancelled, offline) reports nothing restored — it
                // never revokes. `proStore.restorePro()` follows up with `syncPro()` regardless.
                call.resolve(["restored": false, "owned": []])
            }
        }
    }

    /// Does this device hold the given NON-SUBSCRIPTION product?
    ///
    /// ⚠️ This is the lifetime half of `syncPro()`'s revoke rule, so its failure mode is
    /// load-bearing: it must REJECT when it cannot answer, never resolve `false`. Resolving `false`
    /// on a network blip is exactly the partial read that would strip a Lifetime owner.
    func rc_isOwned(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        Task {
            do {
                let info = try await self.rc_customerInfo()
                call.resolve(["owned": self.rc_ownsNonSubscription(productId, in: info)])
            } catch {
                call.reject("Could not read purchases: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Subscription status

    /// Live standing for the recurring Pro SKUs, read off the `pro` entitlement.
    ///
    /// `groupId` is accepted for interface compatibility but is not used as a lookup key: RevenueCat
    /// models this as an entitlement rather than an App Store subscription group. It is still
    /// validated so a caller passing nothing gets the same rejection it always did.
    ///
    /// **Grace period is entitling.** `EntitlementInfo.isActive` stays true while Apple retries a
    /// failed payment, which matches what this app has always done and is the humane behaviour —
    /// most of that churn is an expired card, not a decision. `inGracePeriod` is reported separately
    /// so `ProNudge` can show the billing strip WITHOUT the user losing access, and so a plain
    /// expiry never gets mistaken for a billing problem.
    ///
    /// **Only the recurring SKUs report here.** A Lifetime owner also has an active `pro`
    /// entitlement, but it is answered by `isOwned` one step earlier in `syncPro()`. Reporting it
    /// here as well would describe a permanent purchase in subscription terms — and an entitlement
    /// with no `expirationDate` is exactly the shape that must never be read as a subscription.
    func rc_subscriptionStatus(_ call: CAPPluginCall) {
        guard call.getString("groupId") != nil else { return call.reject("Missing groupId") }
        Task {
            do {
                let info = try await self.rc_customerInfo()
                guard let entitlement = self.rc_activeProEntitlement(info),
                      Self.rc_recurringProductIds.contains(entitlement.productIdentifier) else {
                    return call.resolve(["active": false])
                }

                var payload: [String: Any] = [
                    "active": true,
                    "productId": entitlement.productIdentifier,
                    // A billing issue that is still open WHILE the entitlement is active is the
                    // grace period. `billingIssueDetectedAt` alone is not enough — it also survives
                    // on a lapsed entitlement, where the user has simply expired.
                    "inGracePeriod": entitlement.billingIssueDetectedAt != nil,
                    // `.trial` only. `.intro` is a discounted paid period, not a free trial, and
                    // labelling it "Free trial — 6 days left" would be a false claim.
                    "isTrial": entitlement.periodType == .trial,
                    "willRenew": entitlement.willRenew,
                ]
                // May legitimately be absent. The JS side never treats a missing date as expired —
                // it anchors a bounded trust window instead (see `pro.ts`). Trap 3.
                if let expires = entitlement.expirationDate {
                    payload["expiresAt"] = ISO8601DateFormatter().string(from: expires)
                }
                call.resolve(payload)
            } catch {
                // Unanswerable — must reject, never resolve `active: false`. See trap 3.
                call.reject("Could not read subscription status: \(error.localizedDescription)")
            }
        }
    }

    /// The two auto-renewable SKUs. Kept in sync with `PRO_PRODUCTS` in `src/state/pro.ts`; the
    /// Lifetime SKU is deliberately absent because it is not a subscription.
    private static let rc_recurringProductIds: Set<String> = [
        "com.wrexist.silicon.pro.monthly",
        "com.wrexist.silicon.pro.yearly",
    ]

    // MARK: - Manage subscriptions

    /// The cancel path. There must ALWAYS be one — losing it is an App Review failure and, more to
    /// the point, it is the user's money. Three fallbacks deep on purpose:
    ///   1. Apple's native sheet in this app's own window scene (best: never leaves the app),
    ///   2. RevenueCat's `managementURL` (correct even for a non-App-Store purchase),
    ///   3. the account subscriptions URL (always resolves to something).
    func rc_manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            let scene = self.bridge?.viewController?.view.window?.windowScene
                ?? UIApplication.shared.connectedScenes
                    .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene

            if let windowScene = scene {
                do {
                    try await AppStore.showManageSubscriptions(in: windowScene)
                    return call.resolve(["shown": true])
                } catch {
                    /* fall through to the URL fallbacks */
                }
            }

            let managementURL = Purchases.shared.cachedCustomerInfo?.managementURL
            if let url = managementURL ?? URL(string: "https://apps.apple.com/account/subscriptions") {
                UIApplication.shared.open(url)
            }
            call.resolve(["shown": false])
        }
    }
}

// MARK: - Customer info listener

/// ONE listener for out-of-band entitlement changes — Ask-to-Buy approvals, Family Sharing, a
/// renewal landing while the app is open, a purchase made on another device.
///
/// This REPLACES the StoreKit 2 `Transaction.updates` loop in this backend; both must never run at
/// once. Two would double-deliver every transaction, and the StoreKit loop's `transaction.finish()`
/// would race RevenueCat's own queue handling.
extension SiliconStoreKitPlugin: PurchasesDelegate {

    @objc public func purchases(_ purchases: Purchases, receivedUpdated customerInfo: CustomerInfo) {
        // The delegate can fire repeatedly with an unchanged payload (a cache refresh, an app
        // foreground). Each event costs the JS side a full `syncPro()` — three bridge round-trips —
        // so only forward a genuine change in standing.
        let signature = Self.rc_signature(customerInfo)
        guard signature != rc_lastNotifiedSignature else { return }
        rc_lastNotifiedSignature = signature

        // The legacy Creative Mode unlock is a separate, permanent entitlement that is deliberately
        // NOT attached to `pro`, so it has to be named explicitly — the JS handler grants it on
        // seeing this product id and grants nothing on any other.
        let legacyCreativeMode = "com.wrexist.silicon.sandbox"
        if customerInfo.nonSubscriptions.contains(where: { $0.productIdentifier == legacyCreativeMode }) {
            notifyListeners("transactionUpdated", data: ["productId": legacyCreativeMode])
        }

        let productId = customerInfo.entitlements
            .activeInCurrentEnvironment[RevenueCatConfig.entitlementIdentifier]?
            .productIdentifier ?? ""
        notifyListeners("transactionUpdated", data: ["productId": productId])
    }

    /// A stable description of everything that could change what the user is entitled to.
    private static func rc_signature(_ info: CustomerInfo) -> String {
        let entitlements = info.entitlements.activeInCurrentEnvironment
            .map { key, value in
                "\(key):\(value.productIdentifier):\(value.expirationDate?.timeIntervalSince1970 ?? 0)"
                    + ":\(value.willRenew):\(value.periodType.rawValue)"
                    + ":\(value.billingIssueDetectedAt != nil)"
            }
            .sorted()
        let owned = info.nonSubscriptions.map { $0.productIdentifier }.sorted()
        return (entitlements + owned).joined(separator: "|")
    }
}

/// Backing store for the de-duplication signature. A file-private global rather than a stored
/// property because Swift extensions cannot add stored properties, and the plugin is a singleton
/// for the lifetime of the process.
private var rc_lastNotifiedSignature = ""

#endif
