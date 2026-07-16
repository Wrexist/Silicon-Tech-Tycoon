// Inbound licensing CONTRACT popup — a rival approaches wanting to ship your OS on their devices, and
// the game surfaces it as a full-screen moment so it can't be missed. The player can SIGN (bank the
// upfront bonus), NEGOTIATE (a one-shot gamble to push the bonus higher — they may sweeten it, hold
// firm, or walk), or DECLINE. Same clear liquid-glass frame + pause/serialize contract as the eureka /
// community / earnings interrupts (it yields to the launch reveal and every other pending card, and to
// any unclaimed ready build). Mounted once in App. All gated behind platformUnlocked at the state layer.
import { useEffect, useRef, useState } from "react";
import { Handshake, Crown, BadgeDollarSign, TrendingUp, Smile, Scale, Flame, Sparkles, DoorClosed, type LucideIcon } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay } from "../design/overlayGuard.ts";
import { higherPriorityPending, decisionPending } from "../design/interruptPriority.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { osDisplayName } from "../state/gameState.ts";
import { offerTemper, type SuitorTemper } from "../engine/licenseOffers.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import { format, type Money } from "../engine/money.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./contractOffer.css";

// How a suitor's bargaining temper reads to the player — honest about the negotiation odds (the same
// temper sets the walk/improve bands in the engine) without leaking the exact roll.
const TEMPER: Record<SuitorTemper, { label: string; icon: LucideIcon; tone: string }> = {
  eager:    { label: "They're keen to close — a good deal to push", icon: Smile, tone: "pos" },
  measured: { label: "They'll drive a fair bargain", icon: Scale, tone: "neutral" },
  hardball: { label: "They're playing hardball — push at your peril", icon: Flame, tone: "warn" },
};

export function ContractOffer() {
  const { state, signLicenseOffer, negotiateLicenseOffer, declineLicenseOffer } = useGame();
  const offer = state.pendingLicenseOffer ?? null;
  // Captured terms so the signed reveal survives the offer clearing from state the instant we sign.
  const [signed, setSigned] = useState<{ name: string; bonus: Money; royalty: Money; exclusive: boolean } | null>(null);
  // The suitor walked away mid-negotiation — hold the moment up even though the offer is gone.
  const [walked, setWalked] = useState<{ name: string } | null>(null);
  // The inline result of a push that DIDN'T end the deal (sweetened / held firm).
  const [nego, setNego] = useState<{ outcome: "improved" | "firm"; bonusDelta: Money } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Serialize below the player's own payoff (launch reveal) and every other interrupt + unclaimed build.
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp = revealUp || higherPriorityPending(state, "licenseOffer") || decisionPending(state);
  // A reveal (signed / walked) must survive the offer clearing, so those locals hold the card up.
  const showing = (offer !== null || signed !== null || walked !== null) && !higherUp;

  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing || signed || walked) { if (!showing) cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("confirm");
    haptic.medium();
  }, [showing, signed, walked]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);
  useDialogFocus(dialogRef, showing);

  // Reset the per-offer inline banner when a fresh offer arrives (id changes).
  const offerId = offer?.id ?? null;
  useEffect(() => { setNego(null); }, [offerId]);

  if (!showing) return null;

  // ---- Signed reveal ----
  if (signed) {
    return (
      <div className="cof">
        <div className="cof__scrim" aria-hidden />
        <div ref={dialogRef} tabIndex={-1} className="cof__card cof__card--done" role="dialog" aria-modal="true" aria-label="Contract signed">
          <div className="cof__glyph cof__glyph--done" aria-hidden><Handshake size={26} /></div>
          <div className="cof__eyebrow cof__eyebrow--done">{signed.exclusive ? "Exclusive deal signed" : "Contract signed"}</div>
          <h2 className="cof__title">{signed.name} runs {osDisplayName(state)}</h2>
          <p className="cof__sub">They ship your OS on their devices{signed.exclusive ? ", exclusively" : ""}. The signing bonus is in the bank; royalties roll in every week.</p>
          <div className="cof__chips">
            <div className="cof__chip">
              <span className="cof__chip-icon" aria-hidden><BadgeDollarSign size={14} /></span>
              <strong>{format(signed.bonus)}</strong>
              <small>signing bonus</small>
            </div>
            <div className="cof__chip">
              <span className="cof__chip-icon" aria-hidden><TrendingUp size={14} /></span>
              <strong>{format(signed.royalty)}/wk</strong>
              <small>royalty</small>
            </div>
          </div>
          <Button block haptics="none" onClick={() => setSigned(null)}>Excellent</Button>
        </div>
      </div>
    );
  }

  // ---- Walked-away reveal ----
  if (walked) {
    return (
      <div className="cof">
        <div className="cof__scrim" aria-hidden />
        <div ref={dialogRef} tabIndex={-1} className="cof__card cof__card--walked" role="dialog" aria-modal="true" aria-label="The suitor walked away">
          <div className="cof__glyph cof__glyph--walked" aria-hidden><DoorClosed size={26} /></div>
          <div className="cof__eyebrow cof__eyebrow--walked">They walked away</div>
          <h2 className="cof__title">{walked.name} pulled out</h2>
          <p className="cof__sub">You pushed too hard and they left the table. The deal's off — another suitor will come in time.</p>
          <Button block haptics="none" onClick={() => setWalked(null)}>Understood</Button>
        </div>
      </div>
    );
  }

  // ---- Decision ----
  if (!offer) return null;
  const cat = CATEGORIES[offer.category].displayName.toLowerCase();
  const temper = TEMPER[offerTemper(offer)];
  const TIcon = temper.icon;
  return (
    <div className="cof">
      <div className="cof__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className={`cof__card${offer.exclusive ? " cof__card--exclusive" : ""}`} role="dialog" aria-modal="true" aria-label="A licensing contract offer">
        <div className={`cof__glyph${offer.exclusive ? " cof__glyph--exclusive" : ""}`} aria-hidden><Handshake size={26} /></div>
        <div className={`cof__eyebrow${offer.exclusive ? " cof__eyebrow--exclusive" : ""}`}>{offer.exclusive ? "Exclusive contract offer" : "Licensing contract offer"}</div>
        <h2 className="cof__title">{offer.rivalName} wants {osDisplayName(state)}</h2>
        {offer.exclusive && <span className="cof__badge"><Crown size={12} aria-hidden /> Exclusive</span>}
        <p className="cof__sub">
          To ship {osDisplayName(state)} on their {cat}s over a ~{offer.termWeeks}-week term.
          {offer.exclusive
            ? ` No other rival may license it for ${cat}s while the deal holds — and they'll compete harder for it.`
            : " They'll compete a little harder in your shared markets."}
        </p>
        <div className="cof__terms">
          <div className="cof__term">
            <span className="cof__term-label"><BadgeDollarSign size={13} aria-hidden /> Signing bonus</span>
            <span className="cof__term-val cof__term-val--pos tnum">{format(offer.signingBonus)}</span>
          </div>
          <div className="cof__term">
            <span className="cof__term-label"><TrendingUp size={13} aria-hidden /> Royalty</span>
            <span className="cof__term-val cof__term-val--pos tnum">{format(offer.royaltyPerWeek)}/wk</span>
          </div>
        </div>

        {nego ? (
          <p className={`cof__nego cof__nego--${nego.outcome === "improved" ? "pos" : "neutral"}`}>
            {nego.outcome === "improved"
              ? <><Sparkles size={13} aria-hidden /> They sweetened the deal — +{format(nego.bonusDelta)} upfront.</>
              : <><Scale size={13} aria-hidden /> They held firm — the original terms stand.</>}
          </p>
        ) : (
          <p className={`cof__temper cof__temper--${temper.tone}`}>
            <TIcon size={13} aria-hidden /> {temper.label}
          </p>
        )}

        <div className="cof__actions">
          <Button
            block
            haptics="none"
            onClick={() => {
              const terms = { name: offer.rivalName, bonus: offer.signingBonus, royalty: offer.royaltyPerWeek, exclusive: offer.exclusive };
              if (signLicenseOffer()) setSigned(terms);
            }}
          >
            <Handshake size={16} /> Sign · {format(offer.signingBonus)}
          </Button>
          <Button
            block
            variant="secondary"
            haptics="none"
            disabled={!!offer.negotiated}
            onClick={() => {
              const name = offer.rivalName;
              const r = negotiateLicenseOffer();
              if (!r) return;
              if (r.outcome === "walked") setWalked({ name });
              else setNego({ outcome: r.outcome, bonusDelta: r.bonusDelta });
            }}
          >
            {offer.negotiated ? "Already pushed" : "Negotiate for more"}
          </Button>
          <Button block variant="tertiary" haptics="none" onClick={() => { declineLicenseOffer(); }}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
