// Shared "return to your company" affordance for the challenge + scenario run trackers. A
// challenge/scenario parks the player's freeform company (persistence.stashHomeSave); this restores
// it via returnHome(). Two-tap by design — a long run shouldn't be abandoned by a mistap. Renders
// nothing unless a company is actually stashed (homeSaved). Uses the scn-track__leave styles the
// trackers already import (screens/scenarios.css).
import { useState } from "react";
import { Home } from "lucide-react";
import { Button } from "../design/primitives.tsx";
import { useGame } from "../state/useGame.tsx";
import { showToast } from "../design/toast.tsx";
import { haptic } from "../design/haptics.ts";

export function ReturnHomeSection({ confirmText, toastText }: { confirmText: string; toastText: string }) {
  const { homeSaved, returnHome } = useGame();
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!homeSaved) return null;
  const leave = () => {
    if (returnHome()) { haptic.success(); showToast(toastText, { tone: "positive" }); }
  };
  return confirmLeave ? (
    <div className="scn-track__leave">
      <span className="scn-track__leave-q">{confirmText}</span>
      <div className="scn-track__leave-row">
        <Button size="sm" variant="secondary" onClick={leave}><Home size={15} /> Return home</Button>
        <Button size="sm" variant="tertiary" onClick={() => setConfirmLeave(false)}>Keep playing</Button>
      </div>
    </div>
  ) : (
    <Button size="sm" variant="tertiary" onClick={() => setConfirmLeave(true)}>
      <Home size={15} /> Return to your company
    </Button>
  );
}
