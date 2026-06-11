// Multi-tab single-writer guard — the takeover handshake must freeze exactly the OTHER context.
// Node ≥18 ships BroadcastChannel globally, and two instances on the same channel name in one
// process deliver to each other asynchronously — enough to simulate two tabs.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTabGuard, type TabGuard } from "./tabGuard.ts";

const guards: TabGuard[] = [];
function guard(onBlocked: () => void, id: string, onReleased?: () => void): TabGuard {
  const g = createTabGuard(onBlocked, id, onReleased);
  guards.push(g);
  return g;
}

afterEach(() => {
  for (const g of guards.splice(0)) g.dispose();
  vi.unstubAllGlobals();
});

/** BroadcastChannel delivery is async — wait until the expectation holds (or time out). */
async function eventually(check: () => void): Promise<void> {
  await vi.waitFor(check, { timeout: 1000, interval: 10 });
}

describe("multi-tab single-writer guard", () => {
  it("a newer context's claim freezes the older one — and only the older one", async () => {
    const blockedA = vi.fn();
    const blockedB = vi.fn();
    guard(blockedA, "tab-a");
    guard(blockedB, "tab-b"); // B opens later and claims
    await eventually(() => expect(blockedA).toHaveBeenCalledTimes(1));
    expect(blockedB).not.toHaveBeenCalled(); // the takeover tab keeps playing
  });

  it("claims from the SAME context id are ignored (StrictMode double-mount must not self-freeze)", async () => {
    const blocked = vi.fn();
    guard(blocked, "tab-a");
    guard(blocked, "tab-a"); // same context id, as under StrictMode re-mount
    // give delivery a moment, then assert nothing fired
    await new Promise((r) => setTimeout(r, 50));
    expect(blocked).not.toHaveBeenCalled();
  });

  it("onBlocked fires at most once per guard even if rivals keep claiming", async () => {
    const blockedA = vi.fn();
    guard(blockedA, "tab-a");
    guard(vi.fn(), "tab-b");
    guard(vi.fn(), "tab-c");
    await eventually(() => expect(blockedA).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(blockedA).toHaveBeenCalledTimes(1);
  });

  it("a disposed guard stops listening (a closed tab can't be re-frozen)", async () => {
    const blockedA = vi.fn();
    const a = guard(blockedA, "tab-a");
    a.dispose();
    guard(vi.fn(), "tab-b");
    await new Promise((r) => setTimeout(r, 50));
    expect(blockedA).not.toHaveBeenCalled();
  });

  it("degrades to a no-op when BroadcastChannel is unavailable (legacy engines)", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const blocked = vi.fn();
    const g = createTabGuard(blocked, "tab-a");
    expect(() => g.dispose()).not.toThrow();
    expect(() => g.releaseNow()).not.toThrow();
    expect(blocked).not.toHaveBeenCalled();
  });

  it("the playing tab's release reaches frozen tabs so they can recover", async () => {
    const releasedA = vi.fn();
    guard(vi.fn(), "tab-a", releasedA);
    const b = guard(vi.fn(), "tab-b"); // B claims → A frozen
    await eventually(() => expect(releasedA).not.toHaveBeenCalled());
    b.releaseNow(); // B (playing) goes away
    await eventually(() => expect(releasedA).toHaveBeenCalledTimes(1));
  });

  it("a frozen tab closing never releases (can't steal play back for other frozen tabs)", async () => {
    const blockedA = vi.fn();
    const releasedB = vi.fn();
    const a = guard(blockedA, "tab-a");
    guard(vi.fn(), "tab-b", releasedB);
    const c = guard(vi.fn(), "tab-c"); // C claims last → A and B frozen, C playing
    await eventually(() => expect(blockedA).toHaveBeenCalled());
    a.releaseNow(); // A is frozen — its pagehide must NOT broadcast a release
    await new Promise((r) => setTimeout(r, 50));
    expect(releasedB).not.toHaveBeenCalled();
    c.releaseNow(); // the PLAYING tab going away does release the frozen ones
    await eventually(() => expect(releasedB).toHaveBeenCalledTimes(1));
  });
});
