import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { getSettings } from "../state/settings.ts";

// Thin wrapper: on a Capacitor native device it uses the native Haptics engine; in the
// browser it uses the Web Vibration API. Branching explicitly on the platform avoids the
// double-buzz that happened when both paths could fire. Respects the user's haptics
// setting and never throws.

// Resolve once: true only inside the native iOS/Android shell.
const native = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

function webVibrate(ms: number | number[]): void {
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
    if (native) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else webVibrate(8);
  },
  medium(): void {
    if (!on()) return;
    if (native) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    else webVibrate(14);
  },
  heavy(): void {
    if (!on()) return;
    if (native) void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    else webVibrate(22);
  },
  success(): void {
    if (!on()) return;
    if (native) void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else webVibrate([10, 40, 16]);
  },
  warning(): void {
    if (!on()) return;
    if (native) void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    else webVibrate([12, 30, 12]);
  },
  error(): void {
    if (!on()) return;
    if (native) void Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    else webVibrate([20, 50, 20, 50]);
  },
};
