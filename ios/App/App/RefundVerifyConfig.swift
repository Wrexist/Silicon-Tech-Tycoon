import Foundation

/// Server-side confirmation that a paid-era app purchase has not been refunded.
///
/// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
/// `AppTransaction` (StoreKit 2) has no `revocationDate` — only `Transaction` does, and the app's
/// own paid-era download never shows up as a `Transaction` at all (`Transaction.all` /
/// `.currentEntitlements` only cover in-app purchases and subscriptions). So there is no on-device
/// signal for "was the app itself refunded" — the ONLY authority for that is Apple's App Store
/// Server API. This talks to a small stateless backend (Vercel function, `SiliconStoreKit.swift`
/// §`originalPurchase`) that holds the App Store Connect API key and makes that call so the key
/// never ships inside the app binary.
///
/// ── FAIL-SAFE BY CONSTRUCTION ───────────────────────────────────────────────────────────────────
/// A network failure, timeout, or backend outage answers `false` (not revoked) — this NEVER
/// revokes a legitimate owner's access on ambiguous failure, matching every other entitlement check
/// in `SiliconStoreKit.swift`. Only an explicit `revoked: true` from the backend withholds the
/// founding-owner grant. This does mean a refund made while the device is fully offline forever
/// goes undetected until the next successful check — an accepted tradeoff, since `originalPurchase`
/// re-runs (and re-verifies) on every `syncPro()` call, not just once.
enum RefundVerifyConfig {

    /// The verification endpoint. Empty means "not configured" — `isRevoked` then answers `false`
    /// immediately without a network call, so this can land before the backend exists.
    private static let endpoint = "https://silicon-refund-verify.vercel.app/api/verify-app-transaction"

    private struct RequestBody: Encodable {
        let signedTransaction: String
    }

    private struct ResponseBody: Decodable {
        let revoked: Bool
    }

    /// Asks the backend whether the app purchase behind this signed `AppTransaction` has been
    /// refunded. Never throws; any failure (network, decoding, timeout, missing config) answers
    /// `false`.
    static func isRevoked(jws: String) async -> Bool {
        guard let url = URL(string: endpoint), !endpoint.isEmpty else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 8
        do {
            request.httpBody = try JSONEncoder().encode(RequestBody(signedTransaction: jws))
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return false }
            return try JSONDecoder().decode(ResponseBody.self, from: data).revoked
        } catch {
            return false
        }
    }
}
