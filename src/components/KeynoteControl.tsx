// Pre-launch Keynote gamble (feature #4) — the compact affordance under an in-production build card.
// Before a keynote is held it offers "Hold Keynote"; once held it shows the live promise (bonus +
// deadline) or a "slipped" state. No modal, no interrupt budget — announce is a one-tap player action
// that fires a toast + celebration through the announceKeynote callback. Reads the deterministic keynote
// helpers so what it shows always matches what the launch will apply.
import { useEffect, useRef } from "react";
import { createElement } from "react";
import { Megaphone, CalendarClock, TriangleAlert } from "lucide-react";
import type { BuildJob } from "../engine/types.ts";
import { useGame } from "../state/useGame.tsx";
import { keynoteFor, keynotesThisYear, canAnnounceKeynote } from "../state/gameState.ts";
import { BALANCE } from "../engine/balance.ts";
import { showToast } from "../design/toast.tsx";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./keynoteControl.css";

export function KeynoteControl({ job }: { job: BuildJob }) {
  const { state, announceKeynote } = useGame();
  const id = job.product.id;
  const keynote = keynoteFor(state, id);

  if (keynote) {
    if (keynote.slipped) {
      return (
        <div className="kctl kctl--slipped" role="status">
          <TriangleAlert size={14} aria-hidden />
          <span>Keynote slipped — the launch buzz will sting (−{Math.round(keynote.penalty * 100)}% hype).</span>
        </div>
      );
    }
    return (
      <div className="kctl kctl--live" role="status">
        <CalendarClock size={14} aria-hidden />
        <span>
          Keynote: <b>+{Math.round(keynote.maxBonus * 100)}% hype</b> if shipped by wk {keynote.deadlineWeek}
        </span>
      </div>
    );
  }

  const capLeft = BALANCE.keynote.maxPerYear - keynotesThisYear(state);
  const can = canAnnounceKeynote(state, id);
  return (
    <button
      className="kctl kctl--cta"
      onClick={() => announceKeynote(id)}
      disabled={!can}
      title={
        capLeft <= 0
          ? "No keynotes left this year"
          : "Announce this product now — commit to a ship-by window for a launch-hype bonus if you keep the promise."
      }
    >
      <Megaphone size={14} aria-hidden />
      <span>Hold Keynote</span>
      <small className="kctl__hint">{capLeft > 0 ? `${capLeft} left this year` : "none left this year"}</small>
    </button>
  );
}

/** Mounted once in App — surfaces the SLIP as a toast (the engine already applied the rep sting + feed
 *  line at expiry). Watches pendingKeynote for entries that newly flip to `slipped`, mirroring how
 *  ReadyToLaunch watches the `ready` shelf. No modal, no interrupt budget. */
export function KeynoteToasts() {
  const { state } = useGame();
  // Seed from whatever is already slipped at mount (a loaded save doesn't re-toast old slips).
  const toasted = useRef<Set<string> | null>(null);
  if (toasted.current === null) {
    toasted.current = new Set((state.pendingKeynote ?? []).filter((k) => k.slipped).map((k) => k.productId));
  }
  useEffect(() => {
    for (const k of state.pendingKeynote ?? []) {
      if (k.slipped && !toasted.current!.has(k.productId)) {
        toasted.current!.add(k.productId);
        haptic.error();
        sfx("error");
        showToast(`Keynote promise slipped — “${k.productName}” missed its window.`, {
          tone: "negative",
          glyph: createElement(TriangleAlert, { size: 15 }),
        });
      }
    }
  }, [state.pendingKeynote]);
  return null;
}
