import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { getSettings } from "../state/settings.ts";

// Thin wrapper: uses Capacitor haptics on device, falls back to the Web Vibration
// API in the browser, and silently no-ops where neither exists. Never throws.
// Respects the user's haptics setting.

function webVibrate(ms: number | number[]): void {
  if (!getSettings().haptics) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}

const on = () => getSettings().haptics;

export const haptic = {
  light(): void {
    if (!on()) return;
    void Haptics.impact({ style: ImpactStyle.Light }).catch(() => webVibrate(8));
  },
  medium(): void {
    if (!on()) return;
    void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => webVibrate(14));
  },
  heavy(): void {
    if (!on()) return;
    void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => webVibrate(22));
  },
  success(): void {
    if (!on()) return;
    void Haptics.notification({ type: NotificationType.Success }).catch(() => webVibrate([10, 40, 16]));
  },
  warning(): void {
    if (!on()) return;
    void Haptics.notification({ type: NotificationType.Warning }).catch(() => webVibrate([12, 30, 12]));
  },
  error(): void {
    if (!on()) return;
    void Haptics.notification({ type: NotificationType.Error }).catch(() => webVibrate([20, 50, 20, 50]));
  },
};
