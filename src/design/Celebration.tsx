// A reusable, premium "you achieved something" overlay — the dopamine payoff shared by the OS
// completion, an OS version release, and forging a New Game+ legacy. Portals to <body> (escapes any
// sheet's scroll/stacking), fires confetti from the global bus + a celebratory sound on mount, and
// springs the emblem in with a radiating ray burst. Zero image assets — pure vector. The ray/spring
// choreography is fully disabled under reduced motion (see celebration.css); the resting card stays
// readable, and confetti self-suppresses.
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { Button, useDialogFocus } from "./primitives.tsx";
import { emitCelebrate } from "./celebrateFx.ts";
import { sfx } from "./sound.ts";
import "./celebration.css";

export interface CelebrationChip {
  icon?: ReactNode;
  value: string;
  label: string;
  sub?: string;
}

export interface CelebrationProps {
  eyebrow: string;
  title: string;
  sub?: string;
  /** Glyph rendered inside the emblem disc (e.g. <Layers size={34} />). */
  icon: ReactNode;
  tone?: "accent" | "positive";
  chips?: CelebrationChip[];
  confirmLabel: string;
  onConfirm: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Celebratory cue fired once on mount. Defaults to the big "mastery" sting. */
  sound?: "mastery" | "era" | "confirm";
  /** Show the green check seal on the emblem (a "done/earned" stamp). Default true. */
  seal?: boolean;
}

const RAY_COUNT = 12;

export function Celebration({
  eyebrow,
  title,
  sub,
  icon,
  tone = "accent",
  chips,
  confirmLabel,
  onConfirm,
  secondaryLabel,
  onSecondary,
  sound = "mastery",
  seal = true,
}: CelebrationProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Modal a11y: move focus into the dialog, trap Tab within it, and restore focus on close.
  useDialogFocus(dialogRef, true);

  // Fire the confetti + sound exactly once when the moment appears.
  useEffect(() => {
    emitCelebrate();
    sfx(sound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A scrim tap (or Escape) is a soft dismiss: prefer the secondary action (e.g. "Not yet") when
  // present so it can never accidentally fire a destructive confirm; otherwise it dismisses via confirm.
  const onScrim = () => (onSecondary ? onSecondary() : onConfirm());

  // Close on Escape, like every other modal surface.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") (onSecondary ? onSecondary() : onConfirm()); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm, onSecondary]);

  return createPortal(
    <div ref={dialogRef} className={`cele cele--${tone}`} role="dialog" aria-modal="true" aria-label={`${eyebrow}: ${title}`} tabIndex={-1} onClick={onScrim}>
      <div className="cele__card" onClick={(e) => e.stopPropagation()}>
        <div className="cele__emblem" aria-hidden>
          <span className="cele__rays">
            {Array.from({ length: RAY_COUNT }).map((_, i) => (
              <i key={i} style={{ "--a": `${(360 / RAY_COUNT) * i}deg`, "--d": `${i * 28}ms` } as React.CSSProperties} />
            ))}
          </span>
          <span className="cele__disc">{icon}</span>
          {seal && <span className="cele__seal" aria-hidden><Check size={16} /></span>}
        </div>
        <p className="cele__eyebrow">{eyebrow}</p>
        <h3 className="cele__title">{title}</h3>
        {sub && <p className="cele__sub">{sub}</p>}
        {chips && chips.length > 0 && (
          <div className="cele__chips">
            {chips.map((c, i) => (
              <span className="cele__chip" key={i}>
                {c.icon && <span className="cele__chip-icon" aria-hidden>{c.icon}</span>}
                <strong>{c.value}</strong>
                {c.label}
                {c.sub && <small>{c.sub}</small>}
              </span>
            ))}
          </div>
        )}
        <Button block onClick={onConfirm}><Check size={15} /> {confirmLabel}</Button>
        {secondaryLabel && onSecondary && (
          <Button block variant="tertiary" onClick={onSecondary}>{secondaryLabel}</Button>
        )}
      </div>
    </div>,
    document.body,
  );
}
