import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
} from "react";
import { Sparkles } from "lucide-react";
import { haptic } from "./haptics.ts";
import { sfx } from "./sound.ts";
import "./primitives.css";

/* ---------- Card ---------- */
export function Card({
  children,
  variant,
  className = "",
  style,
}: {
  children: ReactNode;
  variant?: "flush" | "inset";
  className?: string;
  style?: React.CSSProperties;
}) {
  const mod = variant ? ` ds-card--${variant}` : "";
  return (
    <div className={`ds-card${mod} ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ---------- Button ---------- */
type BtnVariant = "primary" | "secondary" | "tertiary" | "destructive";
export function Button({
  children,
  variant = "primary",
  block,
  size,
  haptics = "light",
  onClick,
  ...rest
}: {
  children: ReactNode;
  variant?: BtnVariant;
  block?: boolean;
  size?: "sm";
  haptics?: "light" | "medium" | "none";
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`ds-btn ds-btn--${variant}${block ? " ds-btn--block" : ""}${
        size ? " ds-btn--sm" : ""
      }`}
      onClick={(e) => {
        if (haptics !== "none") {
          haptic[haptics]();
          sfx("tap");
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Stat ----------
   A label + value pair with an optional tone (colours the value) and hint line.
   Shared across Market / Company / Design Lab. Pass `className` so each screen keeps
   its own layout class (e.g. mkt__stat, co__stat, wiz__stat) for grid placement. */
export type StatTone = "positive" | "negative" | "accent" | "neutral";
const STAT_TONE_COLOR: Record<StatTone, string> = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  accent: "var(--accent)",
  neutral: "var(--ink)",
};
export function Stat({
  label,
  value,
  tone = "neutral",
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={`ds-stat ${className}`.trim()}>
      <span className="ds-stat__label">{label}</span>
      <span className="ds-stat__value tnum" style={{ color: STAT_TONE_COLOR[tone] }}>{value}</span>
      {hint && <span className="ds-stat__hint">{hint}</span>}
    </div>
  );
}

/* ---------- StatPill ---------- */
export function StatPill({
  label,
  value,
  tone = "neutral",
}: {
  label?: string;
  value: ReactNode;
  tone?: "neutral" | "accent" | "positive" | "negative";
}) {
  const mod = tone === "neutral" ? "" : ` ds-pill--${tone}`;
  return (
    <span className={`ds-pill${mod}`}>
      {label && <span className="ds-pill__label">{label}</span>}
      <span className="ds-pill__value tnum">{value}</span>
    </span>
  );
}

/* ---------- SectionHeader ---------- */
export function SectionHeader({
  title,
  accessory,
}: {
  title: string;
  accessory?: ReactNode;
}) {
  return (
    <div className="ds-section">
      <span className="ds-section__title">{title}</span>
      {accessory && <span className="ds-section__accessory">{accessory}</span>}
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({
  glyph,
  title,
  sub,
  action,
}: {
  glyph?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ds-empty">
      <div className="ds-empty__glyph" aria-hidden>
        {glyph ?? <Sparkles size={36} strokeWidth={1.6} />}
      </div>
      <div className="ds-empty__title">{title}</div>
      {sub && <div className="ds-empty__sub">{sub}</div>}
      {action}
    </div>
  );
}

/* ---------- Slider ---------- */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  accent = "var(--accent)",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ariaLabel?: string;
  accent?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className="ds-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      style={{ "--pct": `${pct}%`, "--accent-local": accent } as React.CSSProperties}
      onChange={(e) => {
        haptic.light();
        onChange(Number(e.target.value));
      }}
    />
  );
}

/* ---------- Sheet ---------- */
export function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ds-sheet-scrim" onClick={onClose}>
      <div className="ds-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ds-sheet__grab" aria-hidden />
        {children}
      </div>
    </div>
  );
}
