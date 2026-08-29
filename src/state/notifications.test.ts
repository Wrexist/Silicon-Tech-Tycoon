// Daily-challenge reminders — the only re-engagement hook in the app, and the only thing that can
// keep buzzing a player who has stopped playing. Three things must hold for a release:
//   1. it degrades silently when the plugin is missing or permission is denied/revoked,
//   2. refreshing can never ACCUMULATE or DUPLICATE pings across a long-lived session, and
//   3. the scheduled window is bounded (max one week ahead) so a lapsed player goes quiet by itself.
import { describe, it, expect, beforeEach, vi } from "vitest";

interface Pending { id: number; title: string; body: string; schedule: { at: Date } }

const state: { pending: Pending[]; permission: string; scheduleCalls: number; cancelCalls: number; requests: number } = {
  pending: [],
  permission: "granted",
  scheduleCalls: 0,
  cancelCalls: 0,
  requests: 0,
};

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => true } }));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    schedule: async ({ notifications }: { notifications: Pending[] }) => {
      state.scheduleCalls++;
      // Mirror the real plugin: an id that already exists is REPLACED, not added twice.
      for (const n of notifications) {
        const at = state.pending.findIndex((p) => p.id === n.id);
        if (at >= 0) state.pending[at] = n;
        else state.pending.push(n);
      }
    },
    getPending: async () => ({ notifications: state.pending }),
    cancel: async ({ notifications }: { notifications: Array<{ id: number }> }) => {
      state.cancelCalls++;
      const drop = new Set(notifications.map((n) => n.id));
      state.pending = state.pending.filter((p) => !drop.has(p.id));
    },
    requestPermissions: async () => {
      state.requests++;
      return { display: state.permission };
    },
    checkPermissions: async () => ({ display: state.permission }),
  },
}));

// Settings live in localStorage; node has none.
class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
}

beforeEach(() => {
  state.pending = [];
  state.permission = "granted";
  state.scheduleCalls = 0;
  state.cancelCalls = 0;
  state.requests = 0;
  // @ts-expect-error test stub for the node env
  globalThis.localStorage = new MemStorage();
  // settings.ts calls matchMedia/document when a theme is applied.
  // @ts-expect-error test stub
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  // @ts-expect-error test stub
  globalThis.document = { documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {} } };
  vi.resetModules();
});

async function notifications() {
  return await import("./notifications.ts");
}

describe("reminder scheduling", () => {
  it("opting in asks once, then schedules a bounded window of at most a week", async () => {
    const { enableDailyReminders } = await notifications();
    expect(await enableDailyReminders()).toBe(true);
    expect(state.requests).toBe(1);
    expect(state.pending.length).toBeGreaterThan(0);
    expect(state.pending.length).toBeLessThanOrEqual(7);
    // Nothing is scheduled in the past, and nothing beyond the 7-day horizon.
    const now = Date.now();
    for (const p of state.pending) {
      expect(p.schedule.at.getTime()).toBeGreaterThan(now);
      expect(p.schedule.at.getTime()).toBeLessThan(now + 8 * 24 * 3600_000);
    }
  });

  it("REFRESHING MANY TIMES NEVER ACCUMULATES — the window stays the same size and the same ids", async () => {
    const { enableDailyReminders, refreshDailyReminders } = await notifications();
    await enableDailyReminders();
    const first = state.pending.map((p) => p.id).sort();
    expect(new Set(first).size).toBe(first.length); // no duplicate ids to begin with

    // A long session foregrounding over and over — the exact shape that could stack pings.
    for (let i = 0; i < 25; i++) await refreshDailyReminders();

    const after = state.pending.map((p) => p.id).sort();
    expect(after).toEqual(first); // same days, same deterministic ids, nothing added
    expect(new Set(after).size).toBe(after.length);
    expect(state.cancelCalls).toBeGreaterThan(0); // it really did clear before rescheduling
  });

  it("ids are the calendar day, so the same day can only ever hold one ping", async () => {
    const { enableDailyReminders } = await notifications();
    await enableDailyReminders();
    for (const p of state.pending) {
      expect(String(p.id)).toMatch(/^\d{8}$/); // YYYYMMDD
    }
  });

  it("a denied permission schedules nothing and stays off", async () => {
    state.permission = "denied";
    const { enableDailyReminders } = await notifications();
    const { getSettings } = await import("./settings.ts");
    expect(await enableDailyReminders()).toBe(false);
    expect(state.pending).toHaveLength(0);
    expect(getSettings().dailyReminder).toBe(false);
  });

  it("permission REVOKED in OS settings later: a refresh quietly stops, it does not throw or re-ask", async () => {
    const { enableDailyReminders, refreshDailyReminders } = await notifications();
    await enableDailyReminders();
    const scheduledBefore = state.scheduleCalls;
    state.permission = "denied"; // player turned it off in iOS Settings
    await expect(refreshDailyReminders()).resolves.toBeUndefined();
    expect(state.scheduleCalls).toBe(scheduledBefore); // nothing new pushed at a player who said no
    expect(state.requests).toBe(1); // and never nagged again
  });

  it("turning it off cancels the whole pending window", async () => {
    const { enableDailyReminders, disableDailyReminders } = await notifications();
    const { getSettings } = await import("./settings.ts");
    await enableDailyReminders();
    expect(state.pending.length).toBeGreaterThan(0);
    await disableDailyReminders();
    expect(state.pending).toHaveLength(0);
    expect(getSettings().dailyReminder).toBe(false);
  });

  it("a refresh while opted OUT does nothing at all", async () => {
    const { refreshDailyReminders } = await notifications();
    await refreshDailyReminders();
    expect(state.scheduleCalls).toBe(0);
    expect(state.cancelCalls).toBe(0);
  });
});
