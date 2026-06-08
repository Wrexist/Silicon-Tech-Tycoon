// Reads the marketing version from package.json and writes it into the iOS
// Xcode project (MARKETING_VERSION in project.pbxproj). Run after npm version
// or before a TestFlight build to keep both files in sync.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

const pbxPath = resolve(root, "ios/App/App.xcodeproj/project.pbxproj");

try {
  let pbx = readFileSync(pbxPath, "utf8");
  const updated = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
  if (updated === pbx) {
    console.log(`iOS MARKETING_VERSION is already ${version} — no change.`);
  } else {
    writeFileSync(pbxPath, updated);
    console.log(`Synced MARKETING_VERSION → ${version} in project.pbxproj`);
  }
} catch {
  // ios/ hasn't been generated yet (Linux CI or pre-first-cap-add) — skip silently.
  console.log(`ios/ not found — skipping iOS version sync (run 'npx cap add ios' first).`);
}
