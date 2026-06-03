import { describe, it, expect } from "vitest";
import { suggestNextName } from "./naming.ts";

describe("suggestNextName", () => {
  it("increments number words, preserving case", () => {
    expect(suggestNextName("Aurora Two")).toBe("Aurora Three");
    expect(suggestNextName("Aurora One")).toBe("Aurora Two");
    expect(suggestNextName("nova four")).toBe("nova five");
  });
  it("increments the last digit run anywhere", () => {
    expect(suggestNextName("Aurora 2")).toBe("Aurora 3");
    expect(suggestNextName("iPhone 15")).toBe("iPhone 16");
    expect(suggestNextName("Galaxy S23 Ultra")).toBe("Galaxy S24 Ultra");
    expect(suggestNextName("Pro9")).toBe("Pro10");
  });
  it("increments Roman numerals", () => {
    expect(suggestNextName("Mark IV")).toBe("Mark V");
    expect(suggestNextName("Mark II")).toBe("Mark III");
  });
  it("starts a series when there is no number", () => {
    expect(suggestNextName("Nova")).toBe("Nova 2");
    expect(suggestNextName("")).toBe("Aurora One");
  });
});
