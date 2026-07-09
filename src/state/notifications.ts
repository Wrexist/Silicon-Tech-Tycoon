// Opt-in daily-challenge reminders (local notifications, native only). The sim can't promise
// wall-clock events (it only advances while the app is open), so the ONE honest re-engagement
// hook is the daily challenge reset: challenges are pure date-seeded, so we can pre-schedule the
// next week of reminders with each day's REAL mutator twist, entirely offline. Event-driven and
// off by default — no streaks, no guilt, no marketing (the no-dark-patterns rule).
//
// Web/PWA: no-op (notificationsAvailable() = false) — same graceful-degradation seam as
// nativeStore/haptics. The scheduled window is refreshed on every app boot/foreground while the
// preference is on, so it never runs dry for an active player and goes quiet by itself (max 7
// pings) for a lapsed one who ignores them.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { challengeTeaser, dailyChallenge, dateKeyOf } from "../engine/challenges.ts";
import { getSettings, setSettings } from "./settings.ts";

/** Deterministic id per calendar day so re-scheduling replaces, never duplicates. */
function idFor(dateKey: string): number {
  return Number(dateKey.replaceAll("-", "")); // YYYYMMDD fits comfortably in int32
}

const WINDOW_DAYS = 7;
const REMINDER_HOUR = 10; // local time — mid-morning, deliberately not an early-morning buzz

export function notificationsAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Schedule the next week of daily-challenge reminders (replacing any prior window). */
async function scheduleWindow(): Promise<void> {
  const now = new Date();
  const notifications = [];
  for (let d = 0; d < WINDOW_DAYS; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, REMINDER_HOUR, 0, 0);
    if (day <= now) continue; // today's slot already passed
    // Each day pushes a DIFFERENT immersive hook (date-seeded), teasing that day's real twist + goal
    // — a re-engagement nudge that reads fresh, not the same line on repeat.
    const teaser = challengeTeaser(dailyChallenge(dateKeyOf(day)));
    notifications.push({
      id: idFor(dateKeyOf(day)),
      title: teaser.title,
      body: teaser.body,
      schedule: { at: day },
    });
  }
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
}

async function cancelWindow(): Promise<void> {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
}

/** Turn reminders on: ask permission, persist the pref, schedule. False = permission denied. */
export async function enableDailyReminders(): Promise<boolean> {
  if (!notificationsAvailable()) return false;
  try {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return false;
    setSettings({ dailyReminder: true });
    await scheduleWindow();
    return true;
  } catch {
    return false;
  }
}

export async function disableDailyReminders(): Promise<void> {
  setSettings({ dailyReminder: false });
  if (!notificationsAvailable()) return;
  try {
    await cancelWindow();
  } catch {
    /* nothing to cancel */
  }
}

/** Keep the scheduled window fresh — call on boot/foreground. No-op unless opted in + granted. */
export async function refreshDailyReminders(): Promise<void> {
  if (!notificationsAvailable() || !getSettings().dailyReminder) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return; // revoked in iOS Settings — respect it silently
    await cancelWindow();
    await scheduleWindow();
  } catch {
    /* scheduling is best-effort; never let it break boot */
  }
}
