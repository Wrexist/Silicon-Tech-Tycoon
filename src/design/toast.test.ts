import { describe, it, expect, beforeEach } from "vitest";
import { showToast, __resetToastsForTest, __toastsForTest } from "./toast.tsx";

// The toast stack is capped at 3. Before priority existed, the cap dropped the OLDEST line — so a
// passive "Revenue milestone, $10M earned lifetime!" fired by the tick could push the answer to the
// player's own tap off the screen mid-read. `priority: "low"` marks the lines that fire on the sim's
// schedule rather than the player's; they must always be the ones to yield.
describe("toast priority", () => {
  beforeEach(() => __resetToastsForTest());

  it("keeps a full stack of normal toasts and drops an incoming low one", () => {
    showToast("a");
    showToast("b");
    showToast("c");
    showToast("milestone", { priority: "low" });
    expect(__toastsForTest().map((t) => t.text)).toEqual(["a", "b", "c"]);
  });

  it("evicts the oldest LOW toast — not the oldest toast — to make room for a normal one", () => {
    showToast("milestone", { priority: "low" });
    showToast("a");
    showToast("b");
    showToast("c"); // full: the low line goes, both real results survive
    expect(__toastsForTest().map((t) => t.text)).toEqual(["a", "b", "c"]);
  });

  it("falls back to evicting the oldest when every toast is normal", () => {
    showToast("a");
    showToast("b");
    showToast("c");
    showToast("d");
    expect(__toastsForTest().map((t) => t.text)).toEqual(["b", "c", "d"]);
  });

  it("shows a low toast happily while there is room", () => {
    showToast("milestone", { priority: "low" });
    expect(__toastsForTest().map((t) => t.text)).toEqual(["milestone"]);
  });

  it("still drops an exact duplicate of a line already on screen", () => {
    showToast("a");
    showToast("a");
    expect(__toastsForTest()).toHaveLength(1);
  });

  it("defaults to normal priority", () => {
    showToast("a");
    expect(__toastsForTest()[0].priority).toBe("normal");
  });
});

describe("toast duration", () => {
  it("scales with length so a long reason can be read, within 2.6–7s", async () => {
    const { toastDuration } = await import("./toast.tsx");
    expect(toastDuration("Saved")).toBe(2600);
    const long = "Not enough clear space to organize this line. Move props, remove equipment or expand the factory.";
    expect(toastDuration(long)).toBeGreaterThan(5000);
    expect(toastDuration("x".repeat(500))).toBe(7000);
  });
});
