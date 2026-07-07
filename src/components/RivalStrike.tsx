// Rival Strike interrupt — a rival just launched INTO a category where the player is actively
// selling (the entry haircut already landed). This card turns that from a feed line into a
// decision: cut price, fire a discounted counter-campaign, or hold the line. Mounted once in App;
// mirrors ReadyToLaunch's shell (pause the sim, register as an app overlay, Escape = hold).
import { useEffect, useRef, useState } from "react";
import { Megaphone, Shield, Swords, TrendingDown } from "lucide-react";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { useDialogFocus } from "../design/primitives.tsx";
import { useGame } from "../state/useGame.tsx";
import { marketingPushQuote } from "../state/gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { registerAppOverlay, readyLaunchClaimed } from "../design/overlayGuard.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { format, sub, cents, type Money } from "../engine/money.ts";
import { CATEGORIES } from "../engine/catalogs.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./rivalStrike.css";

export function RivalStrike() {
  const { state, paused, setPaused, resolveStrike } = useGame();
  const strike = state.pendingStrike ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);
  // Serialize the full-screen interrupts so only one owns the screen (pause + Escape) at a time.
  // The launch reveal is the player's own payoff and always wins, so a strike waits behind any
  // unclaimed ready build AND behind the bus-driven reveal itself (which leaves the `ready` shelf
  // the instant "Launch now" is tapped); state keeps pendingStrike, so the card pops once it clears.
  const readyUp = state.ready.some((p) => !readyLaunchClaimed(p.id));
  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);

  // Pause while the card is up (same contract as ReadyToLaunch): the attack shouldn't keep
  // eroding the curve while the player weighs the answer. Restore their prior run state after.
  const pausedByUs = useRef(false);
  const wasPaused = useRef(false);
  const showing = strike !== null && !readyUp && !revealUp;
  useEffect(() => {
    if (showing) {
      if (!pausedByUs.current) {
        wasPaused.current = paused;
        pausedByUs.current = true;
        setPaused(true);
        haptic.warning?.();
        sfx("confirm");
      }
    } else if (pausedByUs.current) {
      pausedByUs.current = false;
      setPaused(wasPaused.current);
    }
  }, [showing, paused, setPaused]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);

  useDialogFocus(dialogRef, showing);
  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") resolveStrike("hold"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showing, resolveStrike]);

  if (!strike || !showing) return null;

  const lp = state.launched.find((l) => l.product.id === strike.productId) ?? null;
  const release = state.rivalReleases.find((r) => r.rivalId === strike.rivalId && r.week === strike.week) ?? null;
  const cfg = BALANCE.market.competition.strike;

  // Response availability mirrors the reducer's own gates so the card never offers a dead button.
  const canCut = !!lp && (lp.priceCuts ?? 0) < 1 && Math.round(lp.product.price * (1 - cfg.priceCutFrac)) > lp.unitCost;
  const newPrice = lp ? (Math.max(lp.unitCost, Math.round(lp.product.price * (1 - cfg.priceCutFrac))) as Money) : null;
  const quote = lp ? marketingPushQuote(lp) : null;
  const pushLeft = !!lp && (lp.marketingPushes ?? 0) < BALANCE.marketingPush.maxPerProduct;
  const discounted = quote ? sub(quote.cost, cents(Math.round(quote.cost * cfg.campaignDiscount))) : null;
  const canCampaign = !!quote && pushLeft && discounted !== null && state.cash >= discounted;
  const outclasses = strike.playerOverall >= strike.rivalOverall;

  const answer = (choice: "price" | "campaign" | "hold") => {
    haptic.success();
    if (choice !== "hold") sfx("cash");
    resolveStrike(choice);
  };

  return (
    <div className="rst">
      <button className="rst__scrim" aria-label="Hold the line" onClick={() => answer("hold")} />
      <div ref={dialogRef} tabIndex={-1} className="rst__card" role="dialog" aria-modal="true" aria-label={`${strike.rivalName} is attacking ${strike.productName}`}>
        <div className="rst__eyebrow"><Swords size={13} aria-hidden /> Rival strike</div>
        <h2 className="rst__title">{strike.rivalName} moves on {CATEGORIES[strike.category].displayName.toLowerCase()}s</h2>
        <p className="rst__sub">
          Their new {strike.rivalProductName} just landed in {strike.productName}'s market — your remaining sales take a {Math.round(BALANCE.market.competition.rivalEntrySalesHaircut * 100)}% hit unless the launch fades.
        </p>

        <div className="rst__duel">
          <div className="rst__side">
            {release ? <DeviceRenderer product={release.product} size={72} /> : <span className="rst__ghost" aria-hidden />}
            <span className="rst__side-name">{strike.rivalProductName}</span>
            <span className="rst__side-score tnum">{strike.rivalOverall}</span>
          </div>
          <span className="rst__vs" aria-hidden>vs</span>
          <div className="rst__side">
            {lp ? <DeviceRenderer product={lp.product} size={72} /> : <span className="rst__ghost" aria-hidden />}
            <span className="rst__side-name">{strike.productName}</span>
            <span className={`rst__side-score tnum${outclasses ? " rst__side-score--win" : ""}`}>{strike.playerOverall}</span>
          </div>
        </div>

        <div className="rst__actions">
          <button className="rst__act rst__act--primary" disabled={!canCut} onClick={() => answer("price")}>
            <span className="rst__act-label"><TrendingDown size={15} aria-hidden /> Cut price</span>
            <span className="rst__act-val tnum">{lp && newPrice !== null ? `${format(lp.product.price)} → ${format(newPrice)}` : "used up"}</span>
          </button>
          <button className="rst__act" disabled={!canCampaign} onClick={() => answer("campaign")}>
            <span className="rst__act-label"><Megaphone size={15} aria-hidden /> Counter-campaign</span>
            <span className="rst__act-val tnum">{discounted !== null ? format(discounted) : "unavailable"}</span>
          </button>
          {discounted !== null && (
            <span className="rst__deal">Strike rate — {Math.round(cfg.campaignDiscount * 100)}% off the usual campaign</span>
          )}
          <button className="rst__hold" onClick={() => answer("hold")}>
            <Shield size={14} aria-hidden /> Hold the line{outclasses ? ` · yours is better (+${cfg.holdRepBonus} rep)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
