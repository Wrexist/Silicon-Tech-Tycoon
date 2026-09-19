import { describe, expect, it } from "vitest";
import { resolveUiVersion } from "./uiVersion.ts";

// The flag resolves from a URL param -> stored value -> the shipped game. "classic" is the default
// and the safe answer for anything unrecognised: a typo must never strand a player in a half-built UI.
describe("resolveUiVersion", () => {
  it("defaults to the shipped game when nothing is set", () => {
    expect(resolveUiVersion(null, null)).toBe("classic");
  });

  it("lets the URL param win over storage", () => {
    expect(resolveUiVersion("next", "classic")).toBe("next");
    expect(resolveUiVersion("classic", "next")).toBe("classic");
  });

  it("falls back to storage when the param is absent", () => {
    expect(resolveUiVersion(null, "next")).toBe("next");
    expect(resolveUiVersion(null, "classic")).toBe("classic");
  });

  it("accepts the friendly aliases", () => {
    for (const v of ["next", "1", "true", "2", " NEXT "]) expect(resolveUiVersion(v, null)).toBe("next");
    for (const v of ["classic", "0", "false", "Classic"]) expect(resolveUiVersion(v, null)).toBe("classic");
  });

  it("treats an unrecognised value as unset instead of trusting it", () => {
    expect(resolveUiVersion("banana", null)).toBe("classic");
    expect(resolveUiVersion("banana", "next")).toBe("next");
    expect(resolveUiVersion("", "")).toBe("classic");
  });
});
