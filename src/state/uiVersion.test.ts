import { describe, expect, it } from "vitest";
import { resolveUiVersion } from "./uiVersion.ts";

// URL overrides an explicit saved choice; otherwise the release defaults to next.
describe("resolveUiVersion", () => {
  it("defaults to the shipped game when nothing is set", () => {
    expect(resolveUiVersion(null, null)).toBe("next");
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
    expect(resolveUiVersion("banana", null)).toBe("next");
    expect(resolveUiVersion("banana", "next")).toBe("next");
    expect(resolveUiVersion("", "")).toBe("next");
  });
});
