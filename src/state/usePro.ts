// React binding for the Pro entitlement. Subscribes to the change event in `pro.ts`, so every lock
// chip, gated row and status line falls away the INSTANT the entitlement lands — whether that came
// from a purchase on this screen, a restore, a background sync, or an Ask-to-Buy approval clearing
// on a parent's phone. Without this, unlocks would only appear on the next remount, which reads as
// "I paid and nothing happened" — the single most common cause of a refund request.
import { useEffect, useState } from "react";
import { isPro, isOnTrial, onProChanged, proStatusLine, trialDaysRemaining } from "./pro.ts";

/** True while this device holds an active Pro entitlement. Re-renders on change. */
export function useIsPro(): boolean {
  const [pro, setPro] = useState(() => isPro());
  useEffect(() => onProChanged(() => setPro(isPro())), []);
  return pro;
}

/** Everything the Settings screen needs about standing, in one reactive read. */
export function useProStatus(): { pro: boolean; onTrial: boolean; trialDaysLeft: number; line: string } {
  const [snap, setSnap] = useState(read);
  useEffect(() => onProChanged(() => setSnap(read())), []);
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
