// The founding brief — one question, asked once, immediately before the founding offer.
//
// The screen BEFORE the paywall moves conversion more than the paywall does: an offer that leads
// with the thing this player actually came for reads as an answer instead of an interruption. This
// is that screen, kept to a single honest question — see `state/founderIntent.ts` for why it is one
// question and not the usual ten-step "personalization quiz" that changes nothing.
//
// It is also a real founding beat in its own right: naming your ambition is the sort of thing this
// game should ask, and the answer sticks around in Settings afterwards.
import { Compass } from "lucide-react";
import { INTENT_OPTIONS, markFounderIntentSkipped, setFounderIntent, type FounderIntent } from "../state/founderIntent.ts";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./foundingBrief.css";

export function FoundingBrief({ companyName, onDone }: { companyName: string; onDone: () => void }) {
  const pick = (id: FounderIntent) => {
    haptic.medium();
    sfx("confirm");
    setFounderIntent(id);
    onDone();
  };
  const skip = () => {
    haptic.light();
    markFounderIntentSkipped();
    onDone();
  };

  return (
    <div className="onboard">
      <div className="onboard__scroll">
        <div className="onboard__inner">
          <div className="fbrief__glyph" aria-hidden><Compass size={38} strokeWidth={1.7} /></div>
          <h1 className="onboard__title">What are you building?</h1>
          <p className="onboard__tag">
            {companyName} is yours to steer. Tell us what you're after and we'll point you at the
            parts of Silicon that get you there.
          </p>

          <div className="fbrief__options" role="group" aria-label="What are you building?">
            {INTENT_OPTIONS.map((o) => (
              <button key={o.id} type="button" className="fbrief__option" onClick={() => pick(o.id)}>
                <span className="fbrief__option-label">{o.label}</span>
                <span className="fbrief__option-sub">{o.sub}</span>
              </button>
            ))}
          </div>

          <button className="onboard__scenario-link" onClick={skip}>
            Skip — just let me play
          </button>
        </div>
      </div>
    </div>
  );
}
