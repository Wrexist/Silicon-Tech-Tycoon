import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ArrowRight, Boxes, Check, Factory, Hammer, Hand, Maximize2, Move, Palette,
  Truck, Workflow, X, ZoomIn, Zap, type LucideIcon,
} from "lucide-react";
import { haptic } from "../design/haptics.ts";
import { sfx } from "../design/sound.ts";
// Reuses the Decorate tutorial's card styling (.dtut*) so both first-run coaches read as one system.
import "./decorateTutorial.css";

interface TStep {
  icon: LucideIcon;
  accent: string;
  title: string;
  text: string;
  visual?: ReactNode;
}

/** The line as a three-beat flow: material in → machines → shipped, so the pipeline reads at a glance. */
function FlowVisual() {
  const beats: { icon: LucideIcon; label: string }[] = [
    { icon: Boxes, label: "Material in" },
    { icon: Factory, label: "Machines" },
    { icon: Truck, label: "Shipped" },
  ];
  return (
    <div className="dtut__acts">
      {beats.map((b, i) => (
        <span className="dtut__act" key={b.label}>
          <b.icon size={14} aria-hidden /> {b.label}
          {i < beats.length - 1 && <ArrowRight size={13} aria-hidden style={{ opacity: 0.5, marginLeft: 2 }} />}
        </span>
      ))}
    </div>
  );
}

/** The three touch gestures, as glyph chips. */
function GestureVisual() {
  const acts: { icon: LucideIcon; label: string }[] = [
    { icon: Hand, label: "Tap to place" },
    { icon: Move, label: "Drag to orbit" },
    { icon: ZoomIn, label: "Pinch to zoom" },
  ];
  return (
    <div className="dtut__acts">
      {acts.map((a) => (
        <span className="dtut__act" key={a.label}><a.icon size={14} aria-hidden /> {a.label}</span>
      ))}
    </div>
  );
}

/** Two rules that make the line actually run (and run faster) — the payoff of a well-built floor. */
function LineVisual() {
  const rows: { icon: LucideIcon; tint: string; label: string; effect: string }[] = [
    { icon: Workflow, tint: "var(--fn-team)", label: "Connected", effect: "belt links intake → packer" },
    { icon: Zap, tint: "var(--fn-eng)", label: "More arms", effect: "builds run in parallel, faster" },
  ];
  return (
    <div className="dtut__perks">
      {rows.map((r) => (
        <div className="dtut__perk" key={r.label}>
          <span className="dtut__perk-chip" style={{ color: r.tint, background: `color-mix(in srgb, ${r.tint} 14%, transparent)` }}>
            <r.icon size={14} aria-hidden />
          </span>
          <span className="dtut__perk-text">
            <b style={{ color: r.tint }}>{r.label}</b> — {r.effect}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The three ways to grow the floor, as glyph chips. */
function GrowVisual() {
  const acts: { icon: LucideIcon; label: string }[] = [
    { icon: Hammer, label: "Upgrades" },
    { icon: Palette, label: "Style" },
    { icon: Maximize2, label: "Expand" },
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
    icon: Factory,
    accent: "var(--accent)",
    title: "Your production line",
    text: "This is your real factory. Material enters at the intake, rides the belt through each machine, and ships from the pallet by the truck — the line you see runs your actual builds.",
    visual: <FlowVisual />,
  },
  {
    icon: Hand,
    accent: "var(--fn-eng)",
    title: "Build the floor",
    text: "Tap Build, pick a machine or a belt, then tap the floor to drop it in. Move the camera with touch to see every angle.",
    visual: <GestureVisual />,
  },
  {
    icon: Zap,
    accent: "var(--fn-team)",
    title: "A good line ships faster",
    text: "Keep the belt unbroken from intake to packer, or the line won't run. Add assembly arms and a well-built line genuinely builds your products quicker.",
    visual: <LineVisual />,
  },
  {
    icon: Palette,
    accent: "var(--fn-design)",
    title: "Make it yours",
    text: "Upgrades boost your robots and output. Style repaints the walls and floor and drops in decor. Expand grows the whole floor when you outgrow it.",
    visual: <GrowVisual />,
  },
];

/** First-run Factory coach: a clean, multi-step modal portaled to <body> so it composites above the
 *  factory stage. Shown once (gated by the caller on settings.factoryTutorialSeen); the caller
 *  persists the flag in onClose. Mirrors DecorateTutorial so the two coaches feel identical. */
export function FactoryTutorial({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Reset to the first step every time it opens (replay from the help button starts fresh).
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
        aria-label="How the Factory works"
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
              {last ? (<><Check size={15} /> Start building</>) : (<>Next <ArrowRight size={15} /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
