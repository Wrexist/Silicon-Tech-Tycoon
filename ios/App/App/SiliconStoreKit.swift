import Foundation
import Capacitor
import StoreKit
import UIKit

/// StoreKit 2 bridge for everything Silicon sells:
///
///   • `com.wrexist.silicon.pro.monthly` / `.yearly` — auto-renewable, one subscription group
///   • `com.wrexist.silicon.pro.lifetime`            — non-consumable, permanent Pro
///   • `com.wrexist.silicon.sandbox`                 — the paid era's Creative Mode unlock (legacy,
///                                                     still honoured for everyone who bought it)
///
/// ── TWO BACKENDS, ONE INTERFACE ─────────────────────────────────────────────────────────────────
/// The purchase methods below route through `RevenueCatConfig.backend`:
///
///   • `.storeKit2`  — the bodies in THIS file. Apple's StoreKit 2, on-device, no third party.
///   • `.revenueCat` — the bodies in `SiliconStoreKit+RevenueCat.swift`, which wrap RevenueCat's
///                     native iOS SDK behind these exact same result contracts.
///
/// The StoreKit 2 code is kept complete and untouched rather than deleted, so reverting the
/// migration is a one-line change to `RevenueCatConfig` and a patch release — not a rebuild. When
/// the RevenueCat SPM package isn't linked, or no public API key is configured, the backend
/// resolves to `.storeKit2` automatically and this file is the whole story.
///
/// `originalPurchase()` and `requestReview()` NEVER route away from Apple's APIs. The first is the
/// Apple-signed paid-era grandfathering check (`AppTransaction`), which is strictly stronger than
/// any SDK's copy of the same receipt field; the second isn't a purchase concern at all.
///
/// Auto-registered by Capacitor via `CAPBridgedPlugin`. The JS side reaches it through
/// `registerPlugin("SiliconStoreKit")` in `src/state/storeKitBridge.ts`.
///
/// Result contracts (mirror the TypeScript types in `storeKitBridge.ts`):
///   getProduct           -> { available, id?, displayName?, description?, price?, owned? }
///   getProducts          -> { products: [{ id, displayName, description, price, owned, kind,
///                                          periodUnit?, periodCount?, introEligible?,
///                                          introPeriod?, groupId? }] }
///   purchase             -> { status: "purchased" | "cancelled" | "pending" | "unavailable" | "error", message? }
///   restore              -> { restored: Bool, owned: [String] }
///   isOwned              -> { owned: Bool }
///   subscriptionStatus   -> { active, productId?, expiresAt?, isTrial?, willRenew?, inGracePeriod? }
///   manageSubscriptions  -> { shown: Bool }
///   originalPurchase     -> { originalBuild?: Int, originalVersion?: String }
@objc(SiliconStoreKitPlugin)
public class SiliconStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SiliconStoreKitPlugin"
    public let jsName = "SiliconStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isOwned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "subscriptionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "originalPurchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise),
    ]

    /// Watches for transactions approved outside an active purchase() call — Ask-to-Buy approvals,
    /// Family Sharing, subscription renewals landing while the app is open, and purchases made on
    /// another device. Finishing them stops StoreKit re-delivering on every launch; the emitted
    /// event lets JS re-sync entitlements live.
    private var updatesTask: Task<Void, Never>?

    override public func load() {
        #if canImport(RevenueCat)
        // Configure the SDK before anything can call into it. No-ops unless a public key is set.
        rc_configureIfNeeded()
        #endif

        // The RevenueCat backend listens through `PurchasesDelegate` instead. Running BOTH would
        // double-deliver every out-of-band transaction, and finishing transactions here behind
        // RevenueCat's back would race its own queue handling.
        guard RevenueCatConfig.backend == .storeKit2 else { return }

        guard #available(iOS 15.0, *) else { return }
        updatesTask = Task.detached { [weak self] in
            for await update in Transaction.updates {
                guard case .verified(let transaction) = update else { continue }
                await transaction.finish()
                self?.notifyListeners("transactionUpdated", data: ["productId": transaction.productID])
            }
        }
    }

    deinit { updatesTask?.cancel() }

    // MARK: - Products

    @objc func getProduct(_ call: CAPPluginCall) {
        #if canImport(RevenueCat)
        if RevenueCatConfig.backend == .revenueCat { return rc_getProduct(call) }
        #endif
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else { return call.resolve(["available": false]) }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else { return call.resolve(["available": false]) }
                var payload = await self.describe(product)
                payload["available"] = true
                call.resolve(payload)
            } catch {
                call.reject("Could not load product: \(error.localizedDescription)")
            }
        }
    }

    /// Batch metadata fetch. Ids the store doesn't know are simply absent from the result — the JS
    /// paywall renders only rows the store confirmed it can sell, so a buy button can never be
    /// presented for a product that would error on tap (App Review 2.1.0).
    @objc func getProducts(_ call: CAPPluginCall) {
        #if canImport(RevenueCat)
        if RevenueCatConfig.backend == .revenueCat { return rc_getProducts(call) }
        #endif
        let ids = call.getArray("productIds", String.self) ?? []
        guard #available(iOS 15.0, *), !ids.isEmpty else { return call.resolve(["products": []]) }
        Task {
            do {
                let products = try await Product.products(for: Set(ids))
                var out: [[String: Any]] = []
                for product in products {
                    out.append(await self.describe(product))
                }
                call.resolve(["products": out])
            } catch {
                // Not fatal: an unreachable store is a retry state in the UI, not an error dialog.
                call.resolve(["products": []])
            }
        }
    }

    /// One product, flattened for the bridge. Prices are ALWAYS the store's localized
    /// `displayPrice` — the JS side never formats currency itself.
    @available(iOS 15.0, *)
    private func describe(_ product: Product) async -> [String: Any] {
        var payload: [String: Any] = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "price": product.displayPrice,
            "kind": Self.kindLabel(product.type),
        ]

        if let sub = product.subscription {
            payload["groupId"] = sub.subscriptionGroupID
            payload["periodUnit"] = Self.periodUnitLabel(sub.subscriptionPeriod.unit)
            payload["periodCount"] = sub.subscriptionPeriod.value
            // Eligibility is per Apple ID and per subscription group: a user who already used the
            // trial anywhere in the group is NOT eligible, and must not be shown trial copy.
            let eligible = await sub.isEligibleForIntroOffer
            payload["introEligible"] = eligible
            if eligible, let intro = sub.introductoryOffer {
                payload["introPeriod"] = Self.periodDescription(intro.period)
            }
        } else {
            // Non-consumables (Lifetime, the legacy Creative Mode unlock) can already be owned.
            payload["owned"] = await isEntitled(product.id)
        }

        return payload
    }

    @available(iOS 15.0, *)
    private static func kindLabel(_ type: Product.ProductType) -> String {
        switch type {
        case .autoRenewable: return "auto-renewable"
        case .nonConsumable: return "non-consumable"
        case .consumable: return "consumable"
        case .nonRenewable: return "non-renewable"
        default: return "unknown"
        }
    }

    @available(iOS 15.0, *)
    private static func periodUnitLabel(_ unit: Product.SubscriptionPeriod.Unit) -> String {
        switch unit {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return "period"
        }
    }

    @available(iOS 15.0, *)
    private static func periodDescription(_ period: Product.SubscriptionPeriod) -> String {
        let unit = periodUnitLabel(period.unit)
        let count = period.value
        return count == 1 ? "1 \(unit)" : "\(count) \(unit)s"
    }

    // MARK: - Purchase

    @objc func purchase(_ call: CAPPluginCall) {
        #if canImport(RevenueCat)
        if RevenueCatConfig.backend == .revenueCat { return rc_purchase(call) }
        #endif
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else {
            return call.resolve(["status": "unavailable", "message": "In-app purchases require iOS 15 or later."])
        }
        Task {
            // Ownership is checked FIRST, from the on-device entitlement set, because
            // `Product.products(for:)` is a network call: an already-owned Lifetime tapped with no
            // connection used to resolve "error" instead of the "purchased" it plainly is.
            //
            // Non-consumables only, and the type comes off the OWNED TRANSACTION — never off a
            // store lookup that could fail open. Subscriptions are exempt: StoreKit handles
            // upgrade/crossgrade within a group, and short-circuiting here would trap a monthly
            // subscriber who wants to move to yearly.
            if let owned = await self.ownedTransaction(productId), owned.productType != .autoRenewable {
                return call.resolve(["status": "purchased"])
            }

            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    return call.resolve(["status": "unavailable", "message": "This item isn't available right now."])
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve(["status": "purchased"])
                    case .unverified:
                        call.resolve(["status": "error", "message": "Your purchase could not be verified."])
                    }
                case .userCancelled:
                    // NOT an error. Dismissing the sheet means no charge and nothing went wrong;
                    // surfacing it as a failure is a documented App Review 2.1.0 rejection.
                    call.resolve(["status": "cancelled"])
                case .pending:
                    // Ask-to-Buy / Strong Customer Authentication — resolves later via Transaction.updates.
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.resolve(["status": "unavailable"])
                }
            } catch {
                call.resolve(["status": "error", "message": error.localizedDescription])
            }
        }
    }

    // MARK: - Restore & ownership

    /// Pull the latest entitlements from the App Store (may prompt sign-in; a cancel is fine), then
    /// report what the device holds. With no `productId` this reports EVERY current entitlement —
    /// owned non-consumables AND any live subscription — which is what the paywall's "Restore
    /// Purchases" needs, since a subscriber reinstalling has nothing else to recover from.
    @objc func restore(_ call: CAPPluginCall) {
        #if canImport(RevenueCat)
        if RevenueCatConfig.backend == .revenueCat { return rc_restore(call) }
        #endif
        guard #available(iOS 15.0, *) else { return call.resolve(["restored": false, "owned": []]) }
        Task {
            try? await AppStore.sync()
            var owned: [String] = []
            for await result in Transaction.currentEntitlements {
                if case .verified(let transaction) = result, transaction.revocationDate == nil {
                    owned.append(transaction.productID)
                }
            }
            if let productId = call.getString("productId") {
                call.resolve(["restored": owned.contains(productId), "owned": owned])
            } else {
                call.resolve(["restored": !owned.isEmpty, "owned": owned])
            }
        }
    }

    @objc func isOwned(_ call: CAPPluginCall) {
        #if canImport(RevenueCat)
        if RevenueCatConfig.backend == .revenueCat { return rc_isOwned(call) }
        #endif
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else { return call.resolve(["owned": false]) }
        Task { call.resolve(["owned": await self.isEntitled(productId)]) }
    }

    // MARK: - Subscription status

    /// Live standing for a subscription group. `active` covers every state that still entitles the
    /// user: subscribed, inside an introductory period, and the billing GRACE period (where Apple
    /// is re-attempting payment but access must continue).
    ///
    /// `.inBillingRetryPeriod` is a DIFFERENT RenewalState and is deliberately not entitling — it
    /// means retries are running with no grace period configured, so access has lapsed. Turning the
    /// grace period on in App Store Connect is what moves those users into the entitled case (see
    /// `appstore/SUBSCRIPTION_GUIDE.md`), and it is worth doing: most of that churn is an expired
    /// card rather than a decision.
    @objc func subscriptionStatus(_ call: CAPPluginCall) {
        #if canImport(RevenueCat)
        if RevenueCatConfig.backend == .revenueCat { return rc_subscriptionStatus(call) }
        #endif
        guard let groupId = call.getString("groupId") else { return call.reject("Missing groupId") }
        guard #available(iOS 15.0, *) else { return call.resolve(["active": false]) }
        Task {
            do {
                let statuses = try await Product.SubscriptionInfo.status(for: groupId)
                // A group can report SEVERAL entitling statuses at once — Family Sharing, or a
                // monthly and a yearly overlapping across a crossgrade boundary. Taking whichever
                // came first in the array would make the reported product, expiry and renewal
                // state depend on Apple's ordering, so rank instead and pick a definite winner:
                //   1. a live `.subscribed` beats a `.inGracePeriod` one (grace means payment is
                //      failing, and the strip in `ProNudge` should only fire when that is the
                //      user's actual standing),
                //   2. then the one that runs LONGEST — that is the access the user really has.
                let best = statuses
                    .filter { $0.state == .subscribed || $0.state == .inGracePeriod }
                    .compactMap { status -> (Product.SubscriptionInfo.Status, Transaction)? in
                        guard case .verified(let transaction) = status.transaction else { return nil }
                        return (status, transaction)
                    }
                    .max { a, b in
                        let aLive = a.0.state == .subscribed, bLive = b.0.state == .subscribed
                        if aLive != bLive { return bLive }
                        return (a.1.expirationDate ?? .distantFuture) < (b.1.expirationDate ?? .distantFuture)
                    }

                guard let (status, transaction) = best else { return call.resolve(["active": false]) }

                var payload: [String: Any] = [
                    "active": true,
                    "productId": transaction.productID,
                    "inGracePeriod": status.state == .inGracePeriod,
                ]
                if let expires = transaction.expirationDate {
                    payload["expiresAt"] = ISO8601DateFormatter().string(from: expires)
                }
                payload["isTrial"] = Self.isIntroductory(transaction)
                if case .verified(let renewal) = status.renewalInfo {
                    payload["willRenew"] = renewal.willAutoRenew
                }
                call.resolve(payload)
            } catch {
                call.reject("Could not read subscription status: \(error.localizedDescription)")
            }
        }
    }

    /// True while the transaction is running under an introductory (free-trial or intro-price)
    /// offer. Kept in one place because the API for this moved across iOS versions.
    @available(iOS 15.0, *)
    private static func isIntroductory(_ transaction: Transaction) -> Bool {
        if #available(iOS 17.2, *) {
            return transaction.offer?.type == .introductory
        }
        return transaction.offerType == .introductory
    }

    /// Apple's native "Manage Subscriptions" sheet — the correct destination for cancel/upgrade.
    /// Falls back to the account subscriptions URL if no window scene is reachable, so there is
    /// ALWAYS a way for the user to cancel (an App Review requirement, and simple decency).
    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        #if canImport(RevenueCat)
        if RevenueCatConfig.backend == .revenueCat { return rc_manageSubscriptions(call) }
        #endif
        DispatchQueue.main.async {
            let scene = self.bridge?.viewController?.view.window?.windowScene
                ?? UIApplication.shared.connectedScenes
                    .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
            guard #available(iOS 15.0, *), let windowScene = scene else {
                if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                    UIApplication.shared.open(url)
                }
                return call.resolve(["shown": false])
            }
            Task {
                do {
                    try await AppStore.showManageSubscriptions(in: windowScene)
                    call.resolve(["shown": true])
                } catch {
                    if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                        await UIApplication.shared.open(url)
                    }
                    call.resolve(["shown": false])
                }
            }
        }
    }

    // MARK: - Original purchase (paid-era grandfathering)

    /// The build number of the user's ORIGINAL download. Silicon shipped as a paid app before it
    /// went free, and everyone who bought it then keeps everything, forever — this is how the JS
    /// side recognises them ("Founding Owner"). On iOS `AppTransaction.originalAppVersion` carries
    /// the CFBundleVersion (the build number), not the marketing version.
    ///
    /// Requires iOS 16. On older systems this resolves empty and the user simply falls back to the
    /// normal Restore Purchases path.
    ///
    /// **It is a real App Store purchase.** In SANDBOX and TestFlight, `originalAppVersion`
    /// reports `"1.0"` regardless of what was actually installed. Parsed, that is build 1, which
    /// is below `FIRST_FREE_BUILD` and therefore reads as a paid-era owner — so every sandbox
    /// tester and every TestFlight build would silently get Pro for free, and the paywall could
    /// never be tested on the very builds it has to be tested on. `originalVersion` is still
    /// reported for diagnostics; only the entitling number is withheld.
    ///
    /// `AppTransaction` (unlike `Transaction`) carries no `revocationDate` — it describes the
    /// original download, not entitlement/refund state, so on-device alone this cannot tell a
    /// refunded paid-era purchase from a legitimate one. `RefundVerifyConfig` closes that gap: the
    /// app's signed `AppTransaction` (the `jwsRepresentation` off its enclosing
    /// `VerificationResult`) is sent to a small backend endpoint
    /// that asks Apple's App Store Server API for the authoritative revocation status — the one
    /// place that actually has it. A network failure there fails OPEN (keeps today's behaviour,
    /// same as every other "can't tell right now" path in this file) — it is never a reason to
    /// revoke a legitimate owner's access; only an explicit `revoked: true` withholds the grant.
    @objc func originalPurchase(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { return call.resolve([:]) }
        Task {
            do {
                let result = try await AppTransaction.shared
                guard case .verified(let appTransaction) = result else { return call.resolve([:]) }
                let raw = appTransaction.originalAppVersion
                var payload: [String: Any] = ["originalVersion": raw]
                // Take the leading integer: build numbers are "4", but a defensive parse also
                // handles a "1.2.0"-style value.
                if appTransaction.environment == .production,
                   let build = Int(raw.split(separator: ".").first.map(String.init) ?? raw) {
                    // NB: `jwsRepresentation` belongs to `VerificationResult`, NOT to the
                    // `AppTransaction` it wraps — so it reads off `result`, not `appTransaction`.
                    // (Getting this wrong is a compile error, not an SDK-version problem.)
                    let revoked = await RefundVerifyConfig.isRevoked(jws: result.jwsRepresentation)
                    if !revoked {
                        payload["originalBuild"] = build
                    }
                }
                call.resolve(payload)
            } catch {
                // Unverifiable receipt (jailbreak, sandbox oddity). Never a reason to error the UI.
                call.resolve([:])
            }
        }
    }

    // MARK: - Review prompt

    /// Ask the system to (maybe) show the App Store rating/review prompt. The OS decides whether to
    /// actually display it and rate-limits to a few times per year, so the JS side only ever calls
    /// this at a genuine high point (the first product launch). Never blocks; resolves immediately.
    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let scene = self.bridge?.viewController?.view.window?.windowScene
                ?? UIApplication.shared.connectedScenes
                    .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
            guard let windowScene = scene else { return call.resolve(["requested": false]) }
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: windowScene)
            } else {
                SKStoreReviewController.requestReview(in: windowScene)
            }
            call.resolve(["requested": true])
        }
    }

    // MARK: - Helpers

    /// The device's live, verified, non-revoked entitlement for a product, or nil.
    ///
    /// Returns the TRANSACTION rather than a Bool because the caller needs its `productType`, and
    /// the transaction is the only place that type is known WITHOUT a network round-trip.
    /// `Product.products(for:)` would answer the same question but is a store call that silently
    /// omits anything it can't resolve — so offline it can't distinguish "not a subscription" from
    /// "don't know", and guessing either way is wrong in a purchase path.
    @available(iOS 15.0, *)
    private func ownedTransaction(_ productId: String) async -> Transaction? {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == productId,
               transaction.revocationDate == nil {
                return transaction
            }
        }
        return nil
    }

    /// True if the device currently holds a verified, non-revoked entitlement for the product.
    @available(iOS 15.0, *)
    private func isEntitled(_ productId: String) async -> Bool {
        return await ownedTransaction(productId) != nil
    }
}
