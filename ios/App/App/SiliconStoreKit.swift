import Foundation
import Capacitor
import StoreKit
import UIKit

/// Minimal StoreKit 2 bridge for the single non-consumable IAP — the "Creative Mode" / Sandbox
/// unlock (`com.wrexist.silicon.sandbox`). Deliberately NOT a third-party purchase SDK: this keeps
/// the App Privacy "Data Not Collected / no third-party SDKs" declaration literally true, needs no
/// backend (StoreKit 2 verifies on-device), and fits the SPM-only iOS target (no CocoaPods).
///
/// Auto-registered by Capacitor via `CAPBridgedPlugin` (no AppDelegate wiring needed). The JS side
/// calls it through `registerPlugin("SiliconStoreKit")` in `src/state/iap.ts`.
///
/// Result contracts (mirror the TS `PurchaseStatus`):
///   getProduct -> { available, id?, displayName?, description?, price?, owned? }
///   purchase   -> { status: "purchased" | "cancelled" | "pending" | "unavailable" | "error", message? }
///   restore    -> { restored: Bool }
///   isOwned    -> { owned: Bool }
@objc(SiliconStoreKitPlugin)
public class SiliconStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SiliconStoreKitPlugin"
    public let jsName = "SiliconStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isOwned", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise),
    ]

    /// Watches for transactions approved outside an active purchase() call — Ask-to-Buy approvals,
    /// Family Sharing, re-downloads on another device. Finishing them stops StoreKit from
    /// re-delivering on every launch; the emitted event lets JS grant the entitlement live.
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

    // MARK: - Bridged methods

    @objc func getProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else { return call.resolve(["available": false]) }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else { return call.resolve(["available": false]) }
                let owned = await self.isEntitled(productId)
                call.resolve([
                    "available": true,
                    "id": product.id,
                    "displayName": product.displayName,
                    "description": product.description,
                    "price": product.displayPrice,
                    "owned": owned,
                ])
            } catch {
                call.reject("Could not load product: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else {
            return call.resolve(["status": "unavailable", "message": "In-app purchases require iOS 15 or later."])
        }
        Task {
            // Already entitled — never start a second payment for a non-consumable.
            if await self.isEntitled(productId) { return call.resolve(["status": "purchased"]) }
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

    @objc func restore(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else { return call.resolve(["restored": false]) }
        Task {
            // Pull the latest entitlements from the App Store (may prompt sign-in; cancel is fine),
            // then report ownership from the on-device entitlement set.
            try? await AppStore.sync()
            call.resolve(["restored": await self.isEntitled(productId)])
        }
    }

    @objc func isOwned(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else { return call.reject("Missing productId") }
        guard #available(iOS 15.0, *) else { return call.resolve(["owned": false]) }
        Task { call.resolve(["owned": await self.isEntitled(productId)]) }
    }

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
