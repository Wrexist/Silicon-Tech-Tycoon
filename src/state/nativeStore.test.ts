import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock("@capacitor/preferences", () => ({ Preferences: mocks }));

beforeEach(() => {
  vi.resetModules();
  mocks.get.mockReset().mockResolvedValue({ value: null });
  mocks.set.mockReset().mockResolvedValue(undefined);
  mocks.remove.mockReset().mockResolvedValue(undefined);
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) });
});

describe("native save durability", () => {
  it("orders a slow write before a newer write and deletion", async () => {
    let release!: () => void;
    mocks.set.mockImplementationOnce(() => new Promise<void>(r => { release = r; }));
    const { mirrorToNative } = await import("./nativeStore.ts");
    const first = mirrorToNative("silicon.save.v1", "old");
    const second = mirrorToNative("silicon.save.v1", "new");
    const remove = mirrorToNative("silicon.save.v1", null);
    await vi.waitFor(() => expect(mocks.set).toHaveBeenCalledTimes(1));
    expect(mocks.remove).not.toHaveBeenCalled();
    release();
    expect(await Promise.all([first, second, remove])).toEqual([true, true, true]);
    expect(mocks.set.mock.calls.map(c => c[0].value)).toEqual(["old", "new"]);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });

  it("reports native failure and permits a successful retry", async () => {
    mocks.set.mockRejectedValueOnce(new Error("disk"));
    const { mirrorToNative } = await import("./nativeStore.ts");
    expect(await mirrorToNative("silicon.save.v1.bak", "original")).toBe(false);
    expect(await mirrorToNative("silicon.save.v1.bak", "original")).toBe(true);
  });

  it("restores recovery copies and explicit UI preferences", async () => {
    mocks.get.mockImplementation(async ({ key }) => ({ value: key.endsWith(".bak") ? "original" : key === "silicon.ui2" ? "classic" : null }));
    const { hydrateFromNative, nativeSaveWritable } = await import("./nativeStore.ts");
    expect(nativeSaveWritable()).toBe(false);
    await hydrateFromNative();
    expect(localStorage.getItem("silicon.save.v1.bak")).toBe("original");
    expect(localStorage.getItem("silicon.ui2")).toBe("classic");
    expect(nativeSaveWritable()).toBe(true);
  });

  it("preserves a newer local choice written while native restore is pending", async () => {
    let release!: (value: { value: string }) => void;
    mocks.get.mockImplementation(({ key }) => key === "silicon.ui2"
      ? new Promise<{ value: string }>(resolve => { release = resolve; })
      : Promise.resolve({ value: null }));
    const { hydrateFromNative } = await import("./nativeStore.ts");
    const hydration = hydrateFromNative();
    await vi.waitFor(() => expect(release).toBeDefined());
    localStorage.setItem("silicon.ui2", "next");
    release({ value: "classic" });
    await hydration;
    expect(localStorage.getItem("silicon.ui2")).toBe("next");
  });

  it("does not resurrect a save deleted while native recovery is pending", async () => {
    let release!: (value: { value: string }) => void;
    mocks.get.mockImplementation(({ key }) => key === "silicon.save.v1"
      ? new Promise<{ value: string }>(resolve => { release = resolve; })
      : Promise.resolve({ value: null }));
    const { hydrateFromNative, mirrorToNative, markNativeBootRead, nativeSaveWritable } = await import("./nativeStore.ts");
    const hydration = hydrateFromNative();
    await vi.waitFor(() => expect(release).toBeDefined());
    markNativeBootRead();
    localStorage.removeItem("silicon.save.v1");
    expect(await mirrorToNative("silicon.save.v1", null)).toBe(true);
    release({ value: "deleted company" });
    await hydration;
    expect(localStorage.getItem("silicon.save.v1")).toBeNull();
    expect(nativeSaveWritable()).toBe(true);
    expect(mocks.remove).toHaveBeenCalledWith({ key: "silicon.save.v1" });
  });

  it("does not restore a deleted key when its native removal is still queued", async () => {
    let finishRemoval!: () => void;
    mocks.remove.mockImplementation(() => new Promise<void>(resolve => { finishRemoval = resolve; }));
    mocks.get.mockImplementation(async ({ key }) => ({ value: key === "silicon.save.v1" ? "old company" : null }));
    const { hydrateFromNative, mirrorToNative } = await import("./nativeStore.ts");
    const removal = mirrorToNative("silicon.save.v1", null);
    await vi.waitFor(() => expect(finishRemoval).toBeDefined());
    await hydrateFromNative();
    expect(localStorage.getItem("silicon.save.v1")).toBeNull();
    expect(mocks.get).not.toHaveBeenCalledWith({ key: "silicon.save.v1" });
    finishRemoval();
    expect(await removal).toBe(true);
  });

  it("does not allow saving when native hydration fails", async () => {
    mocks.get.mockRejectedValue(new Error("bridge unavailable"));
    const { hydrateFromNative, nativeSaveWritable } = await import("./nativeStore.ts");
    await hydrateFromNative();
    expect(nativeSaveWritable()).toBe(false);
  });

  it("protects a company recovered after the startup timeout", async () => {
    mocks.get.mockImplementation(async ({ key }) => ({ value: key === "silicon.save.v1" ? "old company" : null }));
    const { hydrateFromNative, markNativeBootRead, nativeSaveWritable } = await import("./nativeStore.ts");
    markNativeBootRead();
    await hydrateFromNative();
    expect(localStorage.getItem("silicon.save.v1")).toBe("old company");
    expect(nativeSaveWritable()).toBe(false);
  });
});
