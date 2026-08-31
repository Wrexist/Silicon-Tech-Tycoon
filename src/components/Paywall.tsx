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
import { paywallCopy, PRO_BENEFITS, REASON_BENEFIT_ORDER, RETURNING_COPY } from "../state/proGates.ts";
import { getFounderIntent, INTENT_HEADLINE, leadWith, orderBenefits } from "../state/founderIntent.ts";
import { FREE_TRIAL_DAYS, PRO_PRODUCTS, hasEverSubscribed, isPro, onProChanged, yearlyValueVsMonthly } from "../state/pro.ts";
import { BALANCE } from "../engine/balance.ts";
import { CATEGORY_LIST, COMPONENT_LINES } from "../engine/catalogs.ts";
import { SCENARIOS } from "../engine/scenarios.ts";
import { getProCatalog, purchasePro, restorePro, type ProCatalog, type ProOffer } from "../state/proStore.ts";
import "./paywall.css";

/** Legal destinations. Both must resolve to live pages before submission — a dead link here is a
 *  3.1.2 rejection, and reviewers do tap them. */
const TERMS_URL = "https://wrexist.github.io/Silicon-Tech-Tycoon/terms/";
const PRIVACY_URL = "https://wrexist.github.io/Silicon-Tech-Tycoon/privacy/";

/** Default selection: Yearly. It is the best value for the player AND the row whose billed amount
 *  Apple wants displayed most prominently, so the honest default and the profitable one agree. */
const DEFAULT_PLAN = "com.wrexist.silicon.pro.yearly";

/**
 * "How much game is there?" — counted from the real content tables at module load, never typed in.
 *
 * This is the honest substitute for the social proof that normally sits here. Invented download
 * counts and five-star testimonials are both a dark pattern and an App Review liability; a sim
 * player's actual first question is how much there is to do, and these numbers answer it in a way
 * that cannot rot. Add a scenario and the strip updates itself.
 */
const PROOF: { value: string; label: string }[] = [
  { value: `${BALANCE.eras.length}`, label: "eras" },
  { value: `${CATEGORY_LIST.length}`, label: "devices" },
  { value: `${Object.values(COMPONENT_LINES).reduce((n, line) => n + line.tiers.length, 0)}`, label: "parts" },
  { value: `${SCENARIOS.length}`, label: "scenarios" },
];

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

  // Which argument to lead with. Precedence matters:
  //  1. A SPECIFIC gate always wins — the player just asked a question and the offer should answer
  //     it, not change the subject.
  //  2. A returning subscriber gets welcomed back rather than pitched from scratch.
  //  3. Otherwise, lead with whatever they said they came here to build.
  const intent = getFounderIntent();
  const copy = useMemo(() => {
    if (req.reason !== "onboarding") return paywallCopy(req.reason);
    if (hasEverSubscribed()) return RETURNING_COPY;
    if (intent) return { eyebrow: "Silicon Pro", ...INTENT_HEADLINE[intent] };
    return paywallCopy("onboarding");
  }, [req.reason, intent]);

  // Same eight promises either way — what changes is which one leads, and the precedence matches
  // the headline's exactly: a specific gate answers the question that was just asked, and only an
  // `onboarding` impression (where there is no question yet) falls back to the stated ambition.
  // Both paths are pure reorders of PRO_BENEFITS; a test asserts nothing is added, dropped or
  // edited on any of them.
  const benefits = useMemo(() => {
    const forReason = REASON_BENEFIT_ORDER[req.reason];
    if (forReason) return leadWith(PRO_BENEFITS, forReason);
    return orderBenefits(PRO_BENEFITS, intent);
  }, [req.reason, intent]);

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
    // `.catch` as well as `.then`: `getProCatalog()` is written never to reject, but a probe that
    // ever did would leave `catalog` null forever — the card stuck on "Contacting the App Store…"
    // with no CTA and no retry. Resolving to the unavailable state instead keeps the honest retry
    // card as the worst case, which is what App Review 2.1.0 wants to see.
    getProCatalog()
      .catch((): ProCatalog => ({ state: "unavailable", offers: [], fromStore: true }))
      .then((c) => { if (live) setCatalog(c); });
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

  /**
   * How much cheaper a year is than twelve months of monthly, from the store's own amounts.
   *
   * This is the strongest single line on the card — a plan's value is the thing a player is
   * actually deciding — and it replaces a hardcoded "About $1.67 a month" that was true in exactly
   * one storefront. Null whenever it can't be computed honestly (one of the rows didn't come back,
   * an older native build with no numeric amounts, mismatched currencies), and every use below
   * falls back to the static badge, so the row simply reads as it always did.
   */
  const yearlyValue = useMemo(() => {
    const find = (tier: string) => rows.find((r) => r.product.tier === tier)?.offer;
    return yearlyValueVsMonthly(find("yearly"), find("monthly"));
  }, [rows]);

  const current = rows.find((r) => r.product.id === selected);
  const trialOnSelected = current?.offer.trialEligible === true && current.product.hasTrial;
  // The store's own localized period ("1 week", "7 days") when it gave us one, else our constant.
  // Always rendered as "Free trial: X" so both phrasings read correctly.
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
    let res: Awaited<ReturnType<typeof purchasePro>>;
    // `finally`, not a trailing reset: a rejection here would latch `busy` truthy forever, which
    // disables close, skip, scrim-tap AND Escape — an undismissable paywall is an App Review fail.
    try {
      res = await purchasePro(current.product.id);
    } catch {
      res = { status: "error", message: "The purchase couldn't be completed. Please try again." };
    } finally {
      setBusy(null);
    }

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
    let restored = false;
    try {
      ({ restored } = await restorePro());
    } catch {
      showToast("Couldn't reach the App Store. Please try again.", { tone: "negative" });
      return;
    } finally {
      setBusy(null);
    }
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

        {/* ONE continuous scroll: pitch, then proof, then what you unlock, then the plans. The
            player meets the argument in reading order and the benefit list is never clipped.
            Only the purchase bar below is pinned — the billed amount, the CTA and the way out are
            on screen at every viewport height and at every scroll position. */}
        <div className="pwl__scroll">
          <div className="pwl__hero">
            <div className="pwl__glyph" aria-hidden><Crown size={26} strokeWidth={2} /></div>
            <span className="pwl__eyebrow">{copy.eyebrow}</span>
            <h2 className="pwl__title" id="pwl-title">{copy.title}</h2>
            <p className="pwl__body">{copy.body}</p>
          </div>

          {/* Proof, counted from the real content tables rather than typed in. A sim player's first
              question is "how much game is there?", and this answers it with numbers that cannot
              drift out of date or quietly become a lie — add a scenario and the strip updates. */}
          <div className="pwl__proof" aria-label="What's in the full game">
            {PROOF.map((p) => (
              <div key={p.label} className="pwl__proof-item">
                <span className="pwl__proof-num tnum">{p.value}</span>
                <span className="pwl__proof-label">{p.label}</span>
              </div>
            ))}
          </div>

          {/* The actual value proposition, given room to be read. Framed as a panel so it reads as
              "here is the thing you are buying" rather than as filler between the title and the
              price. Same eight promises for everyone — intent reorders them, never edits them. */}
          <div className="pwl__unlock">
            <h3 className="pwl__unlock-head">Everything Pro unlocks</h3>
            <ul className="pwl__benefits">
              {benefits.map((b) => (
                <li key={b.title} className="pwl__benefit">
                  <span className="pwl__tick" aria-hidden><Check size={11} strokeWidth={3.4} /></span>
                  <span className="pwl__benefit-text">
                    <strong>{b.title}</strong>
                    <small>{b.body}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

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
                // A measured claim outranks an adjective, and a REFUTED one outranks both. On the
                // yearly row: say the number when the store's amounts support one; say nothing at
                // all when those amounts say yearly isn't actually cheaper (a static "BEST VALUE"
                // there would be a comparison the arithmetic contradicts); keep the authored badge
                // only where nothing is known either way.
                const value = product.tier === "yearly" ? yearlyValue : ({ kind: "unknown" } as const);
                const badge = value.kind === "saving"
                  ? `SAVE ${value.percent}%`
                  : value.kind === "none" ? undefined : product.badge;
                const note = value.kind === "saving"
                  ? `${value.percent}% less than 12 months of monthly.`
                  : value.kind === "none" ? undefined : product.note;
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
                        {badge && <span className="pwl__plan-badge">{badge}</span>}
                        {offer.owned && <span className="pwl__plan-badge pwl__plan-badge--owned">OWNED</span>}
                      </span>
                      {/* Length of subscription — required next to the price. */}
                      <span className="pwl__plan-length">{product.lengthLabel}</span>
                      {/* This row's OWN trial period. Deriving it from the selected plan made an
                          unselected row state a trial length the store never offered for it. */}
                      {showsTrial && (
                        <span className="pwl__plan-trial">
                          Free trial: {offer.trialPeriod || `${FREE_TRIAL_DAYS} days`}
                        </span>
                      )}
                      {/* The value framing rides on the SELECTED row only — useful where the player
                          is deciding, noise on the two rows they aren't looking at. */}
                      {on && note && <span className="pwl__plan-note">{note}</span>}
                    </span>
                    {/* The BILLED amount — what the card is actually charged. Stacked so the
                        numeral stays the largest, heaviest thing on the row (3.1.2(c)) without a
                        long localized string ("kr 199,00/år") squeezing the labels beside it. */}
                    <span className="pwl__plan-price">
                      <span className="pwl__plan-amount tnum">{offer.price}</span>
                      {product.billingSuffix && (
                        <span className="pwl__plan-period">{product.billingSuffix}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

          </>
        )}

          <p className="pwl__fineprint">
            Payment is charged to your Apple ID at confirmation of purchase. Subscriptions renew
            automatically unless cancelled at least 24 hours before the end of the current period;
            your account is charged for renewal within 24 hours of the period ending. Manage or
            cancel in Settings → Apple ID → Subscriptions. Any unused portion of a free trial is
            forfeited when a subscription is purchased.
          </p>
        </div>

        {/* Pinned purchase bar. Deliberately kept to the four things that must never scroll away:
            what you'll be charged, the button that charges it, the way out, and Restore / Terms /
            Privacy. Everything else — including the long disclosure — lives in the scroll above, so
            this bar stays short enough to leave the pitch real room. */}
        <div className="pwl__cta">
          {!loading && !unavailable && (
            <>
              <p className="pwl__summary">{billingSummary}</p>

              {/* Two lines: the hook, then the thing that actually blocks the tap. On the trial the
                  objection is "am I about to be charged?", so the answer sits inside the button
                  rather than a line below it that the thumb has already covered. On a paid plan the
                  second line is the price itself, straight from the store — never a formatted
                  string, so it stays correct in every currency. */}
              <Button block onClick={buy} disabled={busy != null || !current}>
                {busy === "buy" ? (
                  <span className="pwl__cta-label">Processing…</span>
                ) : trialOnSelected ? (
                  <>
                    <Sparkles size={16} aria-hidden />
                    <span className="pwl__cta-label">
                      <span>Start {trialLabel} free</span>
                      <span className="pwl__cta-sub">Nothing to pay today · cancel any time</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} aria-hidden />
                    <span className="pwl__cta-label">
                      <span>Unlock Silicon Pro</span>
                      {current && (
                        <span className="pwl__cta-sub">
                          {current.offer.price}{current.product.billingSuffix}
                        </span>
                      )}
                    </span>
                  </>
                )}
              </Button>

              {/* The three objections that actually stop a thumb on a subscription paywall: am I
                  trapped, is this going to turn into an ad-farm, and am I buying an advantage over
                  people who didn't pay. Each line is a fact about this product — the same three
                  promises MONETIZATION.md is built on — so the honest answer and the converting
                  answer are the same sentence.

                  Deliberately the quietest text in the pinned bar: 3.1.2(c) wants the billed amount
                  to be the loudest thing here, and reassurance that out-shouts the price is exactly
                  the "confusing design" rejection. */}
              <ul className="pwl__trust" aria-label="Silicon Pro promises">
                {/* Written so the DEFAULT is the subscription phrasing: before the store has named
                    a selected row there is nothing to justify calling it a one-time purchase. */}
                <li>{current?.product.recurring === false ? "One-time purchase" : "Cancel any time"}</li>
                <li>No ads, ever</li>
                <li>No pay-to-win</li>
              </ul>
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
        </div>
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
