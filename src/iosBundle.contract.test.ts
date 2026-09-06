/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Source-invariant guard on the iOS bundle's ORIENTATION CONTRACT — the one class of mistake that
// every check in this repo is blind to.
//
// `npm run typecheck`, `npm test` and `npm run build` all passed on the commit that enabled iPad
// (TARGETED_DEVICE_FAMILY 1 -> "1,2"), the iOS compile guard passed, and the archive built. The
// build then died at the very last step — `altool` upload, after a full macOS CI run — with:
//
//   ERROR 90474: Invalid bundle. The "…Portrait,…LandscapeLeft,…LandscapeRight" orientations were
//   provided for the UISupportedInterfaceOrientations Info.plist key in the com.wrexist.silicon
//   bundle, but you need to include all of the "…Portrait,…PortraitUpsideDown,…LandscapeLeft,
//   …LandscapeRight" orientations to support iPad multitasking.
//
// The rule Apple enforces, exactly:
//
//   An app that targets iPad and does NOT declare `UIRequiresFullScreen` is Split-View eligible, and
//   a Split-View app can be resized with the iPad held any way up — so it must accept ALL FOUR
//   orientations. Declaring three is not a smaller promise; it is an invalid bundle.
//
// Both legal configurations are therefore encoded below, rather than just the one we ship: drop
// upside-down only by opting out of multitasking, never by shortening the array.
//
// Read with node:fs, and latched against vacuity at the bottom, for the same reason
// proGates.enforcement.test.ts and tokenRefs.test.ts are: a scan that silently reads nothing passes
// every assertion in it.

const ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // repo root
const INFO_PLIST = join(ROOT, "ios", "App", "App", "Info.plist");
const PBXPROJ = join(ROOT, "ios", "App", "App.xcodeproj", "project.pbxproj");

const plist = readFileSync(INFO_PLIST, "utf8");
const pbxproj = readFileSync(PBXPROJ, "utf8");

/** The `<string>` values of the `<array>` that follows `<key>name</key>`. Null when absent. */
function plistStringArray(name: string): string[] | null {
  const key = new RegExp(`<key>${name.replace(/[~$]/g, "\\$&")}</key>\\s*<array>([\\s\\S]*?)</array>`);
  const block = plist.match(key);
  if (!block) return null;
  return [...block[1].matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1].trim());
}

/** True when `<key>name</key>` is followed by `<true/>`. */
function plistIsTrue(name: string): boolean {
  return new RegExp(`<key>${name}</key>\\s*<true/>`).test(plist);
}

const ALL_FOUR = [
  "UIInterfaceOrientationPortrait",
  "UIInterfaceOrientationPortraitUpsideDown",
  "UIInterfaceOrientationLandscapeLeft",
  "UIInterfaceOrientationLandscapeRight",
];

const targetsIpad = /TARGETED_DEVICE_FAMILY = "[^"]*\b2\b[^"]*"/.test(pbxproj);
const requiresFullScreen = plistIsTrue("UIRequiresFullScreen");
const ipadOrientations = plistStringArray("UISupportedInterfaceOrientations~ipad");

describe("the iOS bundle's iPad orientation contract", () => {
  it("declares iPad orientations at all, once the target ships to iPad", () => {
    if (!targetsIpad) return; // iPhone-only build: `~ipad` is legitimately absent
    expect(
      ipadOrientations,
      "TARGETED_DEVICE_FAMILY includes iPad but Info.plist has no UISupportedInterfaceOrientations~ipad",
    ).not.toBeNull();
  });

  it("supports ALL FOUR orientations while the app is Split-View eligible", () => {
    if (!targetsIpad || requiresFullScreen) return;
    expect(
      [...ipadOrientations!].sort(),
      "altool rejects the upload (error 90474) unless a multitasking-eligible iPad app lists all " +
        "four orientations. To drop upside-down, set UIRequiresFullScreen=true and give up Split " +
        "View — never shorten this array on its own.",
    ).toEqual([...ALL_FOUR].sort());
  });

  it("names only real UIInterfaceOrientation values — a typo would silently list nothing", () => {
    for (const o of ipadOrientations ?? []) expect(ALL_FOUR).toContain(o);
  });

  it("keeps the iPhone idiom portrait-only, which is a separate key and unaffected by the rule", () => {
    // Apple's all-four requirement is about iPad multitasking. The iPhone array stays as authored;
    // this pins that the fix above was applied to `~ipad` and did not leak into the phone build.
    expect(plistStringArray("UISupportedInterfaceOrientations")).toEqual([
      "UIInterfaceOrientationPortrait",
    ]);
  });

  it("scanned real files — the guard above is not vacuous", () => {
    expect(plist).toContain("<key>CFBundleIdentifier</key>");
    expect(pbxproj).toContain("TARGETED_DEVICE_FAMILY");
    // The repo ships iPad today; if that is ever deliberately reverted, this is the line to change,
    // and changing it consciously is the point.
    expect(targetsIpad, "expected this build to target iPad").toBe(true);
    expect(ipadOrientations, "expected `~ipad` orientations to be found by the parser").not.toBeNull();
  });
});
