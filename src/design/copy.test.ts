import { describe, expect, it } from "vitest";
import { withArticle } from "./copy.ts";

describe("withArticle", () => {
  it("picks a/an by the sound of the first letter", () => {
    expect(withArticle("Assembly Arm")).toBe("an Assembly Arm");
    expect(withArticle("Intake Hopper")).toBe("an Intake Hopper");
    expect(withArticle("Board Press")).toBe("a Board Press");
    expect(withArticle("AR headset")).toBe("an AR headset");
    expect(withArticle("CNC Mill")).toBe("a CNC Mill");
  });
});
