// Two quiet, non-blocking strips that only ever appear for people who are ALREADY paying.
//
//   1. The trial is about to end.  2. The App Store can't take the payment.
//
// ── WHY A TRIAL WARNING IS A REVENUE FEATURE, NOT A LEAK ────────────────────────────────────────
// The instinct is to say nothing and let the trial convert silently. That instinct is wrong on the
// numbers: a subscriber who is surprised by a charge refunds it, leaves a one-star review, and
// never comes back — and Apple counts the refund against you either way. Telling someone their
// trial ends in two days costs a few cancellations from people who were never going to stay, and
// buys goodwill from everyone who does. It is also the single clearest signal to App Review that
// this app isn't running a trial trap.
//
// ── AND WHY THE BILLING STRIP IS PURE FOUND MONEY ───────────────────────────────────────────────
// Roughly a third of subscription churn is involuntary — an expired card, a declined charge — not
// a decision. Apple retries for up to 60 days and keeps the subscriber entitled during the grace
// period, so the ONLY thing standing between that and recovered revenue is the user knowing. This
// strip is that. It is shown to someone who is trying to pay us and failing.
//
// Both are strips, never modals: nobody's play session should be interrupted for admin.
import { AlertTriangle, ChevronRight, Clock } from "lucide-react";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { manageProSubscription } from "../state/proStore.ts";
import { useProStatus } from "../state/usePro.ts";
import { getProRecord } from "../state/pro.ts";
import "./proNudge.css";

/** Show the trial strip only in the last stretch, when it's actionable rather than noise. */
const TRIAL_WARN_DAYS = 2;

export function ProNudge() {
  const { pro, onTrial, trialDaysLeft } = useProStatus();
  if (!pro) return null;

  const rec = getProRecord();

  // Billing problem outranks the trial notice: it's the one that costs the player access.
  if (rec?.inGracePeriod) {
    return (
      <Strip
        tone="warn"
        glyph={<AlertTriangle size={15} />}
        title="There's a problem with your payment"
        sub="Silicon Pro is still active while the App Store retries. Updating your payment method keeps it that way."
        cta="Fix it"
      />
    );
  }

  if (onTrial && trialDaysLeft > 0 && trialDaysLeft <= TRIAL_WARN_DAYS) {
    return (
      <Strip
        tone="neutral"
        glyph={<Clock size={15} />}
        title={trialDaysLeft === 1 ? "Your free trial ends tomorrow" : `Your free trial ends in ${trialDaysLeft} days`}
        sub="It becomes a paid subscription unless you cancel. No hard feelings either way."
        cta="Manage"
      />
    );
  }

  return null;
}

function Strip({
  tone,
  glyph,
  title,
  sub,
  cta,
}: {
  tone: "warn" | "neutral";
  glyph: React.ReactNode;
  title: string;
  sub: string;
  cta: string;
}) {
  return (
    <div className={`pnudge pnudge--${tone}`} role="status" aria-live="polite">
      <button
        type="button"
        className="pnudge__card"
        onClick={() => { haptic.light(); sfx("tap"); void manageProSubscription(); }}
        aria-label={`${title}. ${cta}.`}
      >
        <span className="pnudge__glyph" aria-hidden>{glyph}</span>
        <span className="pnudge__text">
          <span className="pnudge__title">{title}</span>
          <span className="pnudge__sub">{sub}</span>
        </span>
        <span className="pnudge__cta">{cta}<ChevronRight size={14} aria-hidden /></span>
      </button>
    </div>
  );
}
