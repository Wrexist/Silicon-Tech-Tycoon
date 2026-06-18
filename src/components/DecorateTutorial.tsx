import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, Check, Crosshair, Hand, LayoutGrid, RotateCw, Smile, Sparkles, Trash2, Users, X,
  type LucideIcon,
} from "lucide-react";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
import "./decorateTutorial.css";

interface TStep {
  icon: LucideIcon;
  accent: string;
  title: string;
  text: string;
  visual?: ReactNode;
}

/** Three perk rows — the heart of the shop: furniture isn't just décor, it buffs the company. */
function PerkVisual() {
  const rows: { icon: LucideIcon; tint: string; label: string; effect: string }[] = [
    { icon: Smile, tint: "var(--fn-team)", label: "Comfort", effect: "lifts team mood" },
    { icon: Crosshair, tint: "var(--fn-eng)", label: "Focus", effect: "speeds up research" },
    { icon: Sparkles, tint: "var(--fn-design)", label: "Inspiration", effect: "raises design" },
  ];
  return (
    <div className="dtut__perks">
      {rows.map((r) => (
        <div className="dtut__perk" key={r.label}>
          <span className="dtut__perk-chip" style={{ color: r.tint, background: `color-mix(in srgb, ${r.tint} 14%, transparent)` }}>
            <r.icon size={14} aria-hidden />
          </span>
          <span className="dtut__perk-text">
            <b style={{ color: r.tint }}>{r.label}</b> {r.effect}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A desk → one seat, the new hiring model: you buy desks here, not in an upgrade menu. */
function SeatVisual() {
  return (
    <div className="dtut__seat">
      <span className="dtut__seat-desk"><LayoutGrid size={18} aria-hidden /></span>
      <span className="dtut__seat-eq">=</span>
      <span className="dtut__seat-one"><Users size={16} aria-hidden /> 1 seat</span>
    </div>
  );
}

/** The three direct manipulations, shown as glyph chips so the gestures read at a glance. */
function MoveVisual() {
  const acts: { icon: LucideIcon; label: string }[] = [
    { icon: Hand, label: "Tap to buy" },
    { icon: RotateCw, label: "Rotate" },
    { icon: Trash2, label: "Sell · 50% back" },
  ];
  return (
    <div className="dtut__acts">
      {acts.map((a) => (
        <span className="dtut__act" key={a.label}><a.icon size={14} aria-hidden /> {a.label}</span>
      ))}
    </div>
  );
}

const STEPS: TStep[] = [
  {
    icon: LayoutGrid,
    accent: "var(--accent)",
    title: "Welcome to your office",
    text: "This is your real workspace. Buy furniture to fill it out — every piece you place shows up live in the 3D room.",
  },
  {
    icon: Sparkles,
    accent: "var(--fn-design)",
    title: "Furniture has perks",
    text: "Pieces aren't just for looks. Each one buffs your company, and the perks stack across the whole room:",
    visual: <PerkVisual />,
  },
  {
    icon: Users,
    accent: "var(--fn-team)",
    title: "Desks are seats",
    text: "Every desk you buy here is a seat your next hire sits down at. Place more desks to grow the team — no upgrade menu needed.",
    visual: <SeatVisual />,
  },
  {
    icon: Hand,
    accent: "var(--fn-eng)",
    title: "Place, move, sell",
    text: "Tap an item to buy and drop it in. Drag to reposition, rotate to fit, and sell anything back for half its price. Undo takes back your last move.",
    visual: <MoveVisual />,
  },
];

/** First-run Decorate coach: a clean, multi-step modal portaled to <body> so it composites above
 *  every screen layer. Shown once (gated by the caller on settings.decorateTutorialSeen); the
 *  caller persists the flag in onClose. */
export function DecorateTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Reset to the first step every time it opens (replay from the ? button starts fresh).
  useEffect(() => { if (open) setI(0); }, [open]);

  // Escape closes; focus the card so the dialog is reachable by keyboard.
  useEffect(() => {
    if (!open) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const last = i === STEPS.length - 1;
  const step = STEPS[i];
  const next = () => {
    if (last) { haptic.success(); sfx("confirm"); onClose(); return; }
    setI((n) => n + 1); haptic.light(); sfx("tap");
  };
  const back = () => { if (i > 0) { setI((n) => n - 1); haptic.light(); } };

  return createPortal(
    <div className="dtut-scrim" onClick={onClose}>
      <div
        ref={cardRef}
        className="dtut"
        style={{ "--dtut-accent": step.accent } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label="How Decorate works"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="dtut__skip" aria-label="Skip tutorial" onClick={onClose}><X size={16} /></button>

        <div className="dtut__hero">
          <span className="dtut__glyph" key={i}><step.icon size={26} strokeWidth={1.75} /></span>
        </div>

        <div className="dtut__body" key={`b${i}`}>
          <h2 className="dtut__title">{step.title}</h2>
          <p className="dtut__text">{step.text}</p>
          {step.visual}
        </div>

        <div className="dtut__footer">
          <div className="dtut__dots" role="presentation">
            {STEPS.map((_, d) => (
              <span key={d} className={`dtut__dot${d === i ? " dtut__dot--on" : ""}${d < i ? " dtut__dot--done" : ""}`} />
            ))}
          </div>
          <div className="dtut__nav">
            {i > 0 && (
              <button className="dtut__btn dtut__btn--ghost" onClick={back}><ArrowLeft size={15} /> Back</button>
            )}
            <button className="dtut__btn dtut__btn--primary" onClick={next}>
              {last ? (<><Check size={15} /> Start decorating</>) : (<>Next <ArrowRight size={15} /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
