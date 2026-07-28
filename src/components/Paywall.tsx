// The Silicon Pro paywall — the ONE purchase surface. Every gate in the app raises this same
// overlay through `openPaywall()`, so there is exactly one place where money changes hands and
// exactly one place to audit for App Store compliance.
//
// ── APPLE GUIDELINE 3.1.2(c), COVERED IN THE PURCHASE FLOW ITSELF ───────────────────────────────
// (Not in the App Store description — reviewers check the paywall.)
//   • Subscription title on every row ................ "Pro Yearly" / "Pro Monthly" / "Pro Lifetime"
//   • Length of subscription on every row ............ "12 months · auto-renews yearly"
//   • Billed amount as the MOST PROMINENT price element (largest, heaviest, never out-shouted by a
//     per-month equivalent or by trial copy)
//   • Trial framing subordinate to the billed amount, and only shown to users the STORE says are
//     actually eligible
//   • Functional Terms of Use (EULA) + Privacy Policy links, in-flow
//   • Restore Purchases, on the paywall itself
//   • Plain-language auto-renew disclosure
//
// ── AND THE 2026 RULES ──────────────────────────────────────────────────────────────────────────
//   • NO free-trial TOGGLE. Apple began rejecting toggle paywalls in January 2026: the trial is a
//     property of the plan row, stated in words, never a switch that silently changes the price.
//   • NO buy button that can only error. The store is asked what it will actually sell BEFORE a CTA
//     is offered; if it answers with nothing, the card shows an honest retry (App Review 2.1.0).
//   • A cancelled StoreKit sheet is not a failure. No red banner, no apology, no "error".
//
// Visually this follows the house popup standard in CLAUDE.md: the CARD is the glass, the scrim
// around it stays clear so the game shows through, and the edge reflection comes from the shared
// `…__card::after` rule in primitives.css.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Crown, RefreshCw, Sparkles, X } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { showToast } from "../design/toast.tsx";
import { emitCelebrate } from "../design/celebrateFx.ts";
import { registerAppOverlay } from "../design/overlayGuard.ts";
import { onPaywall, markOnboardingPaywallSeen, type PaywallRequest } from "../state/paywall.ts";
import { paywallCopy, PRO_BENEFITS } from "../state/proGates.ts";
import { FREE_TRIAL_DAYS, PRO_PRODUCTS, isPro, onProChanged } from "../state/pro.ts";
import { getProCatalog, purchasePro, restorePro, type ProCatalog, type ProOffer } from "../state/proStore.ts";
import "./paywall.css";

/** Legal destinations. Both must resolve to live pages before submission — a dead link here is a
 *  3.1.2 rejection, and reviewers do tap them. */
const TERMS_URL = "https://wrexist.github.io/Silicon-Tech-Tycoon/terms/";
const PRIVACY_URL = "https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/";

/** Default selection: Yearly. It is the best value for the player AND the row whose billed amount
 *  Apple wants displayed most prominently, so the honest default and the profitable one agree. */
const DEFAULT_PLAN = "com.wrexist.silicon.pro.yearly";

export function Paywall() {
  const [req, setReq] = useState<PaywallRequest | null>(null);

  useEffect(() => onPaywall((r) => setReq(r)), []);

  // An entitlement that lands from anywhere (another device, an Ask-to-Buy approval clearing, a
  // renewal) closes the paywall and runs the action the player was reaching for.
  useEffect(() => {
    if (!req) return;
    return onProChanged(() => {
      if (!isPro()) return;
      const done = req.onUnlocked;
      setReq(null);
      done?.();
    });
  }, [req]);

  if (!req) return null;
  return <PaywallCard req={req} onClose={() => setReq(null)} />;
}

function PaywallCard({ req, onClose }: { req: PaywallRequest; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, true);
  useEffect(() => registerAppOverlay(), []); // lower layers defer Escape to this overlay

  const copy = paywallCopy(req.reason);
  const [selected, setSelected] = useState<string>(DEFAULT_PLAN);
  const [catalog, setCatalog] = useState<ProCatalog | null>(null);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [probe, setProbe] = useState(0);

  const dismiss = useCallback(() => {
    if (busy) return;
    if (req.reason === "onboarding") markOnboardingPaywallSeen();
    haptic.light();
    onClose();
    req.onDismiss?.();
  }, [busy, onClose, req]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  // Ask the store what it can sell before offering to sell it.
  useEffect(() => {
    let live = true;
    setCatalog(null);
    getProCatalog().then((c) => { if (live) setCatalog(c); });
    return () => { live = false; };
  }, [probe]);

  // Only render rows the store confirmed. Order follows PRO_PRODUCTS (Yearly, Lifetime, Monthly) —
  // the value ladder reads best with the anchor first and the cheapest last.
  const rows = useMemo(() => {
    if (!catalog) return [];
    return PRO_PRODUCTS
      .map((p) => ({ product: p, offer: catalog.offers.find((o) => o.id === p.id) }))
      .filter((r): r is { product: (typeof PRO_PRODUCTS)[number]; offer: ProOffer } => r.offer != null);
  }, [catalog]);

  // Never leave a dead CTA selected: if the default didn't come back from the store, fall through
  // to the first row that did.
  useEffect(() => {
    if (rows.length === 0) return;
    if (!rows.some((r) => r.product.id === selected)) setSelected(rows[0].product.id);
  }, [rows, selected]);

  const current = rows.find((r) => r.product.id === selected);
  const trialOnSelected = current?.offer.trialEligible === true && current.product.hasTrial;
  const trialLabel = current?.offer.trialPeriod || `${FREE_TRIAL_DAYS} days`;

  /** The plain sentence stating exactly what the player will be charged. Apple wants the billed
   *  amount unmistakable; this spells it out in words on top of the prominent numeral. */
  const billingSummary = (() => {
    if (!current) return "";
    const { product, offer } = current;
    if (!product.recurring) return `${offer.price} once. No subscription, and nothing renews.`;
    const period = product.billingSuffix.replace("/", "") || "period";
    if (trialOnSelected) {
      return `Free for ${trialLabel}, then ${offer.price} per ${period}. Renews automatically until you cancel.`;
    }
    return `${offer.price} per ${period}. Renews automatically until you cancel.`;
  })();

  async function buy() {
    if (busy || !current) return;
    setBusy("buy");
    haptic.medium();
    const res = await purchasePro(current.product.id);
    setBusy(null);

    if (res.status === "purchased") {
      if (req.reason === "onboarding") markOnboardingPaywallSeen();
      haptic.success();
      sfx("confirm");
      emitCelebrate();
      showToast(
        trialOnSelected ? `Your ${trialLabel} free trial has started` : "Silicon Pro is active",
        { glyph: <Crown size={15} />, tone: "positive" },
      );
      onClose();
      req.onUnlocked?.();
      return;
    }
    if (res.status === "cancelled") return; // no charge, nothing went wrong, nothing to say
    if (res.status === "pending") {
      showToast(res.message ?? "Your purchase is pending approval.", { tone: "neutral" });
      return;
    }
    haptic.error();
    showToast(res.message ?? "Purchases are unavailable right now.", { tone: "negative" });
    setProbe((n) => n + 1); // re-probe: an unreachable store should switch to the retry state
  }

  async function restore() {
    if (busy) return;
    setBusy("restore");
    haptic.light();
    const { restored } = await restorePro();
    setBusy(null);
    if (restored) {
      haptic.success();
      showToast("Purchases restored — Silicon Pro is active", { glyph: <Check size={15} />, tone: "positive" });
      if (req.reason === "onboarding") markOnboardingPaywallSeen();
      onClose();
      req.onUnlocked?.();
    } else {
      showToast("No previous purchases found for this Apple ID.", { tone: "neutral" });
    }
  }

  const loading = catalog == null;
  const unavailable = catalog?.state === "unavailable";

  return (
    <div className="pwl">
      <div className="pwl__scrim" onClick={dismiss} aria-hidden />
      <div
        ref={ref}
        className="pwl__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwl-title"
        tabIndex={-1}
      >
        <button className="pwl__close" onClick={dismiss} aria-label="Close" disabled={busy != null}>
          <X size={16} />
        </button>

        <div className="pwl__glyph" aria-hidden><Crown size={26} strokeWidth={2} /></div>
        <span className="pwl__eyebrow">{copy.eyebrow}</span>
        <h2 className="pwl__title" id="pwl-title">{copy.title}</h2>
        <p className="pwl__body">{copy.body}</p>

        <ul className="pwl__benefits">
          {PRO_BENEFITS.map((b) => (
            <li key={b.title} className="pwl__benefit">
              <span className="pwl__tick" aria-hidden><Check size={11} strokeWidth={3.2} /></span>
              <span className="pwl__benefit-text">
                <strong>{b.title}</strong>
                <small>{b.body}</small>
              </span>
            </li>
          ))}
        </ul>

        {loading && (
          <div className="pwl__loading" role="status">Contacting the App Store…</div>
        )}

        {unavailable && (
          <div className="pwl__unavailable">
            <span className="pwl__unavailable-glyph" aria-hidden><AlertTriangle size={18} /></span>
            <p className="pwl__unavailable-title">The store didn't answer</p>
            <p className="pwl__unavailable-text">
              We couldn't reach the App Store to load Pro pricing. Check your connection and try
              again — you can keep playing for free in the meantime.
            </p>
            <div className="pwl__unavailable-actions">
              <Button size="sm" onClick={() => { haptic.light(); setProbe((n) => n + 1); }}>Try again</Button>
              <Button size="sm" variant="tertiary" onClick={dismiss}>Keep playing free</Button>
            </div>
          </div>
        )}

        {!loading && !unavailable && (
          <>
            <div className="pwl__plans" role="radiogroup" aria-label="Choose a plan">
              {rows.map(({ product, offer }) => {
                const on = selected === product.id;
                const showsTrial = offer.trialEligible && product.hasTrial;
                // The BILLED amount — what the card is actually charged — is the prominent element.
                const billed = `${offer.price}${product.billingSuffix}`;
                return (
                  <button
                    key={product.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={busy != null || offer.owned}
                    className={`pwl__plan${on ? " pwl__plan--on" : ""}`}
                    onClick={() => { haptic.light(); sfx("toggle"); setSelected(product.id); }}
                  >
                    <span className="pwl__radio" aria-hidden>{on && <Check size={12} strokeWidth={3.4} />}</span>
                    <span className="pwl__plan-main">
                      <span className="pwl__plan-head">
                        <span className="pwl__plan-title">{product.title}</span>
                        {product.badge && <span className="pwl__plan-badge">{product.badge}</span>}
                        {offer.owned && <span className="pwl__plan-badge pwl__plan-badge--owned">OWNED</span>}
                      </span>
                      {/* Length of subscription — required next to the price. */}
                      <span className="pwl__plan-length">{product.lengthLabel}</span>
                      {product.note && <span className="pwl__plan-note">{product.note}</span>}
                      {showsTrial && (
                        <span className="pwl__plan-trial">Includes a {trialLabel} free trial</span>
                      )}
                    </span>
                    <span className="pwl__plan-price tnum">{billed}</span>
                  </button>
                );
              })}
            </div>

            <p className="pwl__summary">{billingSummary}</p>

            <Button block onClick={buy} disabled={busy != null || !current}>
              {busy === "buy" ? (
                "Processing…"
              ) : trialOnSelected ? (
                <><Sparkles size={16} aria-hidden /> Start my {trialLabel} free trial</>
              ) : (
                <><Sparkles size={16} aria-hidden /> Continue — {current ? `${current.offer.price}${current.product.billingSuffix}` : ""}</>
              )}
            </Button>

            {trialOnSelected && (
              <p className="pwl__reassure">
                <Check size={12} aria-hidden /> No payment due now · cancel any time
              </p>
            )}
          </>
        )}

        <button className="pwl__skip" onClick={dismiss} disabled={busy != null}>
          {req.reason === "onboarding" ? "Not now — start building for free" : "Maybe later"}
        </button>

        <div className="pwl__legal">
          <button className="pwl__legal-link" onClick={restore} disabled={busy != null}>
            <RefreshCw size={11} aria-hidden className={busy === "restore" ? "pwl__spin" : undefined} />
            {busy === "restore" ? "Restoring…" : "Restore Purchases"}
          </button>
          <span aria-hidden>·</span>
          <a className="pwl__legal-link" href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms of Use</a>
          <span aria-hidden>·</span>
          <a className="pwl__legal-link" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
        </div>

        <p className="pwl__fineprint">
          Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew
          automatically unless cancelled at least 24 hours before the end of the current period;
          your account is charged for renewal within 24 hours of the period ending. Manage or cancel
          in Settings → Apple ID → Subscriptions. Any unused portion of a free trial is forfeited
          when a subscription is purchased.
        </p>
      </div>
    </div>
  );
}

/** A small "Pro" chip for locked rows elsewhere in the app. Purely a label — the row itself stays
 *  tappable and opens the paywall, because a lock the player cannot press teaches nothing. */
export function ProChip({ label = "Pro" }: { label?: string }) {
  return (
    <span className="pwl-chip">
      <Crown size={10} strokeWidth={2.6} aria-hidden /> {label}
    </span>
  );
}
