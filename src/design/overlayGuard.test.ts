import { describe, expect, it } from "vitest";
import { appOverlayOpen, registerAppOverlay } from "./overlayGuard.ts";

describe("overlay stack", () => {
  it("tracks overlays as a stack, releasing out of order safely", () => {
    expect(appOverlayOpen()).toBe(false);
    const a = registerAppOverlay();
    const b = registerAppOverlay();
    a(); // the LOWER layer closes first — the upper one must still count
    expect(appOverlayOpen()).toBe(true);
    a(); // double release is a no-op, never underflows
    expect(appOverlayOpen()).toBe(true);
    b();
    expect(appOverlayOpen()).toBe(false);
  });
});
