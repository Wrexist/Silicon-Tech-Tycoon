// The Vault reveal — the ceremony when a classified dossier finally opens (engine/secrets.ts).
// A pure EARNED moment: the boon was already banked by the tick, so this overlay only acknowledges
// it. Reuses the shared Celebration overlay (confetti + sting), dismissed with a single tap. When
// several files fall in the same week it leads with the highest tier and counts the rest. Mounted
// once in App.
import { FileLock2, Sparkles } from "lucide-react";
import { Celebration, type CelebrationChip } from "../design/Celebration.tsx";
import { higherPriorityPending } from "../design/interruptPriority.ts";
import { TIER_NAMES, secretById } from "../engine/secrets.ts";
import { useGame } from "../state/useGame.tsx";

export function SecretRevealed() {
  const { state, dismissSecretReveal } = useGame();
  const pending = state.pendingSecretReveal ?? null;
  if (!pending || pending.ids.length === 0) return null;
  // Yield to the player's own launch payoff, to every card that needs an answer, and to the other
  // earned ceremony. The reveal is held in state, so it simply waits its turn instead of stacking:
  // a dossier CAN open in the same week another stream raised a card, and celebrating over an
  // unanswered decision would read as a bug.
  if (higherPriorityPending(state, "secretReveal") || state.pendingNemesisTrophy != null) return null;

  // Lead with the most significant file of the week; the others ride along as chips.
  const files = pending.ids.map((id) => secretById(id)).filter((s) => s != null);
  if (files.length === 0) return null;
  const lead = [...files].sort((a, b) => b.tier - a.tier)[0];
  const rest = files.filter((s) => s.id !== lead.id);

  const chips: CelebrationChip[] = [
    { icon: <Sparkles size={14} />, value: TIER_NAMES[lead.tier], label: "classification" },
  ];
  for (const s of rest.slice(0, 2)) {
    chips.push({ icon: <FileLock2 size={14} />, value: s.codename, label: "also opened" });
  }
  if (rest.length > 2) {
    chips.push({ icon: <FileLock2 size={14} />, value: `+${rest.length - 2}`, label: "more files" });
  }

  return (
    <Celebration
      eyebrow={`Vault · ${state.secretsFound?.length ?? 0} files open`}
      title={lead.codename}
      sub={`${lead.requirement} You did it without being asked. ${lead.reward.label}.`}
      icon={<FileLock2 size={34} />}
      tone="accent"
      chips={chips}
      confirmLabel="Read the file"
      onConfirm={dismissSecretReveal}
      sound="mastery"
    />
  );
}
