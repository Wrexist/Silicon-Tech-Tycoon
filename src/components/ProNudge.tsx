// One quiet, non-blocking strip, and it only ever appears for someone who is ALREADY paying: the
// App Store can't take their payment.
//
// ── WHY THIS ONE IS PURE FOUND MONEY ────────────────────────────────────────────────────────────
// Roughly a third of subscription churn is involuntary — an expired card, a declined charge — not a
// decision. Apple retries for up to 60 days and keeps the subscriber entitled during the grace
// period, so the ONLY thing standing between that and recovered revenue is the user knowing. This
// strip is that. It is shown to someone who is trying to pay us and failing.
//
// A strip, never a modal: nobody's play session should be interrupted for admin.
//
// ── ON THE TRIAL-ENDING NOTICE (deliberately absent) ────────────────────────────────────────────
// There is intentionally NO "your free trial ends in two days" reminder. The trial converts
// silently, which is what the overwhelming majority of subscription apps do.
//
// What that trades, so the next person to touch this knows it was a decision and not an oversight:
// silent conversion keeps the subscribers who would have cancelled on the reminder, and costs some
// of them back as refunds, chargebacks and one-star reviews from people who felt ambushed. The
// disclosure that matters legally is at the point of purchase and is unchanged — the paywall states
// the trial length, the price, the renewal cadence and the forfeiture rule in plain words before
// anything is charged (Guideline 3.1.2(c)), and Settings → Silicon Pro shows live standing with a
// two-tap path to cancel. Apple also lists the subscription under Settings → Apple ID →
// Subscriptions and emails a receipt on every charge.
//
// If churn-on-first-charge or refund rate looks bad after launch, restoring the reminder is a small
// change: a second branch here keyed on `onTrial` + `trialDaysRemaining()`, both of which
// `usePro.ts` already exposes and Settings already uses.
import { AlertTriangle, ChevronRight } from "lucide-react";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { manageProSubscription } from "../state/proStore.ts";
import { useProStatus } from "../state/usePro.ts";
import { getProRecord } from "../state/pro.ts";
import "./proNudge.css";

export function ProNudge() {
  const { pro } = useProStatus();
  if (!pro) return null;

  const rec = getProRecord();
  if (!rec?.inGracePeriod) return null;

  return (
    <Strip
      glyph={<AlertTriangle size={15} />}
      title="There's a problem with your payment"
      sub="Silicon Pro is still active while the App Store retries. Updating your payment method keeps it that way."
      cta="Fix it"
    />
  );
}

/** Stable id for the description. Safe as a constant: at most one strip is ever mounted. */
const SUB_ID = "pnudge-sub";

function Strip({
  glyph,
  title,
  sub,
  cta,
}: {
  glyph: React.ReactNode;
  title: string;
  sub: string;
  cta: string;
}) {
  // No `aria-label` here on purpose. It would REPLACE the button's descendant text, so a screen
  // reader would announce the headline and "Fix it" but never `sub` — which is the half that says
  // Pro is still active and what to do about it. Letting the visible content name the button, with
  // the explanation attached via `aria-describedby`, reads out the whole thing.
  return (
    <div className="pnudge pnudge--warn" role="status" aria-live="polite">
      <button
        type="button"
        className="pnudge__card"
        onClick={() => { haptic.light(); sfx("tap"); void manageProSubscription(); }}
        aria-describedby={SUB_ID}
      >
        <span className="pnudge__glyph" aria-hidden>{glyph}</span>
        <span className="pnudge__text">
          <span className="pnudge__title">{title}</span>
          <span className="pnudge__sub" id={SUB_ID}>{sub}</span>
        </span>
        <span className="pnudge__cta">{cta}<ChevronRight size={14} aria-hidden /></span>
      </button>
    </div>
  );
}
