// React binding for the Pro entitlement. Subscribes to the change event in `pro.ts`, so every lock
// chip, gated row and status line falls away the INSTANT the entitlement lands — whether that came
// from a purchase on this screen, a restore, a background sync, or an Ask-to-Buy approval clearing
// on a parent's phone. Without this, unlocks would only appear on the next remount, which reads as
// "I paid and nothing happened" — the single most common cause of a refund request.
import { useEffect, useState } from "react";
import { isPro, isOnTrial, onProChanged, proStatusLine, trialDaysRemaining } from "./pro.ts";

/**
 * Subscribe to both triggers that can change what `isPro()` returns.
 *
 * The change event only fires on a WRITE — a purchase, a restore, a sync. But entitlement is also a
 * function of the clock: an `expiresAt` can pass while the app sits open in the background, with no
 * event to listen for. Without the visibility re-read, a lapsed subscriber comes back to a screen
 * still showing active Pro (and a trial line still counting down) until something happens to write.
 */
function useProSubscription(refresh: () => void): void {
  useEffect(() => {
    const offChange = onProChanged(refresh);
    if (typeof document === "undefined") return offChange;
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      offChange();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `refresh` is a stable setter-wrapper from the caller's useCallback-free closure over setState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** True while this device holds an active Pro entitlement. Re-renders on change and on resume. */
export function useIsPro(): boolean {
  const [pro, setPro] = useState(() => isPro());
  useProSubscription(() => setPro(isPro()));
  return pro;
}

/** Everything the Settings screen needs about standing, in one reactive read. */
export function useProStatus(): { pro: boolean; onTrial: boolean; trialDaysLeft: number; line: string } {
  const [snap, setSnap] = useState(read);
  useProSubscription(() => setSnap(read()));
  return snap;
}

function read() {
  return {
    pro: isPro(),
    onTrial: isOnTrial(),
    trialDaysLeft: trialDaysRemaining(),
    line: proStatusLine(),
  };
}
