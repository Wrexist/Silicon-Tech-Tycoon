import { describe, expect, it } from "vitest";
import { PLATFORM_SECTIONS, resolvePlatformSection, SECTION_LABELS } from "./platformSections.ts";

// The rail's contract: a section in the URL is honoured, anything else falls back to the first
// section rather than rendering a blank panel. Pure, so it is testable without a DOM.
describe("resolvePlatformSection", () => {
  it("returns the first section when nothing is named", () => {
    expect(resolvePlatformSection(undefined)).toBe("overview");
    expect(resolvePlatformSection("")).toBe("overview");
  });

  it("honours every declared section", () => {
    for (const s of PLATFORM_SECTIONS) expect(resolvePlatformSection(s)).toBe(s);
  });

  it("falls back rather than blanking on an unknown section", () => {
    expect(resolvePlatformSection("nonsense")).toBe("overview");
    expect(resolvePlatformSection("../etc")).toBe("overview");
  });

  it("ignores case", () => {
    expect(resolvePlatformSection("Licensing")).toBe("licensing");
  });

  it("has a label for every section and no duplicates", () => {
    for (const s of PLATFORM_SECTIONS) expect(SECTION_LABELS[s]).toBeTruthy();
    expect(new Set(PLATFORM_SECTIONS).size).toBe(PLATFORM_SECTIONS.length);
  });
});
