// Regional event interrupt — an expansion market throws a boom / tariff / rival surge, and the player
// RESPONDS (spend cash to lift standing) or IGNORES (free, but usually costs standing). A respond-or-
// ignore decision; the feed + a toast carry the outcome. Mounted once in App; yields to the launch
// reveal and every other pending interrupt (only one is ever raised at a time by the tick budget).
import { useEffect, useRef, useState } from "react";
import { Globe, Landmark, Swords, TrendingUp } from "lucide-react";
import { Button, useDialogFocus } from "../design/primitives.tsx";
import { useGame, useHoldSim } from "../state/useGame.tsx";
import { registerAppOverlay, readyLaunchClaimed } from "../design/overlayGuard.ts";
import { isLaunchRevealActive, onLaunchRevealActiveChange } from "../design/launchReveal.ts";
import { REGIONAL_EVENT_COPY } from "../engine/regionalEvents.ts";
import { regionById } from "../engine/regions.ts";
import { format } from "../engine/money.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./regionalEvent.css";

const ICON = { TrendingUp, Landmark, Swords } as const;

export function RegionalEvent() {
  const { state, resolveRegionalEvent } = useGame();
  const event = state.pendingRegionalEvent ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);

  const [revealUp, setRevealUp] = useState(isLaunchRevealActive());
  useEffect(() => onLaunchRevealActiveChange(() => setRevealUp(isLaunchRevealActive())), []);
  const higherUp =
    revealUp ||
    state.pendingStrike != null || state.pendingAwards != null || state.pendingRivalry != null ||
    state.pendingEureka != null || state.pendingCommunityAsk != null || state.pendingEarnings != null ||
    state.pendingStaffMoment != null || state.ready.some((p) => !readyLaunchClaimed(p.id));
  const showing = event !== null && !higherUp;

  useHoldSim(showing);
  const cued = useRef(false);
  useEffect(() => {
    if (!showing) { cued.current = false; return; }
    if (cued.current) return;
    cued.current = true;
    sfx("toggle");
    haptic.medium?.();
  }, [showing]);
  useEffect(() => {
    if (!showing) return;
    return registerAppOverlay();
  }, [showing]);
  useDialogFocus(dialogRef, showing);

  if (!showing || !event) return null;
  const copy = REGIONAL_EVENT_COPY[event.kind];
  const region = regionById(event.regionId);
  const Icon = ICON[copy.icon as keyof typeof ICON] ?? Globe;
  const canAfford = state.cash >= event.cost;

  return (
    <div className={`rge rge--${copy.tone}`}>
      <div className="rge__scrim" aria-hidden />
      <div ref={dialogRef} tabIndex={-1} className="rge__card" role="dialog" aria-modal="true" aria-label={copy.title}>
        <div className="rge__glyph" aria-hidden><Icon size={28} /></div>
        <div className="rge__region"><Globe size={12} aria-hidden /> {region?.name ?? "A market"}</div>
        <div className="rge__eyebrow">{copy.eyebrow}</div>
        <h2 className="rge__title">{copy.title}</h2>
        <p className="rge__sub">{copy.blurb}</p>
        <div className="rge__actions">
          <Button
            block
            disabled={!canAfford}
            onClick={() => { resolveRegionalEvent(true); }}
          >
            {copy.respond} · {format(event.cost)}
          </Button>
          <Button block variant="tertiary" onClick={() => { resolveRegionalEvent(false); }}>
            {copy.ignore}
          </Button>
        </div>
        {!canAfford && <p className="rge__note">Not enough cash to respond — you can still let it pass.</p>}
      </div>
    </div>
  );
}
