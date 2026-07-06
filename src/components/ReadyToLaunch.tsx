// Global "Ready to launch" popup. The moment a build finishes manufacturing, this pops up wherever
// the player is — no need to hunt for the product on the Office tab — and lets them ship it in one
// tap. Mounted once in App; reads the `ready` shelf from the game state and detects new arrivals.
// Tapping "Launch now" fires the same keynote reveal as the Office card (shared launch hook); tapping
// "Later" leaves the product on the Office "Ready to launch" card so nothing is ever stranded.
import { useEffect, useRef, useState } from "react";
import { Clock, Factory, Rocket, X } from "lucide-react";
import { DeviceRenderer } from "../render/DeviceRenderer.tsx";
import { Button, Stat, useDialogFocus } from "../design/primitives.tsx";
import { useGame } from "../state/useGame.tsx";
import { useLaunchProduct } from "../state/useLaunchProduct.ts";
import { planProduction } from "../state/gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { format, toDollars } from "../engine/money.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import { readyLaunchClaimed } from "../design/overlayGuard.ts";
import type { ChannelId } from "../engine/marketing.ts";
import "./readyToLaunch.css";

export function ReadyToLaunch() {
  const { state, paused, setPaused } = useGame();
  const launchProduct = useLaunchProduct();
  const dialogRef = useRef<HTMLDivElement>(null);

  // IDs already accounted for, so we only pop for products that BECOME ready while playing. Seeded
  // from whatever's on the shelf at mount (a loaded save with pending builds doesn't auto-pop —
  // those stay on the Office card), then grown as new builds finish.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(state.ready.map((p) => p.id));

  const [queue, setQueue] = useState<string[]>([]);

  // Enqueue any freshly-ready product — unless another screen (the Design Lab's integrated
  // tracker sheet) has claimed it and is already presenting its ready moment. Claimed products
  // are marked seen, so closing that sheet reads as "Later" (Office card), never a late double-pop.
  useEffect(() => {
    const fresh = state.ready.filter((p) => !seen.current!.has(p.id));
    if (fresh.length === 0) return;
    fresh.forEach((p) => seen.current!.add(p.id));
    const pop = fresh.filter((p) => !readyLaunchClaimed(p.id));
    if (pop.length === 0) return;
    setQueue((q) => [...q, ...pop.map((p) => p.id)]);
    haptic.success();
    sfx("confirm");
  }, [state.ready]);

  // Drop the head of the queue if its product is no longer launchable (e.g. shipped elsewhere).
  useEffect(() => {
    if (queue.length && !state.ready.some((p) => p.id === queue[0])) {
      setQueue((q) => q.slice(1));
    }
  }, [queue, state.ready]);

  // Pause the sim while a popup is up so the world doesn't run on behind the decision; restore the
  // player's prior run state when the queue empties (respecting a manual resume taken while open).
  const pausedByUs = useRef(false);
  const wasPaused = useRef(false);
  useEffect(() => {
    if (queue.length > 0) {
      if (!pausedByUs.current) {
        wasPaused.current = paused;
        pausedByUs.current = true;
        setPaused(true);
      }
    } else if (pausedByUs.current) {
      pausedByUs.current = false;
      setPaused(wasPaused.current);
    }
  }, [queue.length, paused, setPaused]);

  const currentId = queue[0];
  const product = currentId ? state.ready.find((p) => p.id === currentId) ?? null : null;

  useDialogFocus(dialogRef, product !== null);
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setQueue((q) => q.slice(1)); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [product]);

  if (!product) return null;

  const plan = planProduction(
    state,
    product,
    product.plannedUnits ?? BALANCE.build.minRun,
    (product.channelId as ChannelId) ?? "none",
  );
  const profitDollars = toDollars(plan.projectedProfit);
  const overallHint = plan.overall >= 75 ? "flagship tier" : plan.overall >= 55 ? "strong build" : plan.overall >= 35 ? "mid-tier" : "entry tier";
  const more = queue.length - 1;

  const dequeue = () => setQueue((q) => q.slice(1));
  const launchNow = () => {
    // Close THIS popup first so the keynote reveal isn't stacked on top of it, then ship.
    dequeue();
    launchProduct(product.id);
  };
  const later = () => { haptic.light(); dequeue(); };

  return (
    <div className="rtl">
      <button className="rtl__scrim" aria-label="Dismiss" onClick={later} />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="rtl__card"
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} is ready to launch`}
      >
        <button className="rtl__close" onClick={later} aria-label="Later"><X size={18} /></button>

        <div className="rtl__eyebrow"><Factory size={13} aria-hidden /> Manufacturing complete</div>
        <h2 className="rtl__title">Ready to launch</h2>
        <p className="rtl__sub">“{product.name}” rolled off the line. Ship it now, no need to leave this screen.</p>

        <div className="rtl__stage">
          <span className="rtl__glow" aria-hidden />
          <DeviceRenderer product={product} size={132} idle shimmer />
        </div>

        <div className="rtl__grid">
          <Stat label="Overall" value={`${plan.overall}`} hint={overallHint} />
          <Stat label="Run size" value={(product.plannedUnits ?? plan.plannedUnits).toLocaleString()} />
          <Stat
            label="Est. sales"
            value={plan.projectedSales.toLocaleString()}
            tone={plan.sellsOut ? "positive" : "neutral"}
            hint={plan.sellsOut ? "would sell out" : undefined}
          />
          <Stat label="Est. profit" value={format(plan.projectedProfit)} tone={profitDollars >= 0 ? "positive" : "negative"} />
        </div>

        <Button block onClick={launchNow}><Rocket size={16} /> Launch now</Button>
        <button className="rtl__later" onClick={later}>
          <Clock size={14} aria-hidden /> Later{more > 0 ? ` · ${more} more ready` : ""}
        </button>
      </div>
    </div>
  );
}
