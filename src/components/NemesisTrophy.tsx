// Nemesis Boss ladder (feature #7) — the VICTORY celebration when you clear a duel against your
// arch-rival. A pure earned ceremony (the reward was already applied in the tick), NOT an opportunistic
// interrupt: it never consumes the shared interrupt budget. Reuses the shared Celebration overlay
// (confetti + sting), dismissed with a single tap. Mounted once in App.
import { Trophy, Sparkles, Users, Gem } from "lucide-react";
import { Celebration, type CelebrationChip } from "../design/Celebration.tsx";
import { useGame } from "../state/useGame.tsx";

export function NemesisTrophy() {
  const { state, dismissNemesisTrophy } = useGame();
  const win = state.pendingNemesisTrophy ?? null;
  if (!win) return null;

  const chips: CelebrationChip[] = [
    { icon: <Sparkles size={14} />, value: `+${win.rep}`, label: "reputation" },
    { icon: <Users size={14} />, value: `+${win.fans.toLocaleString()}`, label: "fans" },
  ];
  if (win.legacyPoints > 0) {
    chips.push({ icon: <Gem size={14} />, value: `+${win.legacyPoints}`, label: "legacy" });
  }

  return (
    <Celebration
      eyebrow={`Duel won · trophy #${win.trophies}`}
      title={`You beat ${win.rivalName}`}
      sub={`You out-valued your arch-rival before the window closed. The ladder rises to tier ${win.tier + 2} — the next duel will demand more.`}
      icon={<Trophy size={34} />}
      tone="positive"
      chips={chips}
      confirmLabel="Claim the trophy"
      onConfirm={dismissNemesisTrophy}
      sound="mastery"
    />
  );
}
