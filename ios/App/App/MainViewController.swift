import Capacitor

/// Capacitor 6's `CAPBridgedPlugin` auto-discovery registers the npm/package plugins (listed in the
/// generated SPM `Package.swift`) but does NOT pick up a plugin that lives in the app target — so the
/// JS bridge can't find `"SiliconStoreKit"` and every `purchase()`/`getProduct()` call rejects with
/// "The purchase couldn't be started". (A compile-time keep-alive in AppDelegate fixes dead-stripping
/// but not this discovery gap.) Register the instance explicitly here — `capacitorDidLoad()` is the
/// documented Capacitor 6 hook that runs once the bridge exists.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SiliconStoreKitPlugin())
    }
}
