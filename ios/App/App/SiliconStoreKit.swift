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
/// Deliberately NOT a third-party purchase SDK. StoreKit 2 verifies on-device, needs no backend, and
/// keeps the App Privacy "Data Not Collected / no third-party SDKs" declaration literally true —
/// which is a selling point the store listing leans on, not just a technical preference. It also
/// suits the SPM-only iOS target (no CocoaPods).
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
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else {
            return call.resolve(["status": "unavailable", "message": "In-app purchases require iOS 15 or later."])
        }
        Task {
            // Ownership is checked FIRST, from the on-device entitlement set, because
            // `Product.products(for:)` is a network call: an already-owned Lifetime tapped with no
            // connection used to resolve "error" instead of the "purchased" it plainly is.
            //
            // Non-consumables only. Subscriptions are exempt — StoreKit handles upgrade/crossgrade
            // within a group, and short-circuiting here would trap a monthly subscriber who wants
            // to move to yearly.
            if await self.isEntitled(productId), await self.isNonSubscription(productId) {
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
    /// report what the device holds. With no `productId` this reports EVERY owned non-consumable,
    /// which is what the paywall's "Restore Purchases" needs.
    @objc func restore(_ call: CAPPluginCall) {
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
        guard let groupId = call.getString("groupId") else { return call.reject("Missing groupId") }
        guard #available(iOS 15.0, *) else { return call.resolve(["active": false]) }
        Task {
            do {
                let statuses = try await Product.SubscriptionInfo.status(for: groupId)
                // A group can report several statuses (e.g. family sharing, or a lapsed SKU beside a
                // live one). Any entitling state wins.
                for status in statuses {
                    let entitling: Bool
                    switch status.state {
                    case .subscribed, .inGracePeriod: entitling = true
                    default: entitling = false
                    }
                    guard entitling,
                          case .verified(let transaction) = status.transaction else { continue }

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
                    return call.resolve(payload)
                }
                call.resolve(["active": false])
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
    @objc func originalPurchase(_ call: CAPPluginCall) {
        guard #available(iOS 16.0, *) else { return call.resolve([:]) }
        Task {
            do {
                let result = try await AppTransaction.shared
                guard case .verified(let appTransaction) = result else { return call.resolve([:]) }
                let raw = appTransaction.originalAppVersion
                var payload: [String: Any] = ["originalVersion": raw]
                // Take the leading integer: build numbers are "4", but a defensive parse also
                // handles a "1.2.0"-style value from a TestFlight/sandbox context.
                if let build = Int(raw.split(separator: ".").first.map(String.init) ?? raw) {
                    payload["originalBuild"] = build
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

    /// True when the product is a one-time purchase rather than a subscription. Falls back to
    /// `true` when the store can't be reached: the caller only asks after confirming the device is
    /// already entitled, and an entitled-but-unreadable product is far more likely to be the
    /// Lifetime/Creative-Mode non-consumable than an active subscription (whose status is read
    /// through `subscriptionStatus`, not here).
    @available(iOS 15.0, *)
    private func isNonSubscription(_ productId: String) async -> Bool {
        guard let product = try? await Product.products(for: [productId]).first else { return true }
        return product.subscription == nil
    }

    /// True if the device currently holds a verified, non-revoked entitlement for the product.
    @available(iOS 15.0, *)
    private func isEntitled(_ productId: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == productId,
               transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }
}
