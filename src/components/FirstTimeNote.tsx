// A one-line "what this is" note, shown the FIRST time a recurring interrupt system appears and never
// again (cross-run). Drop it inside an interrupt card — it renders the explainer on first meeting and
// nothing thereafter, so veterans aren't lectured. Mounted only while its card is showing (the card
// returns null otherwise), so "first time" is captured cleanly on mount.
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { hasSeenIntro, markIntroSeen, INTRO_COPY } from "../state/interruptIntros.ts";
import "./firstTimeNote.css";

export function FirstTimeNote({ intro }: { intro: string }) {
  // Capture whether this system was unmet BEFORE we mark it seen (initializer runs once on mount).
  const [firstTime] = useState(() => !hasSeenIntro(intro));
  useEffect(() => {
    markIntroSeen(intro);
  }, [intro]);

  if (!firstTime) return null;
  const text = INTRO_COPY[intro];
  if (!text) return null;
  return (
    <p className="firstnote">
      <Info size={14} aria-hidden />
      <span>{text}</span>
    </p>
  );
}
