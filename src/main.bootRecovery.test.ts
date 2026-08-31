/// <reference types="node" />
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A boot that throws before React mounts has no boundary above it: the inline splash from index.html
// stays on screen forever — a frozen logo, a bar stuck near the end, no message and no way out.
// lazyBoundaries.test.ts pins the two coarse facts (the rejection is caught at all, and the screen
// offers a reload). What is pinned HERE is that the resulting state is RECOVERABLE rather than
// merely non-silent, and that the recovery screen itself cannot fail the same way the boot did:
//
//   • the frozen splash is REMOVED (otherwise the error screen renders underneath it)
//   • the player is told what happened and that their company is still on the device
//   • there are two exits: Reload for the transient causes, and a guarded Reset for a save that
//     cannot be loaded at all — the destructive one behind a second tap, like the in-app crash card
//   • it is raw DOM. React, the design tokens and the stylesheets are all things that may be exactly
//     what failed, so the screen that reports the failure must not depend on any of them.
//
// Source-invariant, like its neighbours: this code runs before React and there is no seam to call.
const SRC = readFileSync(resolve(__dirname, "./main.tsx"), "utf8");

/** The failure screen itself, so these assertions can't be satisfied by unrelated code in main.tsx. */
const SCREEN = (() => {
  const start = SRC.indexOf("function showBootFailure(");
  expect(start, "main.tsx no longer defines showBootFailure — the boot failure path moved").toBeGreaterThan(-1);
  return SRC.slice(start);
})();

describe("a boot failure leaves a recoverable screen, not a frozen splash", () => {
  it("removes the inline boot splash", () => {
    // Without this the splash sits on top of the error screen and the app still looks hung.
    expect(SCREEN).toMatch(/getElementById\("boot"\)/);
    expect(SCREEN).toMatch(/splash\.remove\(\)/);
  });

  it("takes over the page and says what happened", () => {
    expect(SCREEN).toMatch(/getElementById\("root"\) \?\? document\.body/);
    expect(SCREEN).toMatch(/host\.innerHTML = ""/);
    expect(SCREEN).toMatch(/role", "alert"/);
    // The error text is shown, not just logged to a console nobody on a phone can open.
    expect(SCREEN).toMatch(/err instanceof Error \?/);
    expect(SCREEN).toMatch(/detail\.textContent = msg/);
  });

  it("offers BOTH exits: reload, and a guarded reset for an unloadable save", () => {
    expect(SCREEN).toMatch(/reload\.onclick = \(\) => window\.location\.reload\(\)/);
    // Two taps before anything is deleted — the same contract as the in-app crash card.
    expect(SCREEN).toMatch(/let armed = false/);
    expect(SCREEN).toMatch(/if \(!armed\) \{/);
    expect(SCREEN).toMatch(/Tap again to delete your save/);
    // Reset means one thing across both surfaces, including the durable native mirror.
    expect(SCREEN).toMatch(/clearSave\(\)/);
  });

  it("cannot itself get stuck: the reset always ends in a reload, even if the import fails", () => {
    // The clearer arrives by dynamic import — the one thing here that can fail on the very
    // conditions that broke boot. It is caught, and the reload runs from `finally` either way.
    const reset = SCREEN.slice(SCREEN.indexOf("reset.onclick"));
    expect(reset).toMatch(/\.catch\(/);
    expect(reset).toMatch(/\.finally\(\(\) => window\.location\.reload\(\)\)/);
  });

  it("is raw DOM, so it cannot depend on whatever failed to load", () => {
    // No React, no JSX, no stylesheet class names, no design tokens: every style is inline.
    expect(SCREEN).not.toMatch(/createRoot|<StrictMode|useState|className/);
    expect(SCREEN).not.toMatch(/var\(--/);
    expect(SCREEN).toMatch(/document\.createElement\("div"\)/);
    expect(SCREEN).toMatch(/style\.cssText/);
  });
});
